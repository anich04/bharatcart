"use server";

import type { PaymentMode } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { priceCartItems } from "@/lib/cart/pricing";
import { computeOrderTotals } from "@/lib/checkout/totals";
import { CHECKOUT_CONFIG, isCodServiceable } from "@/lib/checkout/config";
import {
  createPendingOrder,
  confirmOrder,
  resolveCoupon,
  CheckoutError,
} from "@/lib/orders/service";
import { createRazorpayOrder, isRazorpayConfigured, razorpayPublicKeyId } from "@/lib/razorpay";
import { sendOrderConfirmationEmail } from "@/lib/orders/emails";

export type CheckoutPreview = {
  ok: boolean;
  error?: string;
  couponError?: string;
  itemsSubtotal: number;
  discountTotal: number;
  shippingTotal: number;
  codCharge: number;
  grandTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  itemCount: number;
  codAvailable: boolean;
  codUnavailableReason?: string;
  lines: {
    variantId: string;
    title: string;
    label: string;
    quantity: number;
    lineTotal: number;
    imageUrl: string | null;
  }[];
};

const EMPTY: CheckoutPreview = {
  ok: false,
  itemsSubtotal: 0,
  discountTotal: 0,
  shippingTotal: 0,
  codCharge: 0,
  grandTotal: 0,
  cgstTotal: 0,
  sgstTotal: 0,
  igstTotal: 0,
  itemCount: 0,
  codAvailable: false,
  lines: [],
};

/** Server-side recomputation of the checkout summary. Never trusts the client. */
export async function previewCheckoutAction(params: {
  addressId: string | null;
  paymentMode: PaymentMode;
  couponCode?: string | null;
}): Promise<CheckoutPreview> {
  const session = await auth();
  if (!session?.user?.id) return { ...EMPTY, error: "Please sign in." };
  const userId = session.user.id;

  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      items: { where: { savedForLater: false }, select: { variantId: true, quantity: true } },
    },
  });
  const priced = await priceCartItems(cart?.items ?? []);
  if (priced.lines.length === 0) return { ...EMPTY, error: "Your cart is empty." };

  let buyerState = CHECKOUT_CONFIG.sellerState;
  let pincode = "";
  if (params.addressId) {
    const address = await prisma.address.findFirst({
      where: { id: params.addressId, userId },
      select: { state: true, pincode: true },
    });
    if (!address) return { ...EMPTY, error: "Address not found." };
    buyerState = address.state;
    pincode = address.pincode;
  }

  const { coupon, error: couponError } = await resolveCoupon(params.couponCode, userId);
  const totals = computeOrderTotals({
    lines: priced.lines,
    coupon,
    paymentMode: params.paymentMode,
    buyerState,
  });

  // COD eligibility is evaluated against the COD total.
  const codTotals = computeOrderTotals({
    lines: priced.lines,
    coupon,
    paymentMode: "COD",
    buyerState,
  });
  let codAvailable = true;
  let codUnavailableReason: string | undefined;
  if (pincode && !isCodServiceable(pincode)) {
    codAvailable = false;
    codUnavailableReason = "Not available for this PIN code.";
  } else if (codTotals.grandTotal > CHECKOUT_CONFIG.codMaxOrderValue) {
    codAvailable = false;
    codUnavailableReason = `Only for orders up to ₹${Math.floor(CHECKOUT_CONFIG.codMaxOrderValue / 100)}.`;
  }

  return {
    ok: true,
    couponError,
    itemsSubtotal: totals.itemsSubtotal,
    discountTotal: totals.discountTotal,
    shippingTotal: totals.shippingTotal,
    codCharge: totals.codCharge,
    grandTotal: totals.grandTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    itemCount: priced.itemCount,
    codAvailable,
    codUnavailableReason,
    lines: priced.lines.map((l) => ({
      variantId: l.variantId,
      title: l.title,
      label: l.label,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
      imageUrl: l.imageUrl,
    })),
  };
}

export type PlaceOrderResult =
  | { ok: false; error: string }
  | { ok: true; mode: "COD"; orderNumber: string }
  | {
      ok: true;
      mode: "RAZORPAY";
      orderId: string;
      orderNumber: string;
      razorpayOrderId: string;
      amount: number;
      keyId: string;
      name: string;
      prefill: { name: string; email: string; contact: string };
    };

export async function placeOrderAction(params: {
  addressId: string;
  paymentMode: PaymentMode;
  couponCode?: string | null;
}): Promise<PlaceOrderResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  const userId = session.user.id;

  const limit = rateLimit(`checkout:${userId}`, 10, 60_000);
  if (!limit.ok) {
    return { ok: false, error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` };
  }

  try {
    const order = await createPendingOrder({
      userId,
      addressId: params.addressId,
      paymentMode: params.paymentMode,
      couponCode: params.couponCode,
    });

    if (params.paymentMode === "COD") {
      await confirmOrder({
        orderId: order.id,
        payment: { provider: "COD", status: "COD_PENDING" },
      });
      try {
        await sendOrderConfirmationEmail(order.id);
      } catch (e) {
        console.error("Order confirmation email failed", e);
      }
      return { ok: true, mode: "COD", orderNumber: order.orderNumber };
    }

    if (!isRazorpayConfigured()) {
      return {
        ok: false,
        error: "Online payment isn't configured yet. Please choose Cash on Delivery.",
      };
    }

    // Amount comes from the server-computed order total, never the client.
    const rzpOrder = await createRazorpayOrder({
      amountPaise: order.grandTotal,
      receipt: order.orderNumber,
      notes: { orderId: order.id, orderNumber: order.orderNumber },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { razorpayOrderId: rzpOrder.id },
    });
    await prisma.payment.upsert({
      where: { orderId: order.id },
      update: { razorpayOrderId: rzpOrder.id, status: "CREATED" },
      create: {
        orderId: order.id,
        provider: "RAZORPAY",
        status: "CREATED",
        amount: order.grandTotal,
        currency: "INR",
        razorpayOrderId: rzpOrder.id,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true },
    });

    return {
      ok: true,
      mode: "RAZORPAY",
      orderId: order.id,
      orderNumber: order.orderNumber,
      razorpayOrderId: rzpOrder.id,
      amount: order.grandTotal,
      keyId: razorpayPublicKeyId(),
      name: process.env.NEXT_PUBLIC_STORE_NAME ?? "BharatCart",
      prefill: {
        name: user?.name ?? order.shipFullName,
        email: user?.email ?? "",
        contact: user?.phone ?? order.shipPhone,
      },
    };
  } catch (err) {
    if (err instanceof CheckoutError) return { ok: false, error: err.message };
    console.error("placeOrderAction failed", err);
    return { ok: false, error: "Could not place your order. Please try again." };
  }
}

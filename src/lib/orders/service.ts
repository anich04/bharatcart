import { randomBytes } from "node:crypto";
import { Prisma, type PaymentMode, type PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { priceCartItems, type CartInput } from "@/lib/cart/pricing";
import { computeOrderTotals, type CouponLike } from "@/lib/checkout/totals";
import { CHECKOUT_CONFIG, isCodServiceable } from "@/lib/checkout/config";

export class CheckoutError extends Error {}
export class InsufficientStockError extends CheckoutError {}

function orderNumber(): string {
  const year = new Date().getFullYear();
  const rand = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `BC-${year}-${rand}`;
}

function invoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `INV-${year}-${rand}`;
}

/** Load and validate a coupon for a given user. Returns null if not usable. */
export async function resolveCoupon(
  code: string | null | undefined,
  userId: string,
): Promise<{ coupon: CouponLike | null; error?: string }> {
  if (!code) return { coupon: null };

  const c = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!c || !c.isActive) return { coupon: null, error: "Invalid coupon code." };

  const now = new Date();
  if (c.startsAt && c.startsAt > now)
    return { coupon: null, error: "This coupon isn't active yet." };
  if (c.expiresAt && c.expiresAt < now) return { coupon: null, error: "This coupon has expired." };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) {
    return { coupon: null, error: "This coupon has reached its usage limit." };
  }
  if (c.perUserLimit !== null) {
    const used = await prisma.couponRedemption.count({
      where: { couponId: c.id, userId },
    });
    if (used >= c.perUserLimit) {
      return { coupon: null, error: "You've already used this coupon." };
    }
  }

  return {
    coupon: {
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      minOrderValue: c.minOrderValue,
      maxDiscount: c.maxDiscount,
    },
  };
}

/**
 * Create a PENDING order from the user's cart.
 * Every money value is recomputed here from the database.
 */
export async function createPendingOrder(params: {
  userId: string;
  addressId: string;
  paymentMode: PaymentMode;
  couponCode?: string | null;
}) {
  const { userId, addressId, paymentMode } = params;

  // Ownership: the address must belong to this user.
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });
  if (!address) throw new CheckoutError("Delivery address not found.");

  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      items: { where: { savedForLater: false }, select: { variantId: true, quantity: true } },
    },
  });
  const cartItems: CartInput[] = cart?.items ?? [];
  if (cartItems.length === 0) throw new CheckoutError("Your cart is empty.");

  const priced = await priceCartItems(cartItems);
  const sellable = priced.lines.filter((l) => l.inStock && l.quantity > 0);
  if (sellable.length === 0) throw new CheckoutError("No items in your cart are available.");
  if (priced.lines.some((l) => !l.inStock)) {
    throw new CheckoutError("Some items went out of stock. Please review your cart.");
  }

  const { coupon, error: couponError } = await resolveCoupon(params.couponCode, userId);
  if (couponError) throw new CheckoutError(couponError);

  const totals = computeOrderTotals({
    lines: priced.lines,
    coupon,
    paymentMode,
    buyerState: address.state,
  });

  if (paymentMode === "COD") {
    if (!isCodServiceable(address.pincode)) {
      throw new CheckoutError("Cash on Delivery isn't available for this PIN code.");
    }
    if (totals.grandTotal > CHECKOUT_CONFIG.codMaxOrderValue) {
      throw new CheckoutError(
        `Cash on Delivery is only available on orders up to ₹${Math.floor(
          CHECKOUT_CONFIG.codMaxOrderValue / 100,
        )}.`,
      );
    }
  }

  if (totals.grandTotal <= 0) throw new CheckoutError("Order total must be greater than zero.");

  // Create the order with full snapshots.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.order.create({
        data: {
          orderNumber: orderNumber(),
          userId,
          status: "PENDING",
          paymentMode,
          shipFullName: address.fullName,
          shipPhone: address.phone,
          shipLine1: address.line1,
          shipLine2: address.line2,
          shipLandmark: address.landmark,
          shipCity: address.city,
          shipState: address.state,
          shipPincode: address.pincode,
          shipCountry: address.country,
          itemsSubtotal: totals.itemsSubtotal,
          discountTotal: totals.discountTotal,
          shippingTotal: totals.shippingTotal,
          codCharge: totals.codCharge,
          grandTotal: totals.grandTotal,
          taxableTotal: totals.taxableTotal,
          cgstTotal: totals.cgstTotal,
          sgstTotal: totals.sgstTotal,
          igstTotal: totals.igstTotal,
          placeOfSupply: address.state,
          sellerGstin: CHECKOUT_CONFIG.sellerGstin,
          couponId: coupon?.id ?? null,
          couponCode: coupon?.code ?? null,
          items: {
            create: totals.lines.map((l) => ({
              variantId: l.variantId,
              productId: l.productId,
              productTitle: l.productTitle,
              variantLabel: l.variantLabel,
              sku: l.sku,
              imageUrl: l.imageUrl,
              unitPrice: l.unitPrice,
              mrp: l.mrp,
              quantity: l.quantity,
              lineSubtotal: l.lineSubtotal,
              hsnCode: l.hsnCode,
              gstRate: l.gstRate,
              taxableValue: l.taxableValue,
              cgst: l.cgst,
              sgst: l.sgst,
              igst: l.igst,
            })),
          },
        },
        include: { items: true },
      });
    } catch (err) {
      // Retry only on an order-number collision.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        attempt < 4
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new CheckoutError("Could not create order. Please try again.");
}

/**
 * Confirm an order: decrement stock and mark it CONFIRMED, atomically.
 *
 * - IDEMPOTENT: a non-PENDING order returns { alreadyProcessed: true } without
 *   touching stock, so repeated webhook deliveries are safe.
 * - RACE-SAFE: stock is decremented with a conditional update
 *   (`stock >= quantity`); if two buyers race for the last unit, exactly one
 *   update matches and the loser's transaction aborts.
 */
export async function confirmOrder(params: {
  orderId: string;
  payment: {
    provider: "RAZORPAY" | "COD";
    status: PaymentStatus;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    razorpaySignature?: string | null;
    method?: string | null;
  };
}): Promise<{ alreadyProcessed: boolean; orderId: string }> {
  const { orderId, payment } = params;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new CheckoutError("Order not found.");

    if (order.status !== "PENDING") {
      return { alreadyProcessed: true, orderId };
    }

    // Atomic, race-safe stock decrement.
    for (const item of order.items) {
      if (!item.variantId) continue;
      const res = await tx.productVariant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (res.count !== 1) {
        throw new InsufficientStockError(
          `Insufficient stock for ${item.productTitle} (${item.variantLabel}).`,
        );
      }
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        invoiceNumber: invoiceNumber(),
        invoiceDate: new Date(),
        razorpayOrderId: payment.razorpayOrderId ?? order.razorpayOrderId,
      },
    });

    await tx.payment.upsert({
      where: { orderId },
      update: {
        status: payment.status,
        razorpayPaymentId: payment.razorpayPaymentId ?? undefined,
        razorpaySignature: payment.razorpaySignature ?? undefined,
        method: payment.method ?? undefined,
        capturedAt: payment.status === "CAPTURED" ? new Date() : undefined,
      },
      create: {
        orderId,
        provider: payment.provider,
        status: payment.status,
        amount: order.grandTotal,
        currency: "INR",
        razorpayOrderId: payment.razorpayOrderId ?? order.razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId ?? null,
        razorpaySignature: payment.razorpaySignature ?? null,
        method: payment.method ?? null,
        capturedAt: payment.status === "CAPTURED" ? new Date() : null,
      },
    });

    // Record coupon usage once, on confirmation.
    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      });
      await tx.couponRedemption.create({
        data: {
          couponId: order.couponId,
          userId: order.userId,
          orderId: order.id,
          amount: order.discountTotal,
        },
      });
    }

    // Clear the purchased items from the user's cart.
    const variantIds = order.items.map((i) => i.variantId).filter((v): v is string => !!v);
    if (variantIds.length > 0) {
      const cart = await tx.cart.findUnique({
        where: { userId: order.userId },
        select: { id: true },
      });
      if (cart) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id, variantId: { in: variantIds } },
        });
      }
    }

    return { alreadyProcessed: false, orderId };
  });
}

/** Mark a payment as failed. The order stays PENDING so it can be retried. */
export async function markPaymentFailed(params: {
  orderId: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  method?: string | null;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: { id: true, grandTotal: true, status: true },
  });
  if (!order || order.status !== "PENDING") return;

  await prisma.payment.upsert({
    where: { orderId: order.id },
    update: {
      status: "FAILED",
      razorpayPaymentId: params.razorpayPaymentId ?? undefined,
      method: params.method ?? undefined,
    },
    create: {
      orderId: order.id,
      provider: "RAZORPAY",
      status: "FAILED",
      amount: order.grandTotal,
      currency: "INR",
      razorpayOrderId: params.razorpayOrderId ?? null,
      razorpayPaymentId: params.razorpayPaymentId ?? null,
      method: params.method ?? null,
    },
  });
}

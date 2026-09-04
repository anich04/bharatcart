"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAction, ForbiddenError } from "@/lib/admin/guard";
import { sendShippingEmail } from "@/lib/orders/emails";
import { createRazorpayRefund } from "@/lib/razorpay";

type Result = { ok: boolean; error?: string };

/** Allowed status transitions. Keeps the lifecycle sane and auditable. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED", "REFUNDED"],
  PACKED: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: ["REFUNDED"],
  REFUNDED: [],
};

/** Statuses after which stock has been decremented and must be returned. */
const STOCK_HELD: OrderStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];

const statusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
    "REFUNDED",
  ]),
});

export async function updateOrderStatusAction(input: {
  orderId: string;
  status: OrderStatus;
}): Promise<Result> {
  try {
    await requireAdminAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Forbidden" };
    throw e;
  }

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { orderId, status } = parsed.data;

  try {
    const shouldEmail = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new Error("Order not found");

      if (!TRANSITIONS[order.status].includes(status)) {
        throw new Error(`Cannot move an order from ${order.status} to ${status}.`);
      }

      // Returning stock when an order is cancelled or returned.
      const releasingStock =
        (status === "CANCELLED" || status === "RETURNED") && STOCK_HELD.includes(order.status);
      if (releasingStock) {
        for (const item of order.items) {
          if (!item.variantId) continue;
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      const now = new Date();
      await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          packedAt: status === "PACKED" ? now : undefined,
          shippedAt: status === "SHIPPED" ? now : undefined,
          deliveredAt: status === "DELIVERED" ? now : undefined,
          cancelledAt: status === "CANCELLED" ? now : undefined,
        },
      });

      return status === "SHIPPED";
    });

    if (shouldEmail) {
      try {
        await sendShippingEmail(orderId);
      } catch (e) {
        console.error("Shipping email failed", e);
      }
    }

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}

const trackingSchema = z.object({
  orderId: z.string().min(1),
  carrier: z.string().trim().max(80).optional().or(z.literal("")),
  trackingNumber: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function setTrackingAction(input: {
  orderId: string;
  carrier?: string;
  trackingNumber?: string;
}): Promise<Result> {
  try {
    await requireAdminAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Forbidden" };
    throw e;
  }

  const parsed = trackingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid tracking details" };

  await prisma.order.update({
    where: { id: parsed.data.orderId },
    data: {
      carrier: parsed.data.carrier || null,
      trackingNumber: parsed.data.trackingNumber || null,
    },
  });

  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true };
}

/**
 * Issue a refund through Razorpay. The webhook (refund.processed) is what
 * ultimately flips the order to REFUNDED, keeping the DB consistent with
 * Razorpay even if this call's response is lost.
 */
export async function refundOrderAction(input: {
  orderId: string;
  amountPaise?: number;
  reason?: string;
}): Promise<Result> {
  try {
    await requireAdminAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Forbidden" };
    throw e;
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { payment: true },
  });
  if (!order) return { ok: false, error: "Order not found" };

  if (order.paymentMode === "COD") {
    return { ok: false, error: "COD orders are refunded offline, not via Razorpay." };
  }
  const paymentId = order.payment?.razorpayPaymentId;
  if (!paymentId) return { ok: false, error: "No captured payment to refund." };

  const amount = input.amountPaise ?? order.grandTotal;
  if (!Number.isInteger(amount) || amount <= 0 || amount > order.grandTotal) {
    return { ok: false, error: "Invalid refund amount." };
  }

  try {
    const refund = await createRazorpayRefund({
      paymentId,
      amountPaise: amount,
      notes: { orderNumber: order.orderNumber, reason: input.reason ?? "admin_refund" },
    });

    await prisma.refund.create({
      data: {
        paymentId: order.payment!.id,
        razorpayRefundId: refund.id,
        amount,
        status: "PENDING",
        reason: input.reason ?? "Admin refund",
      },
    });

    revalidatePath(`/admin/orders/${order.id}`);
    return { ok: true };
  } catch (err) {
    console.error("Refund failed", err);
    return { ok: false, error: "Refund request failed. Check the Razorpay dashboard." };
  }
}

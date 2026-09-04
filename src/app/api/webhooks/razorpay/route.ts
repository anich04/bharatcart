import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { confirmOrder, markPaymentFailed, InsufficientStockError } from "@/lib/orders/service";
import { sendOrderConfirmationEmail } from "@/lib/orders/emails";

export const runtime = "nodejs";
// Never cache webhook deliveries.
export const dynamic = "force-dynamic";

/**
 * Razorpay webhook — the SOURCE OF TRUTH for payment state, because users
 * routinely close the tab mid-payment.
 *
 * Guarantees:
 *  - Signature verified (HMAC-SHA256 of the RAW body, timing-safe).
 *  - IDEMPOTENT: every delivery is recorded by Razorpay's event id in
 *    WebhookEvent; a duplicate delivery short-circuits, so stock is never
 *    double-decremented and orders are never duplicated.
 */
export async function POST(req: Request) {
  // Signature must be computed over the exact raw body.
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: { entity?: Record<string, unknown> };
      refund?: { entity?: Record<string, unknown> };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event ?? "unknown";
  // Razorpay sends a unique id per delivery; fall back to a deterministic key.
  const eventId =
    req.headers.get("x-razorpay-event-id") ??
    `${event}:${(payload.payload?.payment?.entity?.id as string) ?? ""}:${(payload.payload?.refund?.entity?.id as string) ?? ""}`;

  // Idempotency gate: create-once. A duplicate delivery hits the unique key.
  try {
    await prisma.webhookEvent.create({
      data: { id: eventId, event, payload: payload as object },
    });
  } catch {
    // Already seen — acknowledge without reprocessing.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    switch (event) {
      case "payment.captured": {
        const entity = payload.payload?.payment?.entity ?? {};
        const razorpayOrderId = entity.order_id as string | undefined;
        const razorpayPaymentId = entity.id as string | undefined;
        const method = (entity.method as string | undefined) ?? null;
        if (!razorpayOrderId) break;

        const order = await prisma.order.findFirst({
          where: { razorpayOrderId },
          select: { id: true, status: true },
        });
        if (!order) break;

        const result = await confirmOrder({
          orderId: order.id,
          payment: {
            provider: "RAZORPAY",
            status: "CAPTURED",
            razorpayOrderId,
            razorpayPaymentId: razorpayPaymentId ?? null,
            method,
          },
        });
        if (!result.alreadyProcessed) {
          try {
            await sendOrderConfirmationEmail(order.id);
          } catch (e) {
            console.error("Order confirmation email failed", e);
          }
        }
        break;
      }

      case "payment.failed": {
        const entity = payload.payload?.payment?.entity ?? {};
        const razorpayOrderId = entity.order_id as string | undefined;
        if (!razorpayOrderId) break;
        const order = await prisma.order.findFirst({
          where: { razorpayOrderId },
          select: { id: true },
        });
        if (!order) break;
        await markPaymentFailed({
          orderId: order.id,
          razorpayOrderId,
          razorpayPaymentId: (entity.id as string | undefined) ?? null,
          method: (entity.method as string | undefined) ?? null,
        });
        break;
      }

      case "refund.processed": {
        const entity = payload.payload?.refund?.entity ?? {};
        const razorpayPaymentId = entity.payment_id as string | undefined;
        const refundId = entity.id as string | undefined;
        const amount = Number(entity.amount ?? 0);
        if (!razorpayPaymentId) break;

        const payment = await prisma.payment.findUnique({
          where: { razorpayPaymentId },
          select: { id: true, orderId: true, amount: true },
        });
        if (!payment) break;

        await prisma.refund.upsert({
          where: { razorpayRefundId: refundId ?? `${payment.id}-refund` },
          update: { status: "PROCESSED", amount },
          create: {
            paymentId: payment.id,
            razorpayRefundId: refundId ?? null,
            amount,
            status: "PROCESSED",
            reason: "Razorpay refund.processed",
          },
        });

        const fullyRefunded = amount >= payment.amount;
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
        });
        if (fullyRefunded) {
          await prisma.order.update({
            where: { id: payment.orderId },
            data: { status: "REFUNDED" },
          });
        }
        break;
      }

      default:
        break;
    }

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      console.error("Webhook: stock shortfall after payment", err.message);
      // Acknowledge so Razorpay stops retrying; an admin must refund.
      return NextResponse.json({ ok: true, warning: "stock_shortfall" });
    }
    console.error("Razorpay webhook processing failed", err);
    // Release the idempotency key so Razorpay's retry can reprocess this event
    // (otherwise the retry would be swallowed as a duplicate and lost).
    await prisma.webhookEvent.delete({ where: { id: eventId } }).catch(() => undefined);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

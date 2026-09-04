import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyPaymentSignature, fetchRazorpayPayment } from "@/lib/razorpay";
import { confirmOrder, InsufficientStockError } from "@/lib/orders/service";
import { sendOrderConfirmationEmail } from "@/lib/orders/emails";

export const runtime = "nodejs";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(3),
  razorpay_payment_id: z.string().min(3),
  razorpay_signature: z.string().min(3),
});

/**
 * Client posts the Razorpay Checkout handler response here.
 *
 * An order is NEVER marked paid on the strength of this callback alone — the
 * HMAC signature is verified server-side (timing-safe) before confirming, and
 * the webhook remains the source of truth for orders where the user closed the
 * tab mid-payment.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  if (
    !verifyPaymentSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      signature: razorpay_signature,
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Signature verification failed" },
      { status: 400 },
    );
  }

  // Ownership: the order must belong to the signed-in user.
  const order = await prisma.order.findFirst({
    where: { razorpayOrderId: razorpay_order_id, userId: session.user.id },
    select: { id: true, orderNumber: true, status: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  let method: string | null = null;
  try {
    const payment = await fetchRazorpayPayment(razorpay_payment_id);
    method = payment.method ?? null;
  } catch {
    // Non-fatal: the webhook will fill in the method later.
  }

  try {
    const result = await confirmOrder({
      orderId: order.id,
      payment: {
        provider: "RAZORPAY",
        status: "CAPTURED",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
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

    return NextResponse.json({ ok: true, orderNumber: order.orderNumber });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      // Payment succeeded but stock ran out — flag for a refund by an admin.
      console.error("Stock shortfall after payment", order.orderNumber, err.message);
      return NextResponse.json(
        {
          ok: false,
          error: "Item went out of stock. Our team will refund you.",
          orderNumber: order.orderNumber,
        },
        { status: 409 },
      );
    }
    console.error("Payment verification failed", err);
    return NextResponse.json({ ok: false, error: "Could not confirm order" }, { status: 500 });
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay integration via the REST API (no SDK dependency).
 *
 * SECURITY:
 *  - KEY_SECRET and WEBHOOK_SECRET are server-only and must never be sent to
 *    the browser. Only RAZORPAY_KEY_ID (public key id) may reach the client.
 *  - Card details are never received, logged or stored by this app — Razorpay
 *    Checkout collects them directly.
 */
const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

const API = "https://api.razorpay.com/v1";

export function isRazorpayConfigured(): boolean {
  return Boolean(KEY_ID && KEY_SECRET);
}

export function razorpayPublicKeyId(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? KEY_ID;
}

function authHeader(): string {
  return "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
}

/** Constant-time compare of two hex digests. */
function safeEqualHex(expected: string, received: string | null | undefined): boolean {
  if (!received) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
};

/**
 * Create a Razorpay order. `amountPaise` MUST be the server-computed total —
 * never a value supplied by the client.
 */
export async function createRazorpayOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  }
  if (!Number.isInteger(params.amountPaise) || params.amountPaise <= 0) {
    throw new Error("Razorpay amount must be a positive integer in paise.");
  }

  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes ?? {},
      payment_capture: 1,
    }),
  });

  if (!res.ok) {
    throw new Error(`Razorpay order creation failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Verify the Checkout handler response:
 *   HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
 * compared timing-safely against razorpay_signature.
 */
export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  if (!KEY_SECRET) return false;
  const expected = createHmac("sha256", KEY_SECRET)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest("hex");
  return safeEqualHex(expected, params.signature);
}

/** Verify a webhook delivery: HMAC_SHA256(rawBody, WEBHOOK_SECRET). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export async function fetchRazorpayPayment(paymentId: string): Promise<{
  id: string;
  status: string;
  method?: string;
  amount: number;
  order_id: string;
}> {
  const res = await fetch(`${API}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) throw new Error(`Razorpay payment fetch failed: ${res.status}`);
  return res.json();
}

/** Issue a refund (full or partial). Amount in paise. */
export async function createRazorpayRefund(params: {
  paymentId: string;
  amountPaise?: number;
  notes?: Record<string, string>;
}): Promise<{ id: string; status: string; amount: number }> {
  const res = await fetch(`${API}/payments/${params.paymentId}/refund`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(params.amountPaise ? { amount: params.amountPaise } : {}),
      notes: params.notes ?? {},
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay refund failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

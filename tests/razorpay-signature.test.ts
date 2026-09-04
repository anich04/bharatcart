import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";

const SECRET = "test_secret_key";

// The module reads secrets at import time, so set them first.
beforeAll(() => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
  process.env.RAZORPAY_KEY_SECRET = SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
});

async function loadModule() {
  process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
  process.env.RAZORPAY_KEY_SECRET = SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  return import("@/lib/razorpay");
}

describe("Razorpay payment signature verification", () => {
  it("accepts a correctly signed payload", async () => {
    const { verifyPaymentSignature } = await loadModule();
    const orderId = "order_ABC123";
    const paymentId = "pay_XYZ789";
    const signature = createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");

    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature,
      }),
    ).toBe(true);
  });

  it("rejects a tampered amount/order id", async () => {
    const { verifyPaymentSignature } = await loadModule();
    const signature = createHmac("sha256", SECRET).update("order_ABC123|pay_XYZ789").digest("hex");

    // Attacker swaps the order id but reuses the signature.
    expect(
      verifyPaymentSignature({
        razorpayOrderId: "order_EVIL",
        razorpayPaymentId: "pay_XYZ789",
        signature,
      }),
    ).toBe(false);
  });

  it("rejects a wrong-length / garbage signature", async () => {
    const { verifyPaymentSignature } = await loadModule();
    for (const sig of ["", "abc", "0".repeat(64), "z".repeat(64)]) {
      expect(
        verifyPaymentSignature({
          razorpayOrderId: "order_ABC123",
          razorpayPaymentId: "pay_XYZ789",
          signature: sig,
        }),
      ).toBe(false);
    }
  });

  it("rejects a signature made with a different secret", async () => {
    const { verifyPaymentSignature } = await loadModule();
    const signature = createHmac("sha256", "other_secret")
      .update("order_ABC123|pay_XYZ789")
      .digest("hex");
    expect(
      verifyPaymentSignature({
        razorpayOrderId: "order_ABC123",
        razorpayPaymentId: "pay_XYZ789",
        signature,
      }),
    ).toBe(false);
  });
});

describe("Razorpay webhook signature verification", () => {
  it("accepts a body signed with the webhook secret", async () => {
    const { verifyWebhookSignature } = await loadModule();
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });

  it("rejects when the body is modified after signing", async () => {
    const { verifyWebhookSignature } = await loadModule();
    const body = JSON.stringify({ event: "payment.captured", amount: 100 });
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    const tampered = JSON.stringify({ event: "payment.captured", amount: 999999 });
    expect(verifyWebhookSignature(tampered, sig)).toBe(false);
  });

  it("rejects a missing signature header", async () => {
    const { verifyWebhookSignature } = await loadModule();
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });
});

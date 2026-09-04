"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import type { PaymentMode } from "@prisma/client";
import {
  previewCheckoutAction,
  placeOrderAction,
  type CheckoutPreview,
} from "@/lib/actions/checkout";
import { useCart } from "@/components/cart/cart-provider";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";

export type CheckoutAddress = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme?: { color: string };
  handler: (r: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export function CheckoutClient({ addresses }: { addresses: CheckoutAddress[] }) {
  const router = useRouter();
  const { refresh } = useCart();

  const [addressId, setAddressId] = useState<string | null>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("PREPAID");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const loadPreview = useCallback(async () => {
    const p = await previewCheckoutAction({ addressId, paymentMode, couponCode: appliedCoupon });
    setPreview(p);
    if (p.couponError) setAppliedCoupon(null);
  }, [addressId, paymentMode, appliedCoupon]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // If COD becomes unavailable while selected, fall back to prepaid.
  useEffect(() => {
    if (paymentMode === "COD" && preview && !preview.codAvailable) setPaymentMode("PREPAID");
  }, [preview, paymentMode]);

  const placeOrder = async () => {
    if (!addressId) return;
    setPlacing(true);
    setError(null);

    const res = await placeOrderAction({ addressId, paymentMode, couponCode: appliedCoupon });

    if (!res.ok) {
      setError(res.error);
      setPlacing(false);
      await loadPreview();
      return;
    }

    if (res.mode === "COD") {
      await refresh();
      router.push(`/order/confirmation/${res.orderNumber}`);
      return;
    }

    // Prepaid — open Razorpay Checkout.
    if (!window.Razorpay) {
      setError("Payment library failed to load. Please refresh and try again.");
      setPlacing(false);
      return;
    }

    const rzp = new window.Razorpay({
      key: res.keyId,
      amount: res.amount,
      currency: "INR",
      name: res.name,
      order_id: res.razorpayOrderId,
      prefill: res.prefill,
      theme: { color: "#4f46e5" },
      handler: async (response) => {
        try {
          const verify = await fetch("/api/checkout/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const data = await verify.json();
          if (verify.ok && data.ok) {
            await refresh();
            router.push(`/order/confirmation/${data.orderNumber}`);
          } else {
            setError(data.error ?? "We couldn't confirm your payment. We'll email you shortly.");
            setPlacing(false);
          }
        } catch {
          setError("We couldn't confirm your payment. If money was debited, we'll email you.");
          setPlacing(false);
        }
      },
      modal: {
        ondismiss: () => {
          setPlacing(false);
          setError("Payment cancelled. Your order is saved and can be retried from your orders.");
        },
      },
    });
    rzp.open();
  };

  if (addresses.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed p-10 text-center">
        <p className="text-muted-foreground text-sm">
          Add a delivery address to continue to checkout.
        </p>
        <Link
          href="/account/addresses"
          className="bg-primary text-primary-foreground mt-4 inline-flex rounded-md px-4 py-2 text-sm font-medium"
        >
          Add an address
        </Link>
      </div>
    );
  }

  const row = "flex justify-between text-sm";

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptReady(true)}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {/* 1. Address */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">1. Delivery address</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    "cursor-pointer rounded-lg border p-3 text-sm",
                    addressId === a.id ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="address"
                    className="sr-only"
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                  />
                  <p className="font-medium">{a.fullName}</p>
                  <p className="text-muted-foreground text-xs">{a.phone}</p>
                  <p className="text-muted-foreground text-xs">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} — {a.pincode}
                  </p>
                </label>
              ))}
            </div>
            <Link
              href="/account/addresses"
              className="text-primary mt-2 inline-block text-xs hover:underline"
            >
              + Manage addresses
            </Link>
          </section>

          {/* 2. Payment */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">2. Payment method</h2>
            <div className="flex flex-col gap-2">
              <label
                className={cn(
                  "cursor-pointer rounded-lg border p-3 text-sm",
                  paymentMode === "PREPAID" ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <input
                  type="radio"
                  name="mode"
                  className="sr-only"
                  checked={paymentMode === "PREPAID"}
                  onChange={() => setPaymentMode("PREPAID")}
                />
                <span className="font-medium">Pay online</span>
                <span className="text-muted-foreground block text-xs">
                  UPI, cards, net banking &amp; wallets via Razorpay
                </span>
              </label>

              <label
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  !preview?.codAvailable
                    ? "border-border cursor-not-allowed opacity-60"
                    : paymentMode === "COD"
                      ? "border-primary bg-primary/5 cursor-pointer"
                      : "border-border cursor-pointer",
                )}
              >
                <input
                  type="radio"
                  name="mode"
                  className="sr-only"
                  disabled={!preview?.codAvailable}
                  checked={paymentMode === "COD"}
                  onChange={() => setPaymentMode("COD")}
                />
                <span className="font-medium">Cash on Delivery</span>
                <span className="text-muted-foreground block text-xs">
                  {preview?.codAvailable
                    ? `Extra handling fee applies`
                    : (preview?.codUnavailableReason ?? "Unavailable")}
                </span>
              </label>
            </div>
          </section>

          {/* 3. Coupon */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">3. Coupon</h2>
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Coupon code"
                className="border-input bg-background h-10 w-48 rounded-md border px-3 text-sm"
              />
              <button
                onClick={() => setAppliedCoupon(couponInput.trim() || null)}
                className="border-input hover:bg-muted h-10 rounded-md border px-4 text-sm"
              >
                Apply
              </button>
              {appliedCoupon && (
                <button
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput("");
                  }}
                  className="text-muted-foreground h-10 text-xs hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            {preview?.couponError && (
              <p className="text-destructive mt-2 text-xs">{preview.couponError}</p>
            )}
            {appliedCoupon && !preview?.couponError && (preview?.discountTotal ?? 0) > 0 && (
              <p className="mt-2 text-xs text-green-700 dark:text-green-500">
                Coupon {appliedCoupon} applied.
              </p>
            )}
          </section>
        </div>

        {/* Summary */}
        <aside className="border-border bg-card h-fit rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">Order summary</h2>

          {preview?.ok ? (
            <>
              <div className="mb-3 flex flex-col gap-1.5">
                <div className={row}>
                  <span className="text-muted-foreground">Items ({preview.itemCount})</span>
                  <span>{formatPaise(preview.itemsSubtotal)}</span>
                </div>
                {preview.discountTotal > 0 && (
                  <div className={row}>
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-green-700 dark:text-green-500">
                      −{formatPaise(preview.discountTotal)}
                    </span>
                  </div>
                )}
                <div className={row}>
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {preview.shippingTotal === 0 ? "Free" : formatPaise(preview.shippingTotal)}
                  </span>
                </div>
                {preview.codCharge > 0 && (
                  <div className={row}>
                    <span className="text-muted-foreground">COD fee</span>
                    <span>{formatPaise(preview.codCharge)}</span>
                  </div>
                )}
                <div className="border-border mt-2 flex justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>{formatPaise(preview.grandTotal)}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Inclusive of GST{" "}
                  {preview.igstTotal > 0
                    ? `(IGST ${formatPaise(preview.igstTotal)})`
                    : `(CGST ${formatPaise(preview.cgstTotal)} + SGST ${formatPaise(preview.sgstTotal)})`}
                </p>
              </div>

              {error && (
                <p className="bg-destructive/10 text-destructive mb-3 rounded-md px-3 py-2 text-xs">
                  {error}
                </p>
              )}

              <button
                onClick={placeOrder}
                disabled={placing || !addressId || (paymentMode === "PREPAID" && !scriptReady)}
                className="bg-primary text-primary-foreground h-11 w-full rounded-md text-sm font-medium disabled:opacity-60"
              >
                {placing
                  ? "Processing…"
                  : paymentMode === "COD"
                    ? "Place order (COD)"
                    : `Pay ${formatPaise(preview.grandTotal)}`}
              </button>
              <p className="text-muted-foreground mt-2 text-center text-[11px]">
                Card details are handled by Razorpay and never touch our servers.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">{preview?.error ?? "Loading…"}</p>
          )}
        </aside>
      </div>
    </>
  );
}

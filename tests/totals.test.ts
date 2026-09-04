import { describe, it, expect } from "vitest";
import type { PricedLine } from "@/lib/cart/pricing";
import { computeOrderTotals, computeDiscount, type CouponLike } from "@/lib/checkout/totals";

function line(overrides: Partial<PricedLine> = {}): PricedLine {
  const unitPrice = overrides.unitPrice ?? 100000; // ₹1,000
  const quantity = overrides.quantity ?? 1;
  return {
    variantId: overrides.variantId ?? "v1",
    productId: "p1",
    slug: "p",
    title: "Product",
    brandName: null,
    label: "Default",
    sku: "SKU1",
    imageUrl: null,
    unitPrice,
    mrp: unitPrice,
    quantity,
    requestedQuantity: quantity,
    lineTotal: unitPrice * quantity,
    stock: 10,
    inStock: true,
    gstRate: "EIGHTEEN",
    hsnCode: "1234",
    ...overrides,
  };
}

describe("computeDiscount", () => {
  const percent: CouponLike = {
    id: "c1",
    code: "SAVE10",
    type: "PERCENT",
    value: 1000, // 10%
    minOrderValue: 0,
    maxDiscount: null,
  };

  it("returns 0 with no coupon", () => {
    expect(computeDiscount(100000, null)).toBe(0);
  });

  it("applies a percentage in basis points", () => {
    expect(computeDiscount(100000, percent)).toBe(10000);
  });

  it("respects the maximum discount cap", () => {
    expect(computeDiscount(100000, { ...percent, maxDiscount: 5000 })).toBe(5000);
  });

  it("does not apply below the minimum order value", () => {
    expect(computeDiscount(9900, { ...percent, minOrderValue: 10000 })).toBe(0);
    expect(computeDiscount(10000, { ...percent, minOrderValue: 10000 })).toBe(1000);
  });

  it("applies a flat discount in paise", () => {
    const flat: CouponLike = { ...percent, type: "FLAT", value: 25000 };
    expect(computeDiscount(100000, flat)).toBe(25000);
  });

  it("never discounts more than the subtotal", () => {
    const flat: CouponLike = { ...percent, type: "FLAT", value: 999999 };
    expect(computeDiscount(50000, flat)).toBe(50000);
  });

  it("never returns a negative discount", () => {
    const weird: CouponLike = { ...percent, type: "FLAT", value: -500 };
    expect(computeDiscount(50000, weird)).toBe(0);
  });
});

describe("computeOrderTotals", () => {
  it("charges flat shipping below the free-shipping threshold", () => {
    const t = computeOrderTotals({
      lines: [line({ unitPrice: 10000 })], // ₹100
      coupon: null,
      paymentMode: "PREPAID",
      buyerState: "Karnataka",
    });
    expect(t.itemsSubtotal).toBe(10000);
    expect(t.shippingTotal).toBe(4900);
    expect(t.grandTotal).toBe(14900);
  });

  it("gives free shipping at or above the threshold", () => {
    const t = computeOrderTotals({
      lines: [line({ unitPrice: 49900 })],
      coupon: null,
      paymentMode: "PREPAID",
      buyerState: "Karnataka",
    });
    expect(t.shippingTotal).toBe(0);
    expect(t.grandTotal).toBe(49900);
  });

  it("adds the COD surcharge only for COD", () => {
    const prepaid = computeOrderTotals({
      lines: [line({ unitPrice: 60000 })],
      coupon: null,
      paymentMode: "PREPAID",
      buyerState: "Karnataka",
    });
    const cod = computeOrderTotals({
      lines: [line({ unitPrice: 60000 })],
      coupon: null,
      paymentMode: "COD",
      buyerState: "Karnataka",
    });
    expect(prepaid.codCharge).toBe(0);
    expect(cod.codCharge).toBe(3000);
    expect(cod.grandTotal).toBe(prepaid.grandTotal + 3000);
  });

  it("uses the discounted subtotal to decide free shipping", () => {
    // ₹550 - ₹100 = ₹450, which is below the ₹499 threshold.
    const t = computeOrderTotals({
      lines: [line({ unitPrice: 55000 })],
      coupon: {
        id: "c",
        code: "F",
        type: "FLAT",
        value: 10000,
        minOrderValue: 0,
        maxDiscount: null,
      },
      paymentMode: "PREPAID",
      buyerState: "Karnataka",
    });
    expect(t.discountTotal).toBe(10000);
    expect(t.shippingTotal).toBe(4900);
    expect(t.grandTotal).toBe(55000 - 10000 + 4900);
  });

  it("splits the discount across lines so shares sum exactly to the discount", () => {
    const t = computeOrderTotals({
      lines: [
        line({ variantId: "a", unitPrice: 33333 }),
        line({ variantId: "b", unitPrice: 33333 }),
        line({ variantId: "c", unitPrice: 33334 }),
      ],
      coupon: {
        id: "c",
        code: "X",
        type: "PERCENT",
        value: 1000,
        minOrderValue: 0,
        maxDiscount: null,
      },
      paymentMode: "PREPAID",
      buyerState: "Karnataka",
    });
    const sumShares = t.lines.reduce((s, l) => s + l.discountShare, 0);
    expect(sumShares).toBe(t.discountTotal);
  });

  it("reconciles tax against the discounted total, intra-state", () => {
    const t = computeOrderTotals({
      lines: [line({ unitPrice: 118000 })],
      coupon: null,
      paymentMode: "PREPAID",
      buyerState: "Karnataka",
    });
    expect(t.interState).toBe(false);
    expect(t.igstTotal).toBe(0);
    expect(t.taxableTotal + t.cgstTotal + t.sgstTotal).toBe(t.itemsSubtotal - t.discountTotal);
  });

  it("uses IGST when the buyer is in another state", () => {
    const t = computeOrderTotals({
      lines: [line({ unitPrice: 118000 })],
      coupon: null,
      paymentMode: "PREPAID",
      buyerState: "Maharashtra",
    });
    expect(t.interState).toBe(true);
    expect(t.cgstTotal + t.sgstTotal).toBe(0);
    expect(t.taxableTotal + t.igstTotal).toBe(t.itemsSubtotal);
  });

  it("ignores out-of-stock lines entirely", () => {
    const t = computeOrderTotals({
      lines: [
        line({ variantId: "ok" }),
        line({ variantId: "oos", inStock: false, quantity: 0, lineTotal: 0 }),
      ],
      coupon: null,
      paymentMode: "PREPAID",
      buyerState: "Karnataka",
    });
    expect(t.lines).toHaveLength(1);
    expect(t.itemsSubtotal).toBe(100000);
  });

  it("keeps every money value an integer (paise)", () => {
    const t = computeOrderTotals({
      lines: [line({ unitPrice: 12345, quantity: 3 })],
      coupon: {
        id: "c",
        code: "P",
        type: "PERCENT",
        value: 777,
        minOrderValue: 0,
        maxDiscount: null,
      },
      paymentMode: "COD",
      buyerState: "Maharashtra",
    });
    for (const v of [
      t.itemsSubtotal,
      t.discountTotal,
      t.shippingTotal,
      t.codCharge,
      t.grandTotal,
      t.taxableTotal,
      t.cgstTotal,
      t.sgstTotal,
      t.igstTotal,
    ]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

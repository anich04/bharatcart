import type { GstRate, PaymentMode } from "@prisma/client";
import type { PricedLine } from "@/lib/cart/pricing";
import { CHECKOUT_CONFIG } from "./config";
import { splitInclusiveGst, isInterState } from "./tax";

export type CouponLike = {
  id: string;
  code: string;
  type: "PERCENT" | "FLAT";
  value: number; // PERCENT: basis points; FLAT: paise
  minOrderValue: number;
  maxDiscount: number | null;
};

export type TotalsLine = {
  variantId: string;
  productId: string;
  productTitle: string;
  variantLabel: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  mrp: number;
  quantity: number;
  lineSubtotal: number; // inclusive, before discount
  discountShare: number; // proportional coupon discount for this line
  gstRate: GstRate;
  hsnCode: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export type OrderTotals = {
  lines: TotalsLine[];
  itemsSubtotal: number;
  discountTotal: number;
  shippingTotal: number;
  codCharge: number;
  grandTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  interState: boolean;
};

/** Discount for a coupon against a subtotal. Returns 0 if it doesn't qualify. */
export function computeDiscount(subtotal: number, coupon: CouponLike | null): number {
  if (!coupon) return 0;
  if (subtotal < coupon.minOrderValue) return 0;

  let discount: number;
  if (coupon.type === "PERCENT") {
    discount = Math.floor((subtotal * coupon.value) / 10000);
    if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = coupon.value;
  }
  // Never discount more than the order is worth.
  return Math.max(0, Math.min(discount, subtotal));
}

/**
 * The single authoritative total calculation. Everything is recomputed from
 * DB-priced lines — no client value is ever trusted.
 *
 * Note: GST is derived on product lines only. Shipping/COD fees are charged as
 * flat amounts and are not tax-split here; confirm the treatment of shipping
 * GST with your accountant before going live.
 */
export function computeOrderTotals({
  lines,
  coupon,
  paymentMode,
  buyerState,
}: {
  lines: PricedLine[];
  coupon: CouponLike | null;
  paymentMode: PaymentMode;
  buyerState: string;
}): OrderTotals {
  const sellable = lines.filter((l) => l.inStock && l.quantity > 0);
  const itemsSubtotal = sellable.reduce((sum, l) => sum + l.lineTotal, 0);
  const discountTotal = computeDiscount(itemsSubtotal, coupon);
  const interState = isInterState(buyerState, CHECKOUT_CONFIG.sellerState);

  // Distribute the discount proportionally, giving any rounding remainder to
  // the last line so the shares always sum exactly to discountTotal.
  const outLines: TotalsLine[] = [];
  let allocated = 0;

  sellable.forEach((l, idx) => {
    const isLast = idx === sellable.length - 1;
    const share = isLast
      ? discountTotal - allocated
      : itemsSubtotal > 0
        ? Math.floor((discountTotal * l.lineTotal) / itemsSubtotal)
        : 0;
    allocated += share;

    const discountedInclusive = l.lineTotal - share;
    const split = splitInclusiveGst(discountedInclusive, l.gstRate, interState);

    outLines.push({
      variantId: l.variantId,
      productId: l.productId,
      productTitle: l.title,
      variantLabel: l.label,
      sku: l.sku,
      imageUrl: l.imageUrl,
      unitPrice: l.unitPrice,
      mrp: l.mrp,
      quantity: l.quantity,
      lineSubtotal: l.lineTotal,
      discountShare: share,
      gstRate: l.gstRate,
      hsnCode: l.hsnCode,
      taxableValue: split.taxable,
      cgst: split.cgst,
      sgst: split.sgst,
      igst: split.igst,
    });
  });

  const afterDiscount = itemsSubtotal - discountTotal;
  const shippingTotal =
    afterDiscount >= CHECKOUT_CONFIG.freeShippingThreshold || afterDiscount === 0
      ? 0
      : CHECKOUT_CONFIG.shippingFlat;
  const codCharge = paymentMode === "COD" ? CHECKOUT_CONFIG.codSurcharge : 0;

  const grandTotal = afterDiscount + shippingTotal + codCharge;

  return {
    lines: outLines,
    itemsSubtotal,
    discountTotal,
    shippingTotal,
    codCharge,
    grandTotal,
    taxableTotal: outLines.reduce((s, l) => s + l.taxableValue, 0),
    cgstTotal: outLines.reduce((s, l) => s + l.cgst, 0),
    sgstTotal: outLines.reduce((s, l) => s + l.sgst, 0),
    igstTotal: outLines.reduce((s, l) => s + l.igst, 0),
    interState,
  };
}

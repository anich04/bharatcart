import type { GstRate } from "@prisma/client";

/** GST slab -> basis points (1800 = 18%). */
export const GST_BPS: Record<GstRate, number> = {
  ZERO: 0,
  FIVE: 500,
  TWELVE: 1200,
  EIGHTEEN: 1800,
  TWENTYEIGHT: 2800,
};

export type TaxSplit = {
  taxable: number; // paise, pre-tax value baked into the inclusive price
  cgst: number;
  sgst: number;
  igst: number;
  tax: number; // cgst + sgst + igst
};

/**
 * Indian retail prices are GST-INCLUSIVE (MRP law), so tax is DERIVED, never
 * added on top:
 *
 *   taxable = inclusive * 10000 / (10000 + bps)
 *   tax     = inclusive - taxable
 *
 * Place of supply decides the split:
 *   buyer state == seller state -> CGST + SGST (half each)
 *   buyer state != seller state -> IGST (full)
 *
 * All values are integer paise; the odd paise on an uneven split goes to SGST
 * so cgst + sgst always equals tax exactly.
 */
export function splitInclusiveGst(
  inclusivePaise: number,
  rate: GstRate,
  interState: boolean,
): TaxSplit {
  const amount = Math.max(0, Math.round(inclusivePaise));
  const bps = GST_BPS[rate];

  const taxable = Math.round((amount * 10000) / (10000 + bps));
  const tax = amount - taxable;

  if (interState) {
    return { taxable, cgst: 0, sgst: 0, igst: tax, tax };
  }
  const cgst = Math.floor(tax / 2);
  const sgst = tax - cgst;
  return { taxable, cgst, sgst, igst: 0, tax };
}

/** Normalises state names for the intra/inter-state comparison. */
export function isInterState(buyerState: string, sellerState: string): boolean {
  return buyerState.trim().toLowerCase() !== sellerState.trim().toLowerCase();
}

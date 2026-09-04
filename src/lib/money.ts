/**
 * Money helpers. ALL currency in this app is stored and computed as INTEGER
 * PAISE (₹1 = 100 paise). Never use a float for money. These helpers are the
 * only sanctioned way to convert to/from rupees and to format for display.
 */

/** Convert rupees (may be fractional) to integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert integer paise to a rupees number (for display/JSON only). */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format integer paise as an Indian-locale rupee string, e.g. 49900 -> "₹499.00". */
export function formatPaise(paise: number): string {
  return inrFormatter.format(paise / 100);
}

/** Discount percentage from MRP and selling price (both paise). Rounded to int. */
export function discountPercent(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}

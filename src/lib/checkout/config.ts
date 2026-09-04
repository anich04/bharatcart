/** Business rules for shipping, COD and GST origin. All money in PAISE. */

function intEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

export const CHECKOUT_CONFIG = {
  /** Free shipping at or above this order value (after discount). */
  freeShippingThreshold: intEnv("FREE_SHIPPING_THRESHOLD_PAISE", 49900),
  /** Flat shipping below the threshold. */
  shippingFlat: intEnv("SHIPPING_FLAT_PAISE", 4900),
  /** Extra handling fee charged on Cash-on-Delivery orders. */
  codSurcharge: intEnv("COD_SURCHARGE_PAISE", 3000),
  /** Orders above this value cannot be placed as COD. */
  codMaxOrderValue: intEnv("COD_MAX_ORDER_VALUE_PAISE", 500000),
  /** Place-of-supply origin for GST. */
  sellerState: process.env.SELLER_STATE ?? "Karnataka",
  sellerGstin: process.env.SELLER_GSTIN ?? null,
  sellerLegalName: process.env.SELLER_LEGAL_NAME ?? "BharatCart",
} as const;

/**
 * COD PIN-code serviceability.
 * Placeholder rule: all valid 6-digit Indian PINs are serviceable. Replace with
 * the courier's serviceability API (or an admin-managed allow-list) before go-live.
 */
export function isCodServiceable(pincode: string): boolean {
  return /^\d{6}$/.test(pincode.trim());
}

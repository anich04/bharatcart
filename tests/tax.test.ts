import { describe, it, expect } from "vitest";
import { splitInclusiveGst, isInterState, GST_BPS } from "@/lib/checkout/tax";

describe("GST derivation from inclusive prices", () => {
  it("splits an 18% inclusive price into taxable + CGST/SGST intra-state", () => {
    // ₹1,180.00 inclusive at 18% => ₹1,000 taxable + ₹180 tax
    const r = splitInclusiveGst(118000, "EIGHTEEN", false);
    expect(r.taxable).toBe(100000);
    expect(r.tax).toBe(18000);
    expect(r.cgst).toBe(9000);
    expect(r.sgst).toBe(9000);
    expect(r.igst).toBe(0);
  });

  it("puts the whole tax in IGST inter-state", () => {
    const r = splitInclusiveGst(118000, "EIGHTEEN", true);
    expect(r.taxable).toBe(100000);
    expect(r.igst).toBe(18000);
    expect(r.cgst).toBe(0);
    expect(r.sgst).toBe(0);
  });

  it("always reconciles: taxable + tax === inclusive", () => {
    const rates = Object.keys(GST_BPS) as (keyof typeof GST_BPS)[];
    for (const rate of rates) {
      for (const amount of [1, 7, 99, 12345, 89900, 249900, 1000001]) {
        for (const inter of [true, false]) {
          const r = splitInclusiveGst(amount, rate, inter);
          expect(r.taxable + r.tax).toBe(amount);
          expect(r.cgst + r.sgst + r.igst).toBe(r.tax);
          // No negative or fractional paise anywhere.
          for (const v of [r.taxable, r.cgst, r.sgst, r.igst]) {
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it("gives the odd paise to SGST so the halves still sum to the tax", () => {
    // Choose an amount whose tax is odd.
    const r = splitInclusiveGst(1001, "EIGHTEEN", false);
    expect(r.cgst + r.sgst).toBe(r.tax);
    expect(r.sgst - r.cgst).toBeLessThanOrEqual(1);
  });

  it("charges no tax at the ZERO slab", () => {
    const r = splitInclusiveGst(50000, "ZERO", false);
    expect(r.taxable).toBe(50000);
    expect(r.tax).toBe(0);
  });

  it("compares states case/whitespace-insensitively", () => {
    expect(isInterState("Karnataka", "karnataka")).toBe(false);
    expect(isInterState("  Karnataka ", "Karnataka")).toBe(false);
    expect(isInterState("Maharashtra", "Karnataka")).toBe(true);
  });
});

import { z } from "zod";

/**
 * Listing/search URL parameters. Filter + sort + page state lives entirely in
 * the URL query string so listings are shareable and the back button works.
 * Prices in the URL are in RUPEES (human-readable); we convert to paise for
 * queries.
 */

export const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Rating" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 12;

// Coerce a possibly-array query value to a single string.
function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Coerce to a string array (repeated query params).
function many(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

const numeric = z.coerce.number().finite().nonnegative().optional();

export type CatalogParams = {
  q?: string;
  brands: string[];
  minPriceRupees?: number;
  maxPriceRupees?: number;
  minRating?: number;
  inStock: boolean;
  sort: SortValue;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseCatalogParams(sp: RawSearchParams): CatalogParams {
  const sortRaw = one(sp.sort);
  const sort: SortValue = SORT_OPTIONS.find((o) => o.value === sortRaw)?.value ?? "relevance";

  const page = Math.max(
    1,
    z.coerce
      .number()
      .int()
      .catch(1)
      .parse(one(sp.page) ?? 1),
  );

  const minRatingRaw = numeric.catch(undefined).parse(one(sp.rating));
  const minRating = minRatingRaw !== undefined ? Math.min(5, Math.max(1, minRatingRaw)) : undefined;

  return {
    q: one(sp.q)?.trim() || undefined,
    brands: many(sp.brand),
    minPriceRupees: numeric.catch(undefined).parse(one(sp.minPrice)),
    maxPriceRupees: numeric.catch(undefined).parse(one(sp.maxPrice)),
    minRating,
    inStock: one(sp.inStock) === "1",
    sort,
    page,
  };
}

/**
 * Build a query string from a partial set of params, merged over the current
 * ones. Used by filter/sort UI and pagination to produce shareable links.
 */
export function buildQueryString(current: CatalogParams, patch: Partial<CatalogParams>): string {
  const merged = { ...current, ...patch };
  const usp = new URLSearchParams();

  if (merged.q) usp.set("q", merged.q);
  for (const b of merged.brands) usp.append("brand", b);
  if (merged.minPriceRupees !== undefined) usp.set("minPrice", String(merged.minPriceRupees));
  if (merged.maxPriceRupees !== undefined) usp.set("maxPrice", String(merged.maxPriceRupees));
  if (merged.minRating !== undefined) usp.set("rating", String(merged.minRating));
  if (merged.inStock) usp.set("inStock", "1");
  if (merged.sort !== "relevance") usp.set("sort", merged.sort);
  if (merged.page > 1) usp.set("page", String(merged.page));

  const s = usp.toString();
  return s ? `?${s}` : "";
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  SORT_OPTIONS,
  buildQueryString,
  type CatalogParams,
  type SortValue,
} from "@/lib/catalog/params";
import { cn } from "@/lib/utils";

type Brand = { id: string; name: string; slug: string };

function useNavigate(basePath: string, params: CatalogParams) {
  const router = useRouter();
  // Any filter change resets to page 1.
  return (patch: Partial<CatalogParams>) =>
    router.push(`${basePath}${buildQueryString(params, { ...patch, page: 1 })}`, {
      scroll: true,
    });
}

export function SortSelect({ basePath, params }: { basePath: string; params: CatalogParams }) {
  const navigate = useNavigate(basePath, params);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort</span>
      <select
        value={params.sort}
        onChange={(e) => navigate({ sort: e.target.value as SortValue })}
        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterPanel({
  basePath,
  params,
  brands,
}: {
  basePath: string;
  params: CatalogParams;
  brands: Brand[];
}) {
  const navigate = useNavigate(basePath, params);
  const [minPrice, setMinPrice] = useState(params.minPriceRupees?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(params.maxPriceRupees?.toString() ?? "");

  const toggleBrand = (slug: string) => {
    const next = params.brands.includes(slug)
      ? params.brands.filter((b) => b !== slug)
      : [...params.brands, slug];
    navigate({ brands: next });
  };

  const applyPrice = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      minPriceRupees: minPrice ? Number(minPrice) : undefined,
      maxPriceRupees: maxPrice ? Number(maxPrice) : undefined,
    });
  };

  const hasFilters =
    params.brands.length > 0 ||
    params.minPriceRupees !== undefined ||
    params.maxPriceRupees !== undefined ||
    params.minRating !== undefined ||
    params.inStock;

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Filters</h2>
        {hasFilters && (
          <button
            onClick={() =>
              navigate({
                brands: [],
                minPriceRupees: undefined,
                maxPriceRupees: undefined,
                minRating: undefined,
                inStock: false,
              })
            }
            className="text-primary text-xs hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Price */}
      <div>
        <h3 className="mb-2 font-medium">Price (₹)</h3>
        <form onSubmit={applyPrice} className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min"
            className="border-input bg-background h-9 w-full rounded-md border px-2"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max"
            className="border-input bg-background h-9 w-full rounded-md border px-2"
          />
          <button
            type="submit"
            className="border-border hover:bg-muted h-9 shrink-0 rounded-md border px-3 text-xs"
          >
            Go
          </button>
        </form>
      </div>

      {/* Brands */}
      {brands.length > 0 && (
        <div>
          <h3 className="mb-2 font-medium">Brand</h3>
          <div className="flex flex-col gap-1.5">
            {brands.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={params.brands.includes(b.slug)}
                  onChange={() => toggleBrand(b.slug)}
                  className="accent-primary size-4"
                />
                <span>{b.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Rating */}
      <div>
        <h3 className="mb-2 font-medium">Customer rating</h3>
        <div className="flex flex-col gap-1.5">
          {[4, 3, 2].map((r) => (
            <button
              key={r}
              onClick={() => navigate({ minRating: params.minRating === r ? undefined : r })}
              className={cn(
                "flex w-fit items-center gap-1 rounded px-1.5 py-0.5",
                params.minRating === r ? "bg-primary/10 text-primary" : "hover:bg-muted",
              )}
            >
              {r}★ &amp; up
            </button>
          ))}
        </div>
      </div>

      {/* In stock */}
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={params.inStock}
          onChange={(e) => navigate({ inStock: e.target.checked })}
          className="accent-primary size-4"
        />
        <span>In stock only</span>
      </label>
    </div>
  );
}

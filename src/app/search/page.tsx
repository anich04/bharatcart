import type { Metadata } from "next";
import { getAllBrands, searchProducts } from "@/lib/catalog/queries";
import { parseCatalogParams, type RawSearchParams } from "@/lib/catalog/params";
import { ProductGrid } from "@/components/product-grid";
import { Pagination } from "@/components/pagination";
import { FilterPanel, SortSelect } from "@/components/catalog/controls";

type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseCatalogParams(await searchParams).q;
  return { title: q ? `Search: ${q}` : "Search" };
}

export default async function SearchPage({ searchParams }: Props) {
  const parsed = parseCatalogParams(await searchParams);
  const [brands, result] = await Promise.all([
    getAllBrands(),
    parsed.q
      ? searchProducts(parsed)
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 12, totalPages: 1 }),
  ]);
  const basePath = "/search";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {parsed.q ? (
              <>
                Results for <span className="text-primary">“{parsed.q}”</span>
              </>
            ) : (
              "Search"
            )}
          </h1>
          {parsed.q && (
            <p className="text-muted-foreground text-sm">
              {result.total} {result.total === 1 ? "product" : "products"}
            </p>
          )}
        </div>
        {parsed.q && <SortSelect basePath={basePath} params={parsed} />}
      </div>

      {!parsed.q ? (
        <div className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          Type a query in the search bar to find products.
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="hidden w-56 shrink-0 lg:block">
            <FilterPanel basePath={basePath} params={parsed} brands={brands} />
          </aside>
          <details className="border-border rounded-lg border p-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-medium">Filters &amp; sort</summary>
            <div className="mt-3">
              <FilterPanel basePath={basePath} params={parsed} brands={brands} />
            </div>
          </details>

          <div className="min-w-0 flex-1">
            {result.items.length > 0 ? (
              <>
                <ProductGrid products={result.items} />
                <Pagination params={parsed} totalPages={result.totalPages} basePath={basePath} />
              </>
            ) : (
              <div className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
                No products found for “{parsed.q}”. Try a different search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

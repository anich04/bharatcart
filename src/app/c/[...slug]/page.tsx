import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllBrands, getCategoryBySlug, listProducts } from "@/lib/catalog/queries";
import { parseCatalogParams, type RawSearchParams } from "@/lib/catalog/params";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { ProductGrid } from "@/components/product-grid";
import { Pagination } from "@/components/pagination";
import { FilterPanel, SortSelect } from "@/components/catalog/controls";

type Props = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug[slug.length - 1]);
  if (!category) return { title: "Not found" };
  return {
    title: category.name,
    description: category.description ?? `Shop ${category.name}`,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const leaf = slug[slug.length - 1];

  const [category, brands] = await Promise.all([getCategoryBySlug(leaf), getAllBrands()]);
  if (!category) notFound();

  const parsed = parseCatalogParams(await searchParams);
  const result = await listProducts(parsed, leaf);
  const basePath = `/c/${slug.join("/")}`;

  const crumbs: Crumb[] = [{ label: "Home", href: "/" }];
  if (category.parent) {
    crumbs.push({ label: category.parent.name, href: `/c/${category.parent.slug}` });
  }
  crumbs.push({ label: category.name });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Breadcrumbs items={crumbs} />

      <div className="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
          <p className="text-muted-foreground text-sm">
            {result.total} {result.total === 1 ? "product" : "products"}
          </p>
        </div>
        <SortSelect basePath={basePath} params={parsed} />
      </div>

      {/* Subcategory chips */}
      {category.children.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {category.children.map((c) => (
            <a
              key={c.id}
              href={`/c/${c.slug}`}
              className="border-border hover:bg-muted rounded-full border px-3 py-1 text-sm"
            >
              {c.name}
            </a>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <FilterPanel basePath={basePath} params={parsed} brands={brands} />
        </aside>

        {/* Mobile filters */}
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
              No products match your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

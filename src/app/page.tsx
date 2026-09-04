import Link from "next/link";
import { getCategoryTree, getFeaturedProducts, getNewArrivals } from "@/lib/catalog/queries";
import { ProductCarousel } from "@/components/product-carousel";

const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? "BharatCart";

// Rendered per-request so the home page always reflects live catalog data.
// (Can be switched to ISR with `revalidate` once caching is tuned in polish.)
export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, featured, newArrivals] = await Promise.all([
    getCategoryTree(),
    getFeaturedProducts(10),
    getNewArrivals(10),
  ]);

  return (
    <div className="flex flex-col gap-10 py-6">
      {/* Hero */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <div className="from-primary/90 to-primary relative overflow-hidden rounded-xl bg-gradient-to-br px-6 py-12 sm:px-10 sm:py-16">
          <div className="text-primary-foreground max-w-xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Everyday essentials, delivered across India
            </h1>
            <p className="mt-3 text-sm opacity-90 sm:text-base">
              Fashion, home &amp; kitchen, and electronics — quality picks at honest prices,
              inclusive of GST.
            </p>
            <Link
              href="/c/fashion"
              className="text-primary mt-6 inline-flex rounded-md bg-white px-5 py-2.5 text-sm font-medium hover:bg-white/90"
            >
              Start shopping
            </Link>
          </div>
        </div>
      </section>

      {/* Category rails */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <h2 className="mb-3 text-lg font-semibold tracking-tight sm:text-xl">Shop by category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="border-border bg-card hover:border-primary/40 flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:shadow-sm"
            >
              <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full text-sm font-semibold">
                {c.name.slice(0, 1)}
              </span>
              <span className="text-sm font-medium">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && <ProductCarousel title="Featured products" products={featured} />}
      {newArrivals.length > 0 && <ProductCarousel title="New arrivals" products={newArrivals} />}

      {featured.length === 0 && newArrivals.length === 0 && (
        <section className="mx-auto w-full max-w-7xl px-4">
          <div className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
            No products yet. Run <code className="bg-muted rounded px-1">npm run db:seed</code> to
            populate the {storeName} catalog.
          </div>
        </section>
      )}
    </div>
  );
}

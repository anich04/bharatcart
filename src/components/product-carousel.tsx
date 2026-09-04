import Link from "next/link";
import type { ProductCard as ProductCardData } from "@/lib/catalog/queries";
import { ProductCard } from "./product-card";

/** Horizontal, scroll-snapping rail of product cards (no JS, mobile-friendly). */
export function ProductCarousel({
  title,
  href,
  products,
}: {
  title: string;
  href?: string;
  products: ProductCardData[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
        {href && (
          <Link href={href} className="text-primary text-sm font-medium hover:underline">
            View all
          </Link>
        )}
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:thin] gap-3 overflow-x-auto px-4 pb-2">
        {products.map((p) => (
          <div key={p.id} className="w-40 shrink-0 snap-start sm:w-48">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

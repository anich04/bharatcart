import Link from "next/link";
import type { ProductCard as ProductCardData } from "@/lib/catalog/queries";
import { ProductImage } from "./product-image";
import { Price } from "./price";
import { RatingStars } from "./rating-stars";

export function ProductCard({
  product,
  priority,
}: {
  product: ProductCardData;
  priority?: boolean;
}) {
  const image = product.images[0];
  const inStock = product.variants.length > 0;

  return (
    <Link
      href={`/p/${product.slug}`}
      className="group border-border bg-card flex flex-col overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
    >
      <div className="bg-muted relative aspect-square overflow-hidden">
        <ProductImage
          url={image?.url}
          alt={image?.alt}
          title={product.title}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
        />
        {!inStock && (
          <span className="bg-background/90 text-muted-foreground absolute top-2 left-2 rounded px-2 py-0.5 text-xs font-medium">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.brand && (
          <span className="text-muted-foreground text-xs">{product.brand.name}</span>
        )}
        <h3 className="line-clamp-2 text-sm leading-snug font-medium group-hover:underline">
          {product.title}
        </h3>
        {product.ratingCount > 0 && (
          <RatingStars value={product.ratingAverage} count={product.ratingCount} />
        )}
        <div className="mt-auto pt-1">
          <Price price={product.displayPrice} mrp={product.displayMrp} size="sm" />
        </div>
      </div>
    </Link>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Check, Truck } from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { useCart } from "@/components/cart/cart-provider";
import { WishlistButton } from "@/components/product/wishlist-button";
import { formatPaise, discountPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

type VariantOptions = Record<string, string>;

export type BuyBoxVariant = {
  id: string;
  sku: string;
  label: string;
  options: VariantOptions | null;
  price: number;
  mrp: number;
  stock: number;
};

export type BuyBoxImage = { id: string; url: string; alt: string | null; variantId: string | null };

export function ProductDetailTop({
  productId,
  title,
  brandName,
  images,
  variants,
  hasVariants,
  authed,
  initialInWishlist,
}: {
  productId: string;
  title: string;
  brandName?: string | null;
  images: BuyBoxImage[];
  variants: BuyBoxVariant[];
  hasVariants: boolean;
  authed: boolean;
  initialInWishlist: boolean;
}) {
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstInStock?.id);
  const [imageIndex, setImageIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { add, pending } = useCart();

  const selected = variants.find((v) => v.id === variantId) ?? firstInStock;

  // Derive option axes (e.g. Color, Size) from the variants.
  const axes = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const v of variants) {
      if (!v.options) continue;
      for (const [k, val] of Object.entries(v.options)) {
        const arr = map.get(k) ?? [];
        if (!arr.includes(val)) arr.push(val);
        map.set(k, arr);
      }
    }
    return [...map.entries()].map(([key, values]) => ({ key, values }));
  }, [variants]);

  const selectOption = (key: string, value: string) => {
    const target = { ...(selected?.options ?? {}), [key]: value };
    // Prefer an exact match; fall back to any variant carrying this value.
    const exact = variants.find(
      (v) => v.options && Object.entries(target).every(([k, val]) => v.options![k] === val),
    );
    const fallback = variants.find((v) => v.options?.[key] === value);
    const next = exact ?? fallback;
    if (next) {
      setVariantId(next.id);
      const imgIdx = images.findIndex((im) => im.variantId === next.id);
      if (imgIdx >= 0) setImageIndex(imgIdx);
    }
  };

  const price = selected?.price ?? 0;
  const mrp = selected?.mrp ?? 0;
  const pct = discountPercent(mrp, price);
  const inStock = (selected?.stock ?? 0) > 0;
  const lowStock = inStock && (selected?.stock ?? 0) <= 5;
  const activeImage = images[imageIndex];

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Gallery */}
      <div className="flex flex-col gap-3">
        <div className="bg-muted relative aspect-square overflow-hidden rounded-lg border">
          <ProductImage
            url={activeImage?.url}
            alt={activeImage?.alt}
            title={title}
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {images.map((im, i) => (
              <button
                key={im.id}
                onClick={() => setImageIndex(i)}
                className={cn(
                  "bg-muted relative aspect-square w-16 shrink-0 overflow-hidden rounded-md border",
                  i === imageIndex ? "ring-primary ring-2" : "opacity-80",
                )}
                aria-label={`View image ${i + 1}`}
              >
                <ProductImage url={im.url} alt={im.alt} title={title} sizes="64px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Buy box */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        {brandName && <span className="text-muted-foreground text-sm">{brandName}</span>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-semibold">{formatPaise(price)}</span>
          {pct > 0 && (
            <>
              <span className="text-muted-foreground text-lg line-through">{formatPaise(mrp)}</span>
              <span className="text-lg font-medium text-green-700 dark:text-green-500">
                {pct}% off
              </span>
            </>
          )}
        </div>
        <p className="text-muted-foreground -mt-2 text-xs">Inclusive of all taxes (GST)</p>

        {/* Variant option axes */}
        {hasVariants &&
          axes.map((axis) => (
            <div key={axis.key}>
              <div className="mb-1.5 text-sm font-medium">
                {axis.key}:{" "}
                <span className="text-muted-foreground font-normal">
                  {selected?.options?.[axis.key]}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {axis.values.map((val) => {
                  const isSelected = selected?.options?.[axis.key] === val;
                  return (
                    <button
                      key={val}
                      onClick={() => selectOption(axis.key, val)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm",
                        isSelected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

        {/* Stock status */}
        <div className="text-sm">
          {inStock ? (
            <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-500">
              <Check className="size-4" /> In stock
              {lowStock && (
                <span className="text-amber-600 dark:text-amber-500">
                  {" "}
                  — only {selected?.stock} left
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground font-medium">Out of stock</span>
          )}
        </div>

        {/* Delivery estimate (PIN-based estimate arrives with checkout) */}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Truck className="size-4" /> Delivery in 3–5 business days
        </div>

        {/* Quantity + add to cart (cart lands in Phase 2) */}
        <div className="flex items-center gap-3">
          <div className="border-border flex items-center rounded-md border">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="hover:bg-muted h-9 w-9 text-lg"
              aria-label="Decrease quantity"
              disabled={!inStock}
            >
              −
            </button>
            <span className="w-8 text-center text-sm">{qty}</span>
            <button
              onClick={() => setQty((q) => Math.min(selected?.stock ?? 1, q + 1))}
              className="hover:bg-muted h-9 w-9 text-lg"
              aria-label="Increase quantity"
              disabled={!inStock}
            >
              +
            </button>
          </div>
          <button
            disabled={!inStock || pending || !selected}
            onClick={async () => {
              if (!selected) return;
              await add(selected.id, qty, selected.stock);
              setAdded(true);
              setTimeout(() => setAdded(false), 2000);
            }}
            className="bg-primary text-primary-foreground h-11 flex-1 rounded-md text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {added ? "Added ✓" : inStock ? "Add to cart" : "Out of stock"}
          </button>
          <WishlistButton
            productId={productId}
            authed={authed}
            initialInWishlist={initialInWishlist}
          />
        </div>
        <p className="text-muted-foreground text-xs">SKU: {selected?.sku}</p>
      </div>
    </div>
  );
}

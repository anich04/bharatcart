"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { getCartDetails } from "@/lib/cart/actions";
import type { PricedCart } from "@/lib/cart/pricing";
import { ProductImage } from "@/components/product-image";
import { formatPaise } from "@/lib/money";

export default function CartPage() {
  const { items, setQuantity, remove } = useCart();
  const [cart, setCart] = useState<PricedCart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCartDetails(items).then((c) => {
      if (active) {
        setCart(c);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [items]);

  const isEmpty = !loading && (!cart || cart.lines.length === 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Your cart</h1>

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {isEmpty && (
        <div className="border-border rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground text-sm">Your cart is empty.</p>
          <Link
            href="/"
            className="bg-primary text-primary-foreground mt-4 inline-flex rounded-md px-4 py-2 text-sm font-medium"
          >
            Continue shopping
          </Link>
        </div>
      )}

      {!loading && cart && cart.lines.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          {/* Line items */}
          <div className="flex flex-col divide-y">
            {cart.adjusted && (
              <p className="pb-3 text-sm text-amber-600 dark:text-amber-500">
                Some items were updated to match current price or stock.
              </p>
            )}
            {cart.lines.map((line) => (
              <div key={line.variantId} className="flex gap-4 py-4">
                <Link
                  href={`/p/${line.slug}`}
                  className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-md border"
                >
                  <ProductImage url={line.imageUrl} title={line.title} sizes="80px" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {line.brandName && (
                    <span className="text-muted-foreground text-xs">{line.brandName}</span>
                  )}
                  <Link href={`/p/${line.slug}`} className="text-sm font-medium hover:underline">
                    {line.title}
                  </Link>
                  <span className="text-muted-foreground text-xs">{line.label}</span>

                  {!line.inStock ? (
                    <span className="text-destructive text-xs font-medium">Out of stock</span>
                  ) : (
                    <div className="mt-1 flex items-center gap-3">
                      <div className="border-border flex items-center rounded-md border">
                        <button
                          onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                          className="hover:bg-muted h-8 w-8"
                          aria-label="Decrease"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm">{line.quantity}</span>
                        <button
                          onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                          disabled={line.quantity >= line.stock}
                          className="hover:bg-muted h-8 w-8 disabled:opacity-40"
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>
                      {line.quantity >= line.stock && (
                        <span className="text-muted-foreground text-xs">Max stock</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-sm font-semibold">{formatPaise(line.lineTotal)}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatPaise(line.unitPrice)} each
                  </span>
                  <button
                    onClick={() => remove(line.variantId)}
                    className="text-muted-foreground hover:text-destructive mt-auto"
                    aria-label="Remove item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <aside className="border-border bg-card h-fit rounded-lg border p-4">
            <h2 className="mb-3 font-semibold">Order summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({cart.itemCount} items)</span>
              <span className="font-medium">{formatPaise(cart.subtotal)}</span>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Shipping &amp; taxes are calculated at checkout. Prices are GST-inclusive.
            </p>
            <Link
              href="/checkout"
              className="bg-primary text-primary-foreground mt-4 flex h-11 items-center justify-center rounded-md text-sm font-medium"
            >
              Proceed to checkout
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

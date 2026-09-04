import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { productCardSelect } from "@/lib/catalog/queries";
import { ProductCard } from "@/components/product-card";
import { RemoveWishlistButton } from "@/components/product/remove-wishlist-button";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/wishlist");

  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const PAGE_SIZE = 12;

  const where = { userId: session.user.id };
  const [entries, total] = await Promise.all([
    prisma.wishlistItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, product: { select: productCardSelect } },
    }),
    prisma.wishlistItem.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Wishlist</h1>

      {entries.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground text-sm">Your wishlist is empty.</p>
          <Link
            href="/"
            className="bg-primary text-primary-foreground mt-4 inline-flex rounded-md px-4 py-2 text-sm font-medium"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {entries.map((e) => (
              <div key={e.id} className="flex flex-col gap-1">
                <ProductCard product={e.product} />
                <div className="text-right">
                  <RemoveWishlistButton productId={e.product.id} />
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2 text-sm">
              {page > 1 && (
                <Link
                  href={`/wishlist?page=${page - 1}`}
                  className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
                >
                  Previous
                </Link>
              )}
              <span className="text-muted-foreground px-3 py-1.5">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/wishlist?page=${page + 1}`}
                  className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StockEditor } from "@/components/admin/stock-editor";

export const metadata: Metadata = { title: "Inventory · Admin" };

const DEFAULT_THRESHOLD = 5;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ threshold?: string }>;
}) {
  const sp = await searchParams;
  const threshold = Math.max(0, Number(sp.threshold) || DEFAULT_THRESHOLD);

  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, stock: { lte: threshold } },
    orderBy: { stock: "asc" },
    take: 100,
    select: {
      id: true,
      sku: true,
      label: true,
      stock: true,
      product: { select: { id: true, title: true, status: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Low stock ({variants.length})</h2>
        <form method="get" className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground text-xs">Threshold ≤</label>
          <input
            name="threshold"
            type="number"
            min={0}
            defaultValue={threshold}
            className="border-input bg-background h-9 w-20 rounded-md border px-2 text-sm"
          />
          <button className="border-input hover:bg-muted h-9 rounded-md border px-3 text-sm">
            Apply
          </button>
        </form>
      </div>

      {variants.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Nothing at or below {threshold} units. Inventory looks healthy.
          </p>
        </div>
      ) : (
        <div className="border-border divide-border divide-y rounded-lg border">
          {variants.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/products/${v.product.id}`}
                  className="font-medium hover:underline"
                >
                  {v.product.title}
                </Link>
                <p className="text-muted-foreground text-xs">
                  {v.label} · SKU {v.sku} · {v.product.status}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={
                    v.stock === 0
                      ? "text-destructive text-xs font-semibold"
                      : "text-xs font-medium text-amber-600"
                  }
                >
                  {v.stock === 0 ? "OUT OF STOCK" : `${v.stock} left`}
                </span>
                <StockEditor variantId={v.id} stock={v.stock} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/money";

export const metadata: Metadata = { title: "Products · Admin" };

const PAGE_SIZE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const status = ["DRAFT", "ACTIVE", "ARCHIVED"].includes(sp.status ?? "")
    ? (sp.status as "DRAFT" | "ACTIVE" | "ARCHIVED")
    : undefined;

  const where: Prisma.ProductWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        displayPrice: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        variants: { where: { isActive: true }, select: { stock: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Products ({total})</h2>
        <div className="flex gap-2">
          <Link
            href="/admin/products/import"
            className="border-input hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
          >
            Import CSV
          </Link>
          <Link
            href="/admin/products/new"
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
          >
            + New product
          </Link>
        </div>
      </div>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title or slug"
          className="border-input bg-background h-9 w-64 rounded-md border px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button className="border-input hover:bg-muted h-9 rounded-md border px-3 text-sm">
          Filter
        </button>
      </form>

      <div className="border-border divide-border divide-y rounded-lg border">
        {products.length === 0 && (
          <p className="text-muted-foreground p-6 text-center text-sm">No products found.</p>
        )}
        {products.map((p) => {
          const stock = p.variants.reduce((s, v) => s + v.stock, 0);
          return (
            <Link
              key={p.id}
              href={`/admin/products/${p.id}`}
              className="hover:bg-muted/40 flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{p.title}</p>
                <p className="text-muted-foreground text-xs">
                  {p.category.name}
                  {p.brand ? ` · ${p.brand.name}` : ""} · /{p.slug}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span
                  className={
                    p.status === "ACTIVE"
                      ? "rounded-full bg-green-600/10 px-2 py-0.5 text-green-700 dark:text-green-500"
                      : "bg-muted text-muted-foreground rounded-full px-2 py-0.5"
                  }
                >
                  {p.status}
                </span>
                <span
                  className={stock <= 5 ? "font-medium text-amber-600" : "text-muted-foreground"}
                >
                  {stock} in stock
                </span>
                <span className="w-20 text-right font-semibold">{formatPaise(p.displayPrice)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/products?page=${page - 1}${q ? `&q=${q}` : ""}`}
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
              href={`/admin/products?page=${page + 1}${q ? `&q=${q}` : ""}`}
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/money";

export const metadata: Metadata = { title: "Customers · Admin" };

const PAGE_SIZE = 25;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        emailVerified: true,
        orders: {
          where: { status: { in: ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"] } },
          select: { grandTotal: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Customers ({total})</h2>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email or phone"
          className="border-input bg-background h-9 w-72 rounded-md border px-3 text-sm"
        />
        <button className="border-input hover:bg-muted h-9 rounded-md border px-3 text-sm">
          Search
        </button>
      </form>

      <div className="border-border divide-border divide-y rounded-lg border">
        {customers.length === 0 && (
          <p className="text-muted-foreground p-6 text-center text-sm">No customers found.</p>
        )}
        {customers.map((c) => {
          const spent = c.orders.reduce((s, o) => s + o.grandTotal, 0);
          return (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{c.name ?? "—"}</p>
                <p className="text-muted-foreground text-xs">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ""}
                  {!c.emailVerified ? " · unverified" : ""}
                </p>
              </div>
              <div className="text-muted-foreground flex items-center gap-4 text-xs">
                <span>Joined {c.createdAt.toLocaleDateString("en-IN")}</span>
                <span>{c.orders.length} orders</span>
                <span className="text-foreground w-24 text-right font-semibold">
                  {formatPaise(spent)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/customers?page=${page - 1}${q ? `&q=${q}` : ""}`}
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
              href={`/admin/customers?page=${page + 1}${q ? `&q=${q}` : ""}`}
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

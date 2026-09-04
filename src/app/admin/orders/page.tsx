import Link from "next/link";
import type { Metadata } from "next";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/money";
import { OrderStatusBadge } from "@/components/order-status-badge";

export const metadata: Metadata = { title: "Orders · Admin" };

const STATUSES: (OrderStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
];

const PAGE_SIZE = 20;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = (STATUSES.includes(sp.status as OrderStatus) ? sp.status : "ALL") as
    OrderStatus | "ALL";
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();

  const where: Prisma.OrderWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { shipFullName: { contains: q, mode: "insensitive" } },
            { shipPhone: { contains: q } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMode: true,
        grandTotal: true,
        createdAt: true,
        shipFullName: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (status !== "ALL") p.set("status", status);
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(patch)) p.set(k, String(v));
    return `?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Orders ({total})</h2>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders${s === "ALL" ? "" : `?status=${s}`}`}
            className={
              s === status
                ? "bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs"
                : "border-border hover:bg-muted rounded-md border px-2.5 py-1 text-xs"
            }
          >
            {s}
          </Link>
        ))}
      </div>

      <form method="get" className="flex gap-2">
        {status !== "ALL" && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search order no., name or phone"
          className="border-input bg-background h-9 w-72 rounded-md border px-3 text-sm"
        />
        <button className="border-input hover:bg-muted h-9 rounded-md border px-3 text-sm">
          Search
        </button>
      </form>

      <p className="text-muted-foreground text-xs">{total} orders</p>

      <div className="border-border divide-border divide-y rounded-lg border">
        {orders.length === 0 && (
          <p className="text-muted-foreground p-6 text-center text-sm">No orders found.</p>
        )}
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/admin/orders/${o.id}`}
            className="hover:bg-muted/40 flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium">{o.orderNumber}</p>
              <p className="text-muted-foreground text-xs">
                {o.shipFullName} · {o._count.items} item(s) ·{" "}
                {o.createdAt.toLocaleDateString("en-IN")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs">{o.paymentMode}</span>
              <OrderStatusBadge status={o.status} />
              <span className="w-24 text-right font-semibold">{formatPaise(o.grandTotal)}</span>
            </div>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/orders${qs({ page: page - 1 })}`}
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
              href={`/admin/orders${qs({ page: page + 1 })}`}
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

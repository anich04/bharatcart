import Link from "next/link";
import type { Metadata } from "next";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/money";
import { OrderStatusBadge } from "@/components/order-status-badge";

export const metadata: Metadata = { title: "Admin dashboard" };

/** Statuses that represent real, countable revenue. */
const REVENUE_STATUSES: OrderStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];

const RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeKey } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
  const since = range.days ? new Date(Date.now() - range.days * 86400_000) : null;

  const orderWhere: Prisma.OrderWhereInput = {
    status: { in: REVENUE_STATUSES },
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [revenue, orderCount, pendingCount, topProducts, recentOrders, lowStock] =
    await Promise.all([
      prisma.order.aggregate({ where: orderWhere, _sum: { grandTotal: true } }),
      prisma.order.count({ where: orderWhere }),
      prisma.order.count({
        where: { status: "PENDING", ...(since ? { createdAt: { gte: since } } : {}) },
      }),
      prisma.orderItem.groupBy({
        by: ["productTitle"],
        where: { order: orderWhere },
        _sum: { quantity: true, lineSubtotal: true },
        orderBy: { _sum: { lineSubtotal: "desc" } },
        take: 5,
      }),
      prisma.order.findMany({
        where: since ? { createdAt: { gte: since } } : {},
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          grandTotal: true,
          createdAt: true,
          shipFullName: true,
        },
      }),
      prisma.productVariant.count({ where: { isActive: true, stock: { lte: 5 } } }),
    ]);

  const totalRevenue = revenue._sum.grandTotal ?? 0;
  const aov = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

  const stats = [
    { label: "Revenue", value: formatPaise(totalRevenue) },
    { label: "Orders", value: String(orderCount) },
    { label: "Avg. order value", value: formatPaise(aov) },
    { label: "Awaiting payment", value: String(pendingCount) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Range selector */}
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin?range=${r.key}`}
            className={
              r.key === range.key
                ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm"
                : "border-border hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
            }
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="border-border bg-card rounded-lg border p-4">
            <p className="text-muted-foreground text-xs">{s.label}</p>
            <p className="mt-1 text-xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {lowStock > 0 && (
        <Link
          href="/admin/inventory"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-400"
        >
          {lowStock} variant{lowStock === 1 ? "" : "s"} low on stock — review inventory →
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top products */}
        <section className="border-border rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Top products</h2>
          {topProducts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sales in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {topProducts.map((p) => (
                <li key={p.productTitle} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{p.productTitle}</span>
                  <span className="text-muted-foreground shrink-0">
                    {p._sum.quantity ?? 0} sold · {formatPaise(p._sum.lineSubtotal ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent orders */}
        <section className="border-border rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent orders</h2>
          {recentOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">No orders yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="hover:bg-muted flex items-center justify-between gap-2 rounded px-1 py-1 text-sm"
                  >
                    <span className="truncate">
                      {o.orderNumber}
                      <span className="text-muted-foreground"> · {o.shipFullName}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <OrderStatusBadge status={o.status} />
                      {formatPaise(o.grandTotal)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

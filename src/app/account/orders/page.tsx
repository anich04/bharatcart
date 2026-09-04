import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/money";
import { OrderStatusBadge } from "@/components/order-status-badge";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 10;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/orders");

  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  const where = { userId: session.user.id };
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
        grandTotal: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (orders.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed p-10 text-center">
        <p className="text-muted-foreground text-sm">You haven&apos;t placed any orders yet.</p>
        <Link
          href="/"
          className="bg-primary text-primary-foreground mt-4 inline-flex rounded-md px-4 py-2 text-sm font-medium"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Order history</h2>
      {orders.map((o) => (
        <Link
          key={o.id}
          href={`/account/orders/${o.orderNumber}`}
          className="border-border hover:bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
        >
          <div>
            <p className="text-sm font-medium">{o.orderNumber}</p>
            <p className="text-muted-foreground text-xs">
              {o.createdAt.toLocaleDateString("en-IN")} · {o._count.items}{" "}
              {o._count.items === 1 ? "item" : "items"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <OrderStatusBadge status={o.status} />
            <span className="text-sm font-semibold">{formatPaise(o.grandTotal)}</span>
          </div>
        </Link>
      ))}

      {totalPages > 1 && (
        <div className="mt-3 flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/account/orders?page=${page - 1}`}
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
              href={`/account/orders?page=${page + 1}`}
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

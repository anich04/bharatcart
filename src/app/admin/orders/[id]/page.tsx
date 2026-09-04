import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/money";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderControls } from "@/components/admin/order-controls";

export const metadata: Metadata = { title: "Order · Admin" };

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED", "REFUNDED"],
  PACKED: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: ["REFUNDED"],
  REFUNDED: [],
};

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      payment: { include: { refunds: true } },
      user: { select: { email: true, name: true } },
    },
  });
  if (!order) notFound();

  const canRefund =
    order.paymentMode === "PREPAID" &&
    !!order.payment?.razorpayPaymentId &&
    order.payment.status === "CAPTURED";

  const row = "flex justify-between text-sm";

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/orders" className="text-primary text-sm hover:underline">
        ← All orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{order.orderNumber}</h2>
          <p className="text-muted-foreground text-xs">
            {order.createdAt.toLocaleString("en-IN")} · {order.user?.email}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-5">
          {/* Items */}
          <div className="border-border divide-border divide-y rounded-lg border">
            {order.items.map((i) => (
              <div key={i.id} className="flex justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{i.productTitle}</p>
                  <p className="text-muted-foreground text-xs">
                    {i.variantLabel} · SKU {i.sku} · HSN {i.hsnCode ?? "—"} · Qty {i.quantity}
                  </p>
                </div>
                <span className="shrink-0 font-medium">{formatPaise(i.lineSubtotal)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-border flex flex-col gap-1.5 rounded-lg border p-4">
            <div className={row}>
              <span className="text-muted-foreground">Items subtotal</span>
              <span>{formatPaise(order.itemsSubtotal)}</span>
            </div>
            {order.discountTotal > 0 && (
              <div className={row}>
                <span className="text-muted-foreground">
                  Discount {order.couponCode ? `(${order.couponCode})` : ""}
                </span>
                <span>−{formatPaise(order.discountTotal)}</span>
              </div>
            )}
            <div className={row}>
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatPaise(order.shippingTotal)}</span>
            </div>
            {order.codCharge > 0 && (
              <div className={row}>
                <span className="text-muted-foreground">COD charge</span>
                <span>{formatPaise(order.codCharge)}</span>
              </div>
            )}
            <div className="border-border mt-1 flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{formatPaise(order.grandTotal)}</span>
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              Taxable {formatPaise(order.taxableTotal)} ·{" "}
              {order.igstTotal > 0
                ? `IGST ${formatPaise(order.igstTotal)}`
                : `CGST ${formatPaise(order.cgstTotal)} + SGST ${formatPaise(order.sgstTotal)}`}
              {order.invoiceNumber ? ` · Invoice ${order.invoiceNumber}` : ""}
            </div>
          </div>

          {/* Payment */}
          <div className="border-border rounded-lg border p-4 text-sm">
            <p className="mb-2 font-medium">Payment</p>
            <p className="text-muted-foreground text-xs">
              Mode: {order.paymentMode} · Status: {order.payment?.status ?? "—"}
              {order.payment?.method ? ` · ${order.payment.method}` : ""}
            </p>
            {order.payment?.razorpayPaymentId && (
              <p className="text-muted-foreground text-xs">
                Razorpay payment: {order.payment.razorpayPaymentId}
              </p>
            )}
            {order.payment?.refunds.length ? (
              <div className="mt-2">
                <p className="text-xs font-medium">Refunds</p>
                {order.payment.refunds.map((r) => (
                  <p key={r.id} className="text-muted-foreground text-xs">
                    {formatPaise(r.amount)} · {r.status}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="border-border rounded-lg border p-4 text-sm">
            <p className="mb-2 font-medium">Delivery address</p>
            <p>{order.shipFullName}</p>
            <p className="text-muted-foreground">{order.shipPhone}</p>
            <p className="text-muted-foreground">
              {order.shipLine1}
              {order.shipLine2 ? `, ${order.shipLine2}` : ""}
              {order.shipLandmark ? `, ${order.shipLandmark}` : ""}
            </p>
            <p className="text-muted-foreground">
              {order.shipCity}, {order.shipState} — {order.shipPincode}
            </p>
          </div>

          <OrderControls
            orderId={order.id}
            status={order.status}
            nextStatuses={TRANSITIONS[order.status]}
            carrier={order.carrier}
            trackingNumber={order.trackingNumber}
            canRefund={canRefund}
            grandTotal={order.grandTotal}
          />
        </div>
      </div>
    </div>
  );
}

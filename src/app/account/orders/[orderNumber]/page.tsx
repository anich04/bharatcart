import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/money";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { ProductImage } from "@/components/product-image";

type Props = { params: Promise<{ orderNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Order ${orderNumber}` };
}

export default async function OrderDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { orderNumber } = await params;

  // Ownership is enforced in the query itself — a user can never read another
  // user's order by guessing an order number.
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: session.user.id },
    include: {
      items: true,
      payment: { select: { status: true, method: true, provider: true, razorpayPaymentId: true } },
    },
  });
  if (!order) notFound();

  const row = "flex justify-between text-sm";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{order.orderNumber}</h2>
          <p className="text-muted-foreground text-xs">
            Placed on {order.createdAt.toLocaleDateString("en-IN")}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.trackingNumber && (
        <div className="border-border rounded-lg border p-4 text-sm">
          <p className="font-medium">Tracking</p>
          <p className="text-muted-foreground">
            {order.carrier ? `${order.carrier} · ` : ""}
            {order.trackingNumber}
          </p>
        </div>
      )}

      {/* Items */}
      <div className="border-border divide-border divide-y rounded-lg border">
        {order.items.map((item) => (
          <div key={item.id} className="flex gap-4 p-4">
            <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-md border">
              <ProductImage url={item.imageUrl} title={item.productTitle} sizes="64px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.productTitle}</p>
              <p className="text-muted-foreground text-xs">
                {item.variantLabel} · Qty {item.quantity}
              </p>
              <p className="text-muted-foreground text-xs">SKU {item.sku}</p>
            </div>
            <span className="text-sm font-semibold">{formatPaise(item.lineSubtotal)}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Address */}
        <div className="border-border rounded-lg border p-4 text-sm">
          <p className="mb-2 font-medium">Delivery address</p>
          <p>{order.shipFullName}</p>
          <p className="text-muted-foreground">{order.shipPhone}</p>
          <p className="text-muted-foreground">
            {order.shipLine1}
            {order.shipLine2 ? `, ${order.shipLine2}` : ""}
          </p>
          <p className="text-muted-foreground">
            {order.shipCity}, {order.shipState} — {order.shipPincode}
          </p>
        </div>

        {/* Totals */}
        <div className="border-border flex flex-col gap-1.5 rounded-lg border p-4">
          <p className="mb-1 text-sm font-medium">Payment summary</p>
          <div className={row}>
            <span className="text-muted-foreground">Items subtotal</span>
            <span>{formatPaise(order.itemsSubtotal)}</span>
          </div>
          {order.discountTotal > 0 && (
            <div className={row}>
              <span className="text-muted-foreground">
                Discount{order.couponCode ? ` (${order.couponCode})` : ""}
              </span>
              <span className="text-green-700 dark:text-green-500">
                −{formatPaise(order.discountTotal)}
              </span>
            </div>
          )}
          <div className={row}>
            <span className="text-muted-foreground">Shipping</span>
            <span>{order.shippingTotal === 0 ? "Free" : formatPaise(order.shippingTotal)}</span>
          </div>
          {order.codCharge > 0 && (
            <div className={row}>
              <span className="text-muted-foreground">COD charge</span>
              <span>{formatPaise(order.codCharge)}</span>
            </div>
          )}
          <div className="border-border mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
            <span>Total paid</span>
            <span>{formatPaise(order.grandTotal)}</span>
          </div>

          {/* GST breakdown (prices are inclusive; tax is derived) */}
          <div className="text-muted-foreground mt-2 space-y-0.5 text-xs">
            <p>Includes GST:</p>
            {order.igstTotal > 0 ? (
              <p>IGST {formatPaise(order.igstTotal)}</p>
            ) : (
              <p>
                CGST {formatPaise(order.cgstTotal)} · SGST {formatPaise(order.sgstTotal)}
              </p>
            )}
          </div>

          <p className="text-muted-foreground mt-2 text-xs">
            {order.paymentMode === "COD" ? "Cash on Delivery" : "Paid online"}
            {order.payment?.method ? ` · ${order.payment.method}` : ""}
          </p>
        </div>
      </div>

      <Link href="/account/orders" className="text-primary text-sm hover:underline">
        ← Back to orders
      </Link>
    </div>
  );
}

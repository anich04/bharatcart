import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/money";

export const metadata: Metadata = { title: "Order confirmed" };

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { orderNumber } = await params;

  // Ownership enforced in the query.
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: session.user.id },
    select: {
      orderNumber: true,
      status: true,
      grandTotal: true,
      paymentMode: true,
      shipFullName: true,
      shipCity: true,
      shipState: true,
      shipPincode: true,
      createdAt: true,
      items: { select: { id: true, productTitle: true, quantity: true } },
    },
  });
  if (!order) notFound();

  const pending = order.status === "PENDING";

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      {pending ? (
        <Clock className="mx-auto size-14 text-amber-500" />
      ) : (
        <CheckCircle2 className="mx-auto size-14 text-green-600" />
      )}

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {pending ? "Payment pending" : "Order confirmed"}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {pending
          ? "We haven't received your payment confirmation yet. If money was debited, this updates automatically within a few minutes."
          : order.paymentMode === "COD"
            ? "Your order is placed. Pay in cash when it arrives."
            : "Thanks! We've received your payment and your order is being prepared."}
      </p>

      <div className="border-border mt-6 rounded-lg border p-4 text-left text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Order number</span>
          <span className="font-medium">{order.orderNumber}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted-foreground">Items</span>
          <span>{order.items.length}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">{formatPaise(order.grandTotal)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted-foreground">Delivering to</span>
          <span className="text-right">
            {order.shipFullName}
            <br />
            {order.shipCity}, {order.shipState} — {order.shipPincode}
          </span>
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <Link
          href={`/account/orders/${order.orderNumber}`}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          View order
        </Link>
        <Link
          href="/"
          className="border-input hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

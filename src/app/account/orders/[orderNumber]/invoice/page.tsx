import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatPaise } from "@/lib/money";
import { GST_BPS } from "@/lib/checkout/tax";
import { CHECKOUT_CONFIG } from "@/lib/checkout/config";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = { title: "Tax invoice" };

type Props = { params: Promise<{ orderNumber: string }> };

export default async function InvoicePage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { orderNumber } = await params;

  // Ownership enforced in the query itself.
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: session.user.id },
    include: { items: true },
  });
  if (!order) notFound();

  // A tax invoice only exists once the order is confirmed.
  if (!order.invoiceNumber) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Invoice not available yet</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A tax invoice is generated once your order is confirmed.
        </p>
        <Link
          href={`/account/orders/${order.orderNumber}`}
          className="text-primary mt-4 inline-block text-sm hover:underline"
        >
          Back to order
        </Link>
      </div>
    );
  }

  const interState = order.igstTotal > 0;
  const th = "border-border border px-2 py-1.5 text-left text-xs font-semibold";
  const td = "border-border border px-2 py-1.5 align-top text-xs";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/account/orders/${order.orderNumber}`}
          className="text-primary text-sm hover:underline"
        >
          Back to order
        </Link>
        <PrintButton />
      </div>

      <div className="border-border rounded-lg border p-6 print:rounded-none print:border-0 print:p-0">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">TAX INVOICE</h1>
            <p className="text-muted-foreground text-xs">Invoice no. {order.invoiceNumber}</p>
            <p className="text-muted-foreground text-xs">
              Date{" "}
              {(order.invoiceDate ?? order.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
            <p className="text-muted-foreground text-xs">Order {order.orderNumber}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{CHECKOUT_CONFIG.sellerLegalName}</p>
            {order.sellerGstin && (
              <p className="text-muted-foreground text-xs">GSTIN: {order.sellerGstin}</p>
            )}
            <p className="text-muted-foreground text-xs">
              State of supply: {CHECKOUT_CONFIG.sellerState}
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase">Billed &amp; shipped to</p>
            <p className="text-sm">{order.shipFullName}</p>
            <p className="text-muted-foreground text-xs">{order.shipPhone}</p>
            <p className="text-muted-foreground text-xs">
              {order.shipLine1}
              {order.shipLine2 ? `, ${order.shipLine2}` : ""}
            </p>
            <p className="text-muted-foreground text-xs">
              {order.shipCity}, {order.shipState} &mdash; {order.shipPincode}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="mb-1 text-xs font-semibold uppercase">Place of supply</p>
            <p className="text-sm">{order.placeOfSupply ?? order.shipState}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {interState ? "Inter-state supply (IGST)" : "Intra-state supply (CGST + SGST)"}
            </p>
            <p className="text-muted-foreground text-xs">
              Payment: {order.paymentMode === "COD" ? "Cash on Delivery" : "Prepaid (online)"}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Description</th>
                <th className={th}>HSN</th>
                <th className={th}>Qty</th>
                <th className={th}>Taxable</th>
                <th className={th}>GST</th>
                {interState ? (
                  <th className={th}>IGST</th>
                ) : (
                  <>
                    <th className={th}>CGST</th>
                    <th className={th}>SGST</th>
                  </>
                )}
                <th className={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td className={td}>
                    {i.productTitle}
                    <br />
                    <span className="text-muted-foreground">{i.variantLabel}</span>
                  </td>
                  <td className={td}>{i.hsnCode ?? "-"}</td>
                  <td className={td}>{i.quantity}</td>
                  <td className={td}>{formatPaise(i.taxableValue)}</td>
                  <td className={td}>{GST_BPS[i.gstRate] / 100}%</td>
                  {interState ? (
                    <td className={td}>{formatPaise(i.igst)}</td>
                  ) : (
                    <>
                      <td className={td}>{formatPaise(i.cgst)}</td>
                      <td className={td}>{formatPaise(i.sgst)}</td>
                    </>
                  )}
                  <td className={td}>{formatPaise(i.taxableValue + i.cgst + i.sgst + i.igst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable value</span>
              <span>{formatPaise(order.taxableTotal)}</span>
            </div>
            {interState ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">IGST</span>
                <span>{formatPaise(order.igstTotal)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CGST</span>
                  <span>{formatPaise(order.cgstTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SGST</span>
                  <span>{formatPaise(order.sgstTotal)}</span>
                </div>
              </>
            )}
            {order.discountTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Discount{order.couponCode ? ` (${order.couponCode})` : ""}
                </span>
                <span>-{formatPaise(order.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{order.shippingTotal === 0 ? "Free" : formatPaise(order.shippingTotal)}</span>
            </div>
            {order.codCharge > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">COD charge</span>
                <span>{formatPaise(order.codCharge)}</span>
              </div>
            )}
            <div className="border-border flex justify-between border-t pt-1 font-semibold">
              <span>Grand total</span>
              <span>{formatPaise(order.grandTotal)}</span>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground mt-6 text-[11px]">
          All prices are inclusive of GST. Discounts are applied proportionally across line items
          before tax is derived. This is a computer-generated invoice and does not require a
          signature.
        </p>
      </div>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { sendEmail, absoluteUrl } from "@/lib/email";
import { formatPaise } from "@/lib/money";

const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? "BharatCart";

async function loadOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { email: true, name: true } } },
  });
}

function itemsTable(
  items: { productTitle: string; variantLabel: string; quantity: number; lineSubtotal: number }[],
) {
  return `<table cellpadding="6" style="border-collapse:collapse;width:100%;font-size:14px">
    <tr style="text-align:left;border-bottom:1px solid #ddd">
      <th>Item</th><th>Qty</th><th style="text-align:right">Amount</th>
    </tr>
    ${items
      .map(
        (i) =>
          `<tr style="border-bottom:1px solid #f0f0f0"><td>${i.productTitle}<br><span style="color:#666;font-size:12px">${i.variantLabel}</span></td><td>${i.quantity}</td><td style="text-align:right">${formatPaise(i.lineSubtotal)}</td></tr>`,
      )
      .join("")}
  </table>`;
}

export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order?.user?.email) return;

  const link = absoluteUrl(`/account/orders/${order.orderNumber}`);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px">
      <h2>Thanks for your order, ${order.user.name ?? "there"}!</h2>
      <p>We've received your order <strong>${order.orderNumber}</strong>.</p>
      ${itemsTable(order.items)}
      <p style="font-size:14px">
        Subtotal: ${formatPaise(order.itemsSubtotal)}<br>
        ${order.discountTotal > 0 ? `Discount: −${formatPaise(order.discountTotal)}<br>` : ""}
        Shipping: ${order.shippingTotal === 0 ? "Free" : formatPaise(order.shippingTotal)}<br>
        ${order.codCharge > 0 ? `COD charge: ${formatPaise(order.codCharge)}<br>` : ""}
        <strong>Total: ${formatPaise(order.grandTotal)}</strong> (incl. GST)
      </p>
      <p style="font-size:14px">
        Delivering to:<br>${order.shipFullName}, ${order.shipLine1}, ${order.shipCity},
        ${order.shipState} — ${order.shipPincode}
      </p>
      <p><a href="${link}">View your order</a></p>
      <p style="color:#666;font-size:12px">${storeName}</p>
    </div>`;

  await sendEmail({
    to: order.user.email,
    subject: `${storeName}: order ${order.orderNumber} confirmed`,
    html,
  });
}

export async function sendShippingEmail(orderId: string): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order?.user?.email) return;

  const link = absoluteUrl(`/account/orders/${order.orderNumber}`);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px">
      <h2>Your order is on its way</h2>
      <p>Order <strong>${order.orderNumber}</strong> has shipped.</p>
      ${
        order.trackingNumber
          ? `<p style="font-size:14px">Carrier: ${order.carrier ?? "—"}<br>Tracking number: <strong>${order.trackingNumber}</strong></p>`
          : ""
      }
      ${itemsTable(order.items)}
      <p><a href="${link}">Track your order</a></p>
      <p style="color:#666;font-size:12px">${storeName}</p>
    </div>`;

  await sendEmail({
    to: order.user.email,
    subject: `${storeName}: order ${order.orderNumber} shipped`,
    html,
  });
}

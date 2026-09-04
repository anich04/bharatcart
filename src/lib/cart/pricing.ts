import type { GstRate } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** A line item request from the client — only ids and quantities are trusted. */
export type CartInput = { variantId: string; quantity: number };

export type PricedLine = {
  variantId: string;
  productId: string;
  slug: string;
  title: string;
  brandName: string | null;
  label: string;
  sku: string;
  imageUrl: string | null;
  unitPrice: number; // paise, from DB
  mrp: number; // paise, from DB
  quantity: number; // clamped to available stock
  requestedQuantity: number;
  lineTotal: number; // paise
  stock: number;
  inStock: boolean;
  gstRate: GstRate;
  hsnCode: string | null;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number; // paise
  itemCount: number;
  adjusted: boolean; // true if any quantity was clamped or a line dropped
};

/**
 * Recompute a cart entirely from the database. NEVER trusts client prices.
 * Quantities are clamped to available stock; unknown/inactive variants drop.
 * This is the single source of truth used by both the cart page and checkout.
 */
export async function priceCartItems(items: CartInput[]): Promise<PricedCart> {
  // Consolidate duplicate variant ids and sanitise quantities.
  const wanted = new Map<string, number>();
  for (const it of items) {
    if (!it?.variantId) continue;
    const q = Math.floor(Number(it.quantity));
    if (!Number.isFinite(q) || q <= 0) continue;
    wanted.set(it.variantId, Math.min(99, (wanted.get(it.variantId) ?? 0) + q));
  }

  if (wanted.size === 0) {
    return { lines: [], subtotal: 0, itemCount: 0, adjusted: false };
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...wanted.keys()] }, isActive: true },
    select: {
      id: true,
      sku: true,
      label: true,
      price: true,
      mrp: true,
      stock: true,
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          gstRate: true,
          hsnCode: true,
          brand: { select: { name: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        },
      },
    },
  });

  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines: PricedLine[] = [];
  let subtotal = 0;
  let itemCount = 0;
  let adjusted = false;

  for (const [variantId, requestedQuantity] of wanted) {
    const v = byId.get(variantId);
    if (!v || v.product.status !== "ACTIVE") {
      adjusted = true; // dropped
      continue;
    }
    const quantity = Math.max(0, Math.min(requestedQuantity, v.stock));
    if (quantity !== requestedQuantity) adjusted = true;
    if (quantity === 0) {
      // out of stock — surface the line but with 0 qty
      lines.push({
        variantId,
        productId: v.product.id,
        slug: v.product.slug,
        title: v.product.title,
        brandName: v.product.brand?.name ?? null,
        label: v.label,
        sku: v.sku,
        imageUrl: v.product.images[0]?.url ?? null,
        unitPrice: v.price,
        mrp: v.mrp,
        quantity: 0,
        requestedQuantity,
        lineTotal: 0,
        stock: v.stock,
        inStock: false,
        gstRate: v.product.gstRate,
        hsnCode: v.product.hsnCode,
      });
      continue;
    }

    const lineTotal = v.price * quantity;
    subtotal += lineTotal;
    itemCount += quantity;
    lines.push({
      variantId,
      productId: v.product.id,
      slug: v.product.slug,
      title: v.product.title,
      brandName: v.product.brand?.name ?? null,
      label: v.label,
      sku: v.sku,
      imageUrl: v.product.images[0]?.url ?? null,
      unitPrice: v.price,
      mrp: v.mrp,
      quantity,
      requestedQuantity,
      lineTotal,
      stock: v.stock,
      inStock: true,
      gstRate: v.product.gstRate,
      hsnCode: v.product.hsnCode,
    });
  }

  return { lines, subtotal, itemCount, adjusted };
}

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getDbCartItems, getOrCreateCart } from "./queries";
import { priceCartItems, type CartInput, type PricedCart } from "./pricing";

const MAX_QTY = 99;

/**
 * Return a fully priced cart, recomputed from the DB.
 * - Authenticated: uses the DB cart (guestItems ignored).
 * - Guest: prices the passed localStorage items.
 */
export async function getCartDetails(guestItems: CartInput[] = []): Promise<PricedCart> {
  const session = await auth();
  if (session?.user?.id) {
    const items = await getDbCartItems(session.user.id);
    return priceCartItems(items);
  }
  return priceCartItems(guestItems);
}

/** Add to cart (authenticated). Guests persist to localStorage on the client. */
export async function addToCartAction(
  variantId: string,
  quantity = 1,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "AUTH" };

  const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(quantity)));
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, isActive: true, product: { status: "ACTIVE" } },
    select: { id: true, stock: true },
  });
  if (!variant) return { ok: false, error: "Product is unavailable." };
  if (variant.stock < 1) return { ok: false, error: "Out of stock." };

  const cartId = await getOrCreateCart(session.user.id);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
    select: { quantity: true },
  });
  const nextQty = Math.min(MAX_QTY, variant.stock, (existing?.quantity ?? 0) + qty);

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    update: { quantity: nextQty, savedForLater: false },
    create: { cartId, variantId, quantity: nextQty },
  });
  return { ok: true };
}

export async function setCartQuantityAction(
  variantId: string,
  quantity: number,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "AUTH" };

  const cartId = await getOrCreateCart(session.user.id);
  const qty = Math.floor(quantity);

  if (qty <= 0) {
    await prisma.cartItem.deleteMany({ where: { cartId, variantId } });
    return { ok: true };
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { stock: true },
  });
  const clamped = Math.min(MAX_QTY, qty, variant?.stock ?? 0);
  if (clamped <= 0) {
    await prisma.cartItem.deleteMany({ where: { cartId, variantId } });
    return { ok: true };
  }

  await prisma.cartItem.updateMany({
    where: { cartId, variantId },
    data: { quantity: clamped },
  });
  return { ok: true };
}

export async function removeFromCartAction(variantId: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const cartId = await getOrCreateCart(session.user.id);
  await prisma.cartItem.deleteMany({ where: { cartId, variantId } });
  return { ok: true };
}

/** Merge a guest's localStorage cart into the DB cart on login. */
export async function mergeGuestCartAction(items: CartInput[]): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  if (!items?.length) return { ok: true };

  const cartId = await getOrCreateCart(session.user.id);

  for (const it of items) {
    const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(it.quantity) || 0)));
    if (!it.variantId || qty <= 0) continue;

    const variant = await prisma.productVariant.findFirst({
      where: { id: it.variantId, isActive: true, product: { status: "ACTIVE" } },
      select: { stock: true },
    });
    if (!variant || variant.stock < 1) continue;

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId: it.variantId } },
      select: { quantity: true },
    });
    const nextQty = Math.min(MAX_QTY, variant.stock, (existing?.quantity ?? 0) + qty);

    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId: it.variantId } },
      update: { quantity: nextQty, savedForLater: false },
      create: { cartId, variantId: it.variantId, quantity: nextQty },
    });
  }
  return { ok: true };
}

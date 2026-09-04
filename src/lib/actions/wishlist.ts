"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function toggleWishlistAction(
  productId: string,
): Promise<{ ok: boolean; inWishlist?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "AUTH" };

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId: session.user.id, productId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/wishlist");
    return { ok: true, inWishlist: false };
  }

  // Only allow wishlisting a real, active product.
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "Product unavailable." };

  await prisma.wishlistItem.create({ data: { userId: session.user.id, productId } });
  revalidatePath("/wishlist");
  return { ok: true, inWishlist: true };
}

export async function removeWishlistAction(productId: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await prisma.wishlistItem.deleteMany({ where: { userId: session.user.id, productId } });
  revalidatePath("/wishlist");
  return { ok: true };
}

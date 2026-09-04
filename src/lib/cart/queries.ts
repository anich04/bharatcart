import { prisma } from "@/lib/prisma";

/** Active (not saved-for-later) cart items for a user, as {variantId, quantity}. */
export async function getDbCartItems(
  userId: string,
): Promise<{ variantId: string; quantity: number }[]> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: {
      items: {
        where: { savedForLater: false },
        select: { variantId: true, quantity: true },
      },
    },
  });
  return cart?.items ?? [];
}

export async function getOrCreateCart(userId: string): Promise<string> {
  const cart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true },
  });
  return cart.id;
}

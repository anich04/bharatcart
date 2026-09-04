import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CheckoutClient } from "@/components/checkout/checkout-client";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/checkout");

  const [addresses, cart] = await Promise.all([
    prisma.address.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        fullName: true,
        phone: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        pincode: true,
        isDefault: true,
      },
    }),
    prisma.cart.findUnique({
      where: { userId: session.user.id },
      select: { items: { where: { savedForLater: false }, select: { id: true } } },
    }),
  ]);

  if (!cart || cart.items.length === 0) redirect("/cart");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutClient addresses={addresses} />
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AddressManager } from "@/components/account/address-manager";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/addresses");

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      fullName: true,
      phone: true,
      line1: true,
      line2: true,
      landmark: true,
      city: true,
      state: true,
      pincode: true,
      isDefault: true,
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Address book</h2>
      <AddressManager addresses={addresses} />
    </div>
  );
}

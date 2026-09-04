"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addressSchema } from "@/lib/validation/address";

export type AddressActionState = { error?: string; success?: boolean };

function parse(formData: FormData) {
  return addressSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    landmark: formData.get("landmark") || undefined,
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    isDefault: formData.get("isDefault") === "on",
  });
}

export async function saveAddressAction(
  _prev: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in." };
  const userId = session.user.id;

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid address" };
  }
  const data = parsed.data;
  const id = (formData.get("id") as string) || null;

  // Ownership: an id must belong to this user.
  if (id) {
    const owned = await prisma.address.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) return { error: "Address not found." };
  }

  const count = await prisma.address.count({ where: { userId } });
  const makeDefault = data.isDefault || count === 0;

  await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const payload = {
      fullName: data.fullName,
      phone: data.phone,
      line1: data.line1,
      line2: data.line2 ?? null,
      landmark: data.landmark ?? null,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      isDefault: makeDefault,
    };
    if (id) {
      await tx.address.update({ where: { id }, data: payload });
    } else {
      await tx.address.create({ data: { ...payload, userId } });
    }
  });

  revalidatePath("/account/addresses");
  return { success: true };
}

export async function deleteAddressAction(id: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  // deleteMany with userId scope guarantees ownership.
  await prisma.address.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function setDefaultAddressAction(id: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const userId = session.user.id;

  const owned = await prisma.address.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return { ok: false };

  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/account/addresses");
  return { ok: true };
}

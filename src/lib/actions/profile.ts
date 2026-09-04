"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/)
    .optional()
    .or(z.literal("")),
});

export async function updateProfileAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone ? parsed.data.phone : null,
    },
  });
  revalidatePath("/account");
}

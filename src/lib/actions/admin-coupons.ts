"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAction, ForbiddenError } from "@/lib/admin/guard";

type Result = { ok: boolean; error?: string };

const couponSchema = z
  .object({
    id: z.string().optional().nullable(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Code must be at least 3 characters")
      .max(32)
      .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only"),
    description: z.string().trim().max(200).optional().nullable(),
    type: z.enum(["PERCENT", "FLAT"]),
    /** PERCENT: whole percent (10 = 10%). FLAT: rupees. */
    value: z.number().positive("Value must be greater than zero"),
    minOrderValueRupees: z.number().min(0).default(0),
    maxDiscountRupees: z.number().min(0).optional().nullable(),
    usageLimit: z.number().int().min(1).optional().nullable(),
    perUserLimit: z.number().int().min(1).optional().nullable(),
    startsAt: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((c) => c.type !== "PERCENT" || c.value <= 100, {
    message: "A percentage discount cannot exceed 100%",
    path: ["value"],
  });

export async function saveCouponAction(input: unknown): Promise<Result> {
  try {
    await requireAdminAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Forbidden" };
    throw e;
  }

  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid coupon" };
  }
  const c = parsed.data;

  // PERCENT is stored as basis points; FLAT as paise.
  const value = c.type === "PERCENT" ? Math.round(c.value * 100) : Math.round(c.value * 100);

  const data = {
    code: c.code,
    description: c.description || null,
    type: c.type,
    value,
    minOrderValue: Math.round(c.minOrderValueRupees * 100),
    maxDiscount:
      c.type === "PERCENT" && c.maxDiscountRupees ? Math.round(c.maxDiscountRupees * 100) : null,
    usageLimit: c.usageLimit ?? null,
    perUserLimit: c.perUserLimit ?? null,
    startsAt: c.startsAt ? new Date(c.startsAt) : null,
    expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
    isActive: c.isActive,
  };

  if (data.startsAt && data.expiresAt && data.startsAt > data.expiresAt) {
    return { ok: false, error: "The start date must be before the expiry date." };
  }

  try {
    if (c.id) {
      await prisma.coupon.update({ where: { id: c.id }, data });
    } else {
      await prisma.coupon.create({ data });
    }
    revalidatePath("/admin/coupons");
    return { ok: true };
  } catch (err) {
    const dup = err instanceof Error && err.message.includes("Unique constraint");
    return {
      ok: false,
      error: dup ? "That coupon code already exists." : "Could not save coupon.",
    };
  }
}

export async function toggleCouponAction(id: string, isActive: boolean): Promise<Result> {
  try {
    await requireAdminAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Forbidden" };
    throw e;
  }
  await prisma.coupon.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/coupons");
  return { ok: true };
}

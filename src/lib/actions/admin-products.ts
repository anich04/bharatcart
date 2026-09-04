"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAction, ForbiddenError } from "@/lib/admin/guard";

type Result = { ok: boolean; error?: string; id?: string };

const rupeesToPaise = (r: number) => Math.round(r * 100);

const variantSchema = z.object({
  id: z.string().optional().nullable(),
  sku: z.string().trim().min(1, "SKU is required").max(64),
  label: z.string().trim().min(1, "Variant label is required").max(80),
  priceRupees: z.number().nonnegative(),
  mrpRupees: z.number().nonnegative(),
  stock: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean().default(true),
});

const productSchema = z.object({
  id: z.string().optional().nullable(),
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words separated by hyphens"),
  description: z.string().trim().min(1, "Description is required").max(20000),
  categoryId: z.string().min(1, "Category is required"),
  brandId: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  gstRate: z.enum(["ZERO", "FIVE", "TWELVE", "EIGHTEEN", "TWENTYEIGHT"]),
  hsnCode: z.string().trim().max(20).optional().nullable(),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  metaTitle: z.string().trim().max(200).optional().nullable(),
  metaDescription: z.string().trim().max(300).optional().nullable(),
  imageUrls: z.array(z.string().url()).max(10).default([]),
  variants: z.array(variantSchema).min(1, "At least one variant is required"),
});

export async function saveProductAction(input: unknown): Promise<Result> {
  try {
    await requireAdminAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Forbidden" };
    throw e;
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product" };
  }
  const p = parsed.data;

  // Duplicate SKUs within the submitted set.
  const skus = p.variants.map((v) => v.sku.trim());
  if (new Set(skus).size !== skus.length) {
    return { ok: false, error: "Duplicate SKUs in variants." };
  }

  const prices = p.variants.map((v) => rupeesToPaise(v.priceRupees));
  const mrps = p.variants.map((v) => rupeesToPaise(v.mrpRupees));
  const displayPrice = Math.min(...prices);
  const displayMrp = Math.min(...mrps);

  const base = {
    title: p.title,
    slug: p.slug,
    description: p.description,
    categoryId: p.categoryId,
    brandId: p.brandId || null,
    status: p.status,
    gstRate: p.gstRate,
    hsnCode: p.hsnCode || null,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    metaTitle: p.metaTitle || null,
    metaDescription: p.metaDescription || null,
    displayPrice,
    displayMrp,
    hasVariants: p.variants.length > 1,
  };

  try {
    const productId = await prisma.$transaction(async (tx) => {
      let id = p.id ?? undefined;

      if (id) {
        await tx.product.update({ where: { id }, data: base });
      } else {
        const created = await tx.product.create({ data: base });
        id = created.id;
      }

      // Upsert variants; deactivate ones removed from the form (never delete —
      // they may be referenced by historical orders).
      const keptIds: string[] = [];
      for (let i = 0; i < p.variants.length; i++) {
        const v = p.variants[i];
        const data = {
          productId: id!,
          sku: v.sku.trim(),
          label: v.label,
          price: rupeesToPaise(v.priceRupees),
          mrp: rupeesToPaise(v.mrpRupees),
          stock: v.stock,
          isActive: v.isActive,
        };
        if (v.id) {
          await tx.productVariant.update({ where: { id: v.id }, data });
          keptIds.push(v.id);
        } else {
          const created = await tx.productVariant.create({ data });
          keptIds.push(created.id);
        }
      }
      await tx.productVariant.updateMany({
        where: { productId: id!, id: { notIn: keptIds } },
        data: { isActive: false },
      });

      // Replace images with the submitted list.
      await tx.productImage.deleteMany({ where: { productId: id! } });
      if (p.imageUrls.length > 0) {
        await tx.productImage.createMany({
          data: p.imageUrls.map((url, idx) => ({ productId: id!, url, sortOrder: idx })),
        });
      }

      return id!;
    });

    revalidatePath("/admin/products");
    revalidatePath(`/p/${p.slug}`);
    return { ok: true, id: productId };
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("Unique constraint")
        ? "That slug or SKU is already in use."
        : "Could not save the product.";
    console.error("saveProductAction failed", err);
    return { ok: false, error: message };
  }
}

export async function setProductStatusAction(
  productId: string,
  status: "DRAFT" | "ACTIVE" | "ARCHIVED",
): Promise<Result> {
  try {
    await requireAdminAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Forbidden" };
    throw e;
  }
  await prisma.product.update({ where: { id: productId }, data: { status } });
  revalidatePath("/admin/products");
  return { ok: true };
}

export async function updateVariantStockAction(variantId: string, stock: number): Promise<Result> {
  try {
    await requireAdminAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Forbidden" };
    throw e;
  }
  const qty = Math.max(0, Math.floor(Number(stock)));
  if (!Number.isFinite(qty)) return { ok: false, error: "Invalid stock value" };

  await prisma.productVariant.update({ where: { id: variantId }, data: { stock: qty } });
  revalidatePath("/admin/inventory");
  return { ok: true };
}

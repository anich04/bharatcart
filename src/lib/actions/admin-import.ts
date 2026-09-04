"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAction, ForbiddenError } from "@/lib/admin/guard";
import { parseCsv } from "@/lib/csv";

export type ImportResult = {
  ok: boolean;
  error?: string;
  created: number;
  updated: number;
  skipped: { row: number; reason: string }[];
};

const rowSchema = z.object({
  title: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(1),
  category: z.string().trim().min(1),
  brand: z.string().trim().optional(),
  sku: z.string().trim().min(1),
  price: z.coerce.number().nonnegative(),
  mrp: z.coerce.number().nonnegative(),
  stock: z.coerce.number().int().min(0),
  gstRate: z.enum(["ZERO", "FIVE", "TWELVE", "EIGHTEEN", "TWENTYEIGHT"]).default("EIGHTEEN"),
  hsnCode: z.string().trim().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
});

/**
 * Bulk import products from CSV. Prices are in RUPEES in the file and stored as
 * paise. Each row creates a single "Default" variant; rows are matched on slug
 * so re-importing updates rather than duplicates.
 */
export async function importProductsCsvAction(csvText: string): Promise<ImportResult> {
  try {
    await requireAdminAction();
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return { ok: false, error: "Forbidden", created: 0, updated: 0, skipped: [] };
    }
    throw e;
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return {
      ok: false,
      error: "CSV needs a header row and at least one data row.",
      created: 0,
      updated: 0,
      skipped: [],
    };
  }

  const headers = rows[0].map((h) => h.trim());
  const missing = [
    "title",
    "slug",
    "description",
    "category",
    "sku",
    "price",
    "mrp",
    "stock",
  ].filter((h) => !headers.includes(h));
  if (missing.length) {
    return {
      ok: false,
      error: `Missing required columns: ${missing.join(", ")}`,
      created: 0,
      updated: 0,
      skipped: [],
    };
  }

  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ select: { id: true, slug: true } }),
    prisma.brand.findMany({ select: { id: true, slug: true } }),
  ]);
  const catBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const brandBySlug = new Map(brands.map((b) => [b.slug, b.id]));

  let created = 0;
  let updated = 0;
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => (raw[h] = (rows[i][idx] ?? "").trim()));

    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      skipped.push({ row: i + 1, reason: parsed.error.issues[0]?.message ?? "Invalid row" });
      continue;
    }
    const r = parsed.data;

    const categoryId = catBySlug.get(r.category);
    if (!categoryId) {
      skipped.push({ row: i + 1, reason: `Unknown category "${r.category}"` });
      continue;
    }
    const brandId = r.brand ? (brandBySlug.get(r.brand) ?? null) : null;
    if (r.brand && !brandId) {
      skipped.push({ row: i + 1, reason: `Unknown brand "${r.brand}"` });
      continue;
    }

    const price = Math.round(r.price * 100);
    const mrp = Math.round(r.mrp * 100);

    try {
      const existing = await prisma.product.findUnique({
        where: { slug: r.slug },
        select: { id: true },
      });

      const data = {
        title: r.title,
        description: r.description,
        categoryId,
        brandId,
        status: r.status,
        gstRate: r.gstRate,
        hsnCode: r.hsnCode || null,
        displayPrice: price,
        displayMrp: mrp,
        hasVariants: false,
        metaTitle: r.title,
        metaDescription: r.description.slice(0, 155),
      };

      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data });
        await prisma.productVariant.upsert({
          where: { sku: r.sku },
          update: { productId: existing.id, price, mrp, stock: r.stock, isActive: true },
          create: {
            productId: existing.id,
            sku: r.sku,
            label: "Default",
            price,
            mrp,
            stock: r.stock,
          },
        });
        updated++;
      } else {
        await prisma.product.create({
          data: {
            ...data,
            slug: r.slug,
            variants: {
              create: { sku: r.sku, label: "Default", price, mrp, stock: r.stock },
            },
          },
        });
        created++;
      }
    } catch (err) {
      skipped.push({
        row: i + 1,
        reason:
          err instanceof Error && err.message.includes("Unique constraint")
            ? `Duplicate SKU "${r.sku}"`
            : "Database error",
      });
    }
  }

  revalidatePath("/admin/products");
  return { ok: true, created, updated, skipped };
}

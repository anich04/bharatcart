import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "Edit product · Admin" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [product, categories, brands] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { createdAt: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!product) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Edit product</h2>
        <Link href={`/p/${product.slug}`} className="text-primary text-sm hover:underline">
          View on store →
        </Link>
      </div>
      <ProductForm
        categories={categories}
        brands={brands}
        initial={{
          id: product.id,
          title: product.title,
          slug: product.slug,
          description: product.description,
          categoryId: product.categoryId,
          brandId: product.brandId ?? "",
          status: product.status,
          gstRate: product.gstRate,
          hsnCode: product.hsnCode ?? "",
          isFeatured: product.isFeatured,
          isNewArrival: product.isNewArrival,
          metaTitle: product.metaTitle ?? "",
          metaDescription: product.metaDescription ?? "",
          imageUrls: product.images.map((i) => i.url),
          variants: product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            label: v.label,
            priceRupees: v.price / 100,
            mrpRupees: v.mrp / 100,
            stock: v.stock,
            isActive: v.isActive,
          })),
        }}
      />
    </div>
  );
}

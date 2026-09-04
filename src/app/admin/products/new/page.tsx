import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "New product · Admin" };

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">New product</h2>
      <ProductForm
        categories={categories}
        brands={brands}
        initial={{
          title: "",
          slug: "",
          description: "",
          categoryId: "",
          brandId: "",
          status: "DRAFT",
          gstRate: "EIGHTEEN",
          hsnCode: "",
          isFeatured: false,
          isNewArrival: false,
          metaTitle: "",
          metaDescription: "",
          imageUrls: [],
          variants: [
            { sku: "", label: "Default", priceRupees: 0, mrpRupees: 0, stock: 0, isActive: true },
          ],
        }}
      />
    </div>
  );
}

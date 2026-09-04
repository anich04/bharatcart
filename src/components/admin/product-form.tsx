"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { saveProductAction } from "@/lib/actions/admin-products";

const input = "border-input bg-background h-9 w-full rounded-md border px-3 text-sm outline-none";
const label = "mb-1 block text-xs font-medium";

export type VariantRow = {
  id?: string | null;
  sku: string;
  label: string;
  priceRupees: number;
  mrpRupees: number;
  stock: number;
  isActive: boolean;
};

export type ProductFormValues = {
  id?: string | null;
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  brandId: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  gstRate: "ZERO" | "FIVE" | "TWELVE" | "EIGHTEEN" | "TWENTYEIGHT";
  hsnCode: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  metaTitle: string;
  metaDescription: string;
  imageUrls: string[];
  variants: VariantRow[];
};

export function ProductForm({
  initial,
  categories,
  brands,
}: {
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState<ProductFormValues>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    setV((prev) => {
      const variants = [...prev.variants];
      variants[i] = { ...variants[i], ...patch };
      return { ...prev, variants };
    });

  const submit = () =>
    startTransition(async () => {
      setMsg(null);
      const res = await saveProductAction({
        ...v,
        brandId: v.brandId || null,
        hsnCode: v.hsnCode || null,
        metaTitle: v.metaTitle || null,
        metaDescription: v.metaDescription || null,
        imageUrls: v.imageUrls.filter((u) => u.trim() !== ""),
      });
      if (res.ok) {
        setMsg({ type: "ok", text: "Product saved." });
        router.push("/admin/products");
        router.refresh();
      } else {
        setMsg({ type: "err", text: res.error ?? "Save failed" });
      }
    });

  return (
    <div className="flex flex-col gap-5">
      {msg && (
        <p
          className={
            msg.type === "ok"
              ? "rounded-md bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-500"
              : "bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
          }
        >
          {msg.text}
        </p>
      )}

      <section className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Title</label>
          <input
            value={v.title}
            onChange={(e) => {
              const title = e.target.value;
              set("title", title);
              if (!v.id && !initial.slug) {
                set(
                  "slug",
                  title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
              }
            }}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Slug (URL)</label>
          <input value={v.slug} onChange={(e) => set("slug", e.target.value)} className={input} />
        </div>
        <div>
          <label className={label}>Status</label>
          <select
            value={v.status}
            onChange={(e) => set("status", e.target.value as ProductFormValues["status"])}
            className={input}
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Description</label>
          <textarea
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className={label}>Category</label>
          <select
            value={v.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            className={input}
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Brand</label>
          <select
            value={v.brandId}
            onChange={(e) => set("brandId", e.target.value)}
            className={input}
          >
            <option value="">No brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>GST rate</label>
          <select
            value={v.gstRate}
            onChange={(e) => set("gstRate", e.target.value as ProductFormValues["gstRate"])}
            className={input}
          >
            <option value="ZERO">0%</option>
            <option value="FIVE">5%</option>
            <option value="TWELVE">12%</option>
            <option value="EIGHTEEN">18%</option>
            <option value="TWENTYEIGHT">28%</option>
          </select>
        </div>
        <div>
          <label className={label}>HSN code</label>
          <input
            value={v.hsnCode}
            onChange={(e) => set("hsnCode", e.target.value)}
            className={input}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={v.isFeatured}
            onChange={(e) => set("isFeatured", e.target.checked)}
            className="accent-primary size-4"
          />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={v.isNewArrival}
            onChange={(e) => set("isNewArrival", e.target.checked)}
            className="accent-primary size-4"
          />
          New arrival
        </label>
      </section>

      {/* Variants */}
      <section className="border-border rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Variants &amp; stock</h3>
          <button
            onClick={() =>
              set("variants", [
                ...v.variants,
                { sku: "", label: "", priceRupees: 0, mrpRupees: 0, stock: 0, isActive: true },
              ])
            }
            className="border-input hover:bg-muted rounded-md border px-2.5 py-1 text-xs"
          >
            + Add variant
          </button>
        </div>
        <p className="text-muted-foreground mb-3 text-xs">
          Every product needs at least one variant. Prices are in ₹ and are GST-inclusive.
        </p>
        <div className="flex flex-col gap-2">
          {v.variants.map((vr, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_6rem_5rem_2rem]">
              <input
                value={vr.sku}
                onChange={(e) => setVariant(i, { sku: e.target.value })}
                placeholder="SKU"
                className={input}
              />
              <input
                value={vr.label}
                onChange={(e) => setVariant(i, { label: e.target.value })}
                placeholder="Label (e.g. M / Red)"
                className={input}
              />
              <input
                type="number"
                min={0}
                value={vr.priceRupees}
                onChange={(e) => setVariant(i, { priceRupees: Number(e.target.value) })}
                placeholder="Price ₹"
                className={input}
              />
              <input
                type="number"
                min={0}
                value={vr.mrpRupees}
                onChange={(e) => setVariant(i, { mrpRupees: Number(e.target.value) })}
                placeholder="MRP ₹"
                className={input}
              />
              <input
                type="number"
                min={0}
                value={vr.stock}
                onChange={(e) => setVariant(i, { stock: Number(e.target.value) })}
                placeholder="Stock"
                className={input}
              />
              <button
                onClick={() =>
                  set(
                    "variants",
                    v.variants.filter((_, idx) => idx !== i),
                  )
                }
                disabled={v.variants.length === 1}
                className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                aria-label="Remove variant"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Images + SEO */}
      <section className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Image URLs (one per line — upload to Cloudinary first)</label>
          <textarea
            value={v.imageUrls.join("\n")}
            onChange={(e) => set("imageUrls", e.target.value.split("\n"))}
            rows={3}
            placeholder="https://res.cloudinary.com/..."
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className={label}>SEO title</label>
          <input
            value={v.metaTitle}
            onChange={(e) => set("metaTitle", e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className={label}>SEO description</label>
          <input
            value={v.metaDescription}
            onChange={(e) => set("metaDescription", e.target.value)}
            className={input}
          />
        </div>
      </section>

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="bg-primary text-primary-foreground h-10 rounded-md px-5 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save product"}
        </button>
        <button
          onClick={() => router.push("/admin/products")}
          className="border-input hover:bg-muted h-10 rounded-md border px-4 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getSimilarProducts } from "@/lib/catalog/queries";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { paiseToRupees } from "@/lib/money";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { ProductCarousel } from "@/components/product-carousel";
import { RatingStars } from "@/components/rating-stars";
import { ReviewList } from "@/components/product/review-list";
import { ReviewForm } from "@/components/product/review-form";
import {
  ProductDetailTop,
  type BuyBoxImage,
  type BuyBoxVariant,
} from "@/components/product/product-detail-top";

type Props = { params: Promise<{ slug: string }> };

type Spec = { group: string; key: string; value: string };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not found" };
  const description = product.metaDescription ?? product.description.slice(0, 155);
  return {
    title: product.metaTitle ?? product.title,
    description,
    openGraph: { title: product.title, description, type: "website" },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const similar = await getSimilarProducts(product.id, product.categoryId, 10);

  const session = await auth();
  const authed = !!session?.user?.id;
  const userId = session?.user?.id;

  const [wishlisted, reviews, myReview, deliveredItem] = await Promise.all([
    authed
      ? prisma.wishlistItem.findUnique({
          where: { userId_productId: { userId: userId!, productId: product.id } },
          select: { id: true },
        })
      : null,
    prisma.review.findMany({
      where: { productId: product.id, isHidden: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        isVerifiedPurchase: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    authed
      ? prisma.review.findUnique({
          where: { userId_productId: { userId: userId!, productId: product.id } },
          select: { rating: true, title: true, body: true },
        })
      : null,
    // Verified-purchase gate: a DELIVERED order containing this product.
    authed
      ? prisma.orderItem.findFirst({
          where: { productId: product.id, order: { userId: userId!, status: "DELIVERED" } },
          select: { id: true },
        })
      : null,
  ]);

  const initialInWishlist = !!wishlisted;
  const canReview = !!deliveredItem;

  const variants: BuyBoxVariant[] = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    label: v.label,
    options: (v.options as Record<string, string> | null) ?? null,
    price: v.price,
    mrp: v.mrp,
    stock: v.stock,
  }));
  const images: BuyBoxImage[] = product.images.map((im) => ({
    id: im.id,
    url: im.url,
    alt: im.alt,
    variantId: im.variantId,
  }));

  const specs = (product.specifications as Spec[] | null) ?? [];
  const specGroups = specs.reduce<Record<string, Spec[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  const crumbs: Crumb[] = [{ label: "Home", href: "/" }];
  if (product.category.parent) {
    crumbs.push({
      label: product.category.parent.name,
      href: `/c/${product.category.parent.slug}`,
    });
  }
  crumbs.push({ label: product.category.name, href: `/c/${product.category.slug}` });
  crumbs.push({ label: product.title });

  // Product + Offer + AggregateRating JSON-LD.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: paiseToRupees(product.displayPrice).toFixed(2),
      availability: product.variants.some((v) => v.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    aggregateRating:
      product.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.ratingAverage.toFixed(1),
            reviewCount: product.ratingCount,
          }
        : undefined,
  };

  const distribution = [
    { star: 5, count: product.rating5 },
    { star: 4, count: product.rating4 },
    { star: 3, count: product.rating3 },
    { star: 2, count: product.rating2 },
    { star: 1, count: product.rating1 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs items={crumbs} />

      <div className="mt-4">
        <ProductDetailTop
          productId={product.id}
          title={product.title}
          brandName={product.brand?.name}
          images={images}
          variants={variants}
          hasVariants={product.hasVariants}
          authed={authed}
          initialInWishlist={initialInWishlist}
        />
      </div>

      {/* Description */}
      <section className="mt-12 max-w-3xl">
        <h2 className="mb-3 text-lg font-semibold">Product details</h2>
        <p className="text-muted-foreground text-sm leading-6 whitespace-pre-line">
          {product.description}
        </p>
      </section>

      {/* Specifications */}
      {specs.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="mb-3 text-lg font-semibold">Specifications</h2>
          <div className="divide-border border-border divide-y rounded-lg border">
            {Object.entries(specGroups).map(([group, rows]) => (
              <div key={group} className="p-4">
                <h3 className="mb-2 text-sm font-medium">{group}</h3>
                <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {rows.map((r, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <dt className="text-muted-foreground min-w-28">{r.key}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reviews (full reviews land in Phase 5) */}
      <section className="mt-10 max-w-3xl">
        <h2 className="mb-3 text-lg font-semibold">Ratings &amp; reviews</h2>
        {product.ratingCount > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-semibold">{product.ratingAverage.toFixed(1)}</span>
              <RatingStars value={product.ratingAverage} size={16} />
              <span className="text-muted-foreground mt-1 text-xs">
                {product.ratingCount} ratings
              </span>
            </div>
            <div className="flex-1 space-y-1">
              {distribution.map((d) => {
                const pct = product.ratingCount ? (d.count / product.ratingCount) * 100 : 0;
                return (
                  <div key={d.star} className="flex items-center gap-2 text-xs">
                    <span className="w-6">{d.star}★</span>
                    <div className="bg-muted h-2 flex-1 overflow-hidden rounded">
                      <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-muted-foreground w-8 text-right">{d.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No reviews yet. Verified buyers can review this product after delivery.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-4">
          {canReview ? (
            <ReviewForm productId={product.id} existing={myReview} />
          ) : (
            authed && (
              <p className="text-muted-foreground text-xs">
                You can review this product once an order containing it is delivered.
              </p>
            )
          )}
          <ReviewList reviews={reviews} />
        </div>
      </section>

      {/* Similar products */}
      {similar.length > 0 && (
        <div className="mt-14">
          <ProductCarousel title="Similar products" products={similar} />
        </div>
      )}
    </div>
  );
}

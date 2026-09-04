import { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, type CatalogParams, type SortValue } from "./params";

/** Fields needed to render a product card. Reused across all listing surfaces. */
export const productCardSelect = {
  id: true,
  slug: true,
  title: true,
  displayPrice: true,
  displayMrp: true,
  ratingAverage: true,
  ratingCount: true,
  brand: { select: { name: true, slug: true } },
  images: {
    orderBy: { sortOrder: "asc" as const },
    take: 1,
    select: { url: true, alt: true },
  },
  variants: {
    where: { isActive: true, stock: { gt: 0 } },
    take: 1,
    select: { id: true },
  },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export type ProductPage = {
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const rupeesToPaise = (r?: number) => (r === undefined ? undefined : Math.round(r * 100));

// ---------------------------------------------------------------------------
// Categories & brands
// ---------------------------------------------------------------------------

export async function getCategoryTree() {
  return prisma.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parent: { select: { name: true, slug: true } },
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  });
}

/** A category plus all its descendant category ids (tree is 2 levels deep). */
async function categoryAndDescendantIds(categoryId: string): Promise<string[]> {
  const children = await prisma.category.findMany({
    where: { parentId: categoryId },
    select: { id: true },
  });
  return [categoryId, ...children.map((c) => c.id)];
}

export async function getAllBrands() {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

// ---------------------------------------------------------------------------
// Home rails
// ---------------------------------------------------------------------------

export async function getFeaturedProducts(limit = 8): Promise<ProductCard[]> {
  return prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE, isFeatured: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: productCardSelect,
  });
}

export async function getNewArrivals(limit = 8): Promise<ProductCard[]> {
  return prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE, isNewArrival: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: productCardSelect,
  });
}

// ---------------------------------------------------------------------------
// Listing (category browse) — filters/sort/pagination
// ---------------------------------------------------------------------------

function orderByFor(sort: SortValue): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ displayPrice: "asc" }];
    case "price-desc":
      return [{ displayPrice: "desc" }];
    case "rating":
      return [{ ratingAverage: "desc" }, { ratingCount: "desc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "relevance":
    default:
      return [{ isFeatured: "desc" }, { createdAt: "desc" }];
  }
}

function buildWhere(params: CatalogParams, categoryIds?: string[]): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: ProductStatus.ACTIVE };

  if (categoryIds && categoryIds.length > 0) {
    where.categoryId = { in: categoryIds };
  }
  if (params.brands.length > 0) {
    where.brand = { slug: { in: params.brands } };
  }

  const min = rupeesToPaise(params.minPriceRupees);
  const max = rupeesToPaise(params.maxPriceRupees);
  if (min !== undefined || max !== undefined) {
    where.displayPrice = {};
    if (min !== undefined) where.displayPrice.gte = min;
    if (max !== undefined) where.displayPrice.lte = max;
  }

  if (params.minRating !== undefined) {
    where.ratingAverage = { gte: params.minRating };
  }
  if (params.inStock) {
    where.variants = { some: { isActive: true, stock: { gt: 0 } } };
  }
  return where;
}

export async function listProducts(
  params: CatalogParams,
  categorySlug?: string,
): Promise<ProductPage> {
  let categoryIds: string[] | undefined;
  if (categorySlug) {
    const cat = await prisma.category.findUnique({
      where: { slug: categorySlug },
      select: { id: true },
    });
    categoryIds = cat ? await categoryAndDescendantIds(cat.id) : ["__none__"];
  }

  const where = buildWhere(params, categoryIds);
  const skip = (params.page - 1) * PAGE_SIZE;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: orderByFor(params.sort),
      skip,
      take: PAGE_SIZE,
      select: productCardSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page: params.page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// ---------------------------------------------------------------------------
// Full-text search (indexed tsvector over title+description, plus brand match)
// ---------------------------------------------------------------------------

function rawOrderBy(sort: SortValue, tsq: Prisma.Sql): Prisma.Sql {
  switch (sort) {
    case "price-asc":
      return Prisma.sql`p."displayPrice" ASC`;
    case "price-desc":
      return Prisma.sql`p."displayPrice" DESC`;
    case "rating":
      return Prisma.sql`p."ratingAverage" DESC, p."ratingCount" DESC`;
    case "newest":
      return Prisma.sql`p."createdAt" DESC`;
    case "relevance":
    default:
      return Prisma.sql`ts_rank(p."searchVector", ${tsq}) DESC, p."createdAt" DESC`;
  }
}

export async function searchProducts(params: CatalogParams): Promise<ProductPage> {
  const q = params.q ?? "";
  if (!q) {
    return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };
  }

  const tsq = Prisma.sql`websearch_to_tsquery('simple', ${q})`;
  const like = `%${q}%`;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`p.status = 'ACTIVE'::"bharatcart"."ProductStatus"`,
    Prisma.sql`(p."searchVector" @@ ${tsq} OR b.name ILIKE ${like})`,
  ];

  if (params.brands.length > 0) {
    conditions.push(Prisma.sql`b.slug IN (${Prisma.join(params.brands)})`);
  }
  const min = rupeesToPaise(params.minPriceRupees);
  const max = rupeesToPaise(params.maxPriceRupees);
  if (min !== undefined) conditions.push(Prisma.sql`p."displayPrice" >= ${min}`);
  if (max !== undefined) conditions.push(Prisma.sql`p."displayPrice" <= ${max}`);
  if (params.minRating !== undefined) {
    conditions.push(Prisma.sql`p."ratingAverage" >= ${params.minRating}`);
  }
  if (params.inStock) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "bharatcart"."ProductVariant" v WHERE v."productId" = p.id AND v."isActive" AND v.stock > 0)`,
    );
  }

  const where = Prisma.join(conditions, " AND ");
  const skip = (params.page - 1) * PAGE_SIZE;

  const rows = await prisma.$queryRaw<{ id: string; total: bigint }[]>(Prisma.sql`
    SELECT p.id, count(*) OVER() AS total
    FROM "bharatcart"."Product" p
    LEFT JOIN "bharatcart"."Brand" b ON b.id = p."brandId"
    WHERE ${where}
    ORDER BY ${rawOrderBy(params.sort, tsq)}
    LIMIT ${PAGE_SIZE} OFFSET ${skip}
  `);

  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  const ids = rows.map((r) => r.id);

  const products =
    ids.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: ids } },
          select: productCardSelect,
        })
      : [];

  // Preserve the rank order returned by the raw query.
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = ids.map((id) => byId.get(id)).filter((p): p is ProductCard => Boolean(p));

  return {
    items,
    total,
    page: params.page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// ---------------------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------------------

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: ProductStatus.ACTIVE },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      displayPrice: true,
      displayMrp: true,
      hasVariants: true,
      hsnCode: true,
      gstRate: true,
      specifications: true,
      ratingAverage: true,
      ratingCount: true,
      rating1: true,
      rating2: true,
      rating3: true,
      rating4: true,
      rating5: true,
      metaTitle: true,
      metaDescription: true,
      categoryId: true,
      category: {
        select: {
          name: true,
          slug: true,
          parent: { select: { name: true, slug: true } },
        },
      },
      brand: { select: { name: true, slug: true } },
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true, alt: true, variantId: true },
      },
      variants: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          sku: true,
          label: true,
          options: true,
          price: true,
          mrp: true,
          stock: true,
        },
      },
    },
  });
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export async function getSimilarProducts(
  productId: string,
  categoryId: string,
  limit = 6,
): Promise<ProductCard[]> {
  return prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      categoryId,
      id: { not: productId },
    },
    orderBy: [{ isFeatured: "desc" }, { ratingAverage: "desc" }],
    take: limit,
    select: productCardSelect,
  });
}

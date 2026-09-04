/**
 * Seed script — realistic Indian catalog data for local development.
 * Idempotent: safe to run repeatedly (upserts by slug / sku).
 *
 * Money is in PAISE (₹1 = 100). Prices are GST-inclusive.
 * Every product has >= 1 variant (even "simple" ones get a Default variant).
 *
 * Run: npm run db:seed
 */
import { PrismaClient, ProductStatus, GstRate, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Development users. These credentials are for LOCAL DEVELOPMENT ONLY and must
 * never exist in production — the seed is not run against production data.
 */
const DEV_USERS = [
  {
    name: "Store Admin",
    email: "admin@bharatcart.test",
    password: "Admin@12345",
    role: Role.ADMIN,
  },
  {
    name: "Asha Verma",
    email: "customer@bharatcart.test",
    password: "Customer@12345",
    role: Role.CUSTOMER,
  },
];

type VariantSeed = {
  sku: string;
  label: string;
  options?: Record<string, string>;
  price: number; // paise, inclusive
  mrp: number; // paise
  stock: number;
};

type ProductSeed = {
  slug: string;
  title: string;
  description: string;
  categorySlug: string;
  brandSlug: string;
  gstRate: GstRate;
  hsnCode: string;
  specifications: { group: string; key: string; value: string }[];
  isFeatured?: boolean;
  isNewArrival?: boolean;
  variants: VariantSeed[];
};

const categories: {
  name: string;
  slug: string;
  parent?: string;
  sortOrder: number;
}[] = [
  { name: "Fashion", slug: "fashion", sortOrder: 1 },
  { name: "Men's Clothing", slug: "mens-clothing", parent: "fashion", sortOrder: 1 },
  { name: "Women's Clothing", slug: "womens-clothing", parent: "fashion", sortOrder: 2 },
  { name: "Footwear", slug: "footwear", parent: "fashion", sortOrder: 3 },
  { name: "Accessories", slug: "accessories", parent: "fashion", sortOrder: 4 },
  { name: "Home & Kitchen", slug: "home-kitchen", sortOrder: 2 },
  { name: "Cookware", slug: "cookware", parent: "home-kitchen", sortOrder: 1 },
  { name: "Home Decor", slug: "home-decor", parent: "home-kitchen", sortOrder: 2 },
  { name: "Electronics", slug: "electronics", sortOrder: 3 },
  { name: "Mobile Accessories", slug: "mobile-accessories", parent: "electronics", sortOrder: 1 },
  { name: "Audio", slug: "audio", parent: "electronics", sortOrder: 2 },
];

const brands = [
  { name: "Kosha", slug: "kosha" },
  { name: "Rangoli", slug: "rangoli" },
  { name: "Urban Dhaga", slug: "urban-dhaga" },
  { name: "Tusker", slug: "tusker" },
  { name: "Naaya", slug: "naaya" },
  { name: "Zaffron", slug: "zaffron" },
];

const APPAREL_SIZES = ["S", "M", "L", "XL"];

/** Build size/color variants for an apparel product. */
function apparelVariants(
  skuBase: string,
  price: number,
  mrp: number,
  colors: string[],
): VariantSeed[] {
  const variants: VariantSeed[] = [];
  for (const color of colors) {
    for (const size of APPAREL_SIZES) {
      variants.push({
        sku: `${skuBase}-${color.slice(0, 3).toUpperCase()}-${size}`,
        label: `${color} / ${size}`,
        options: { Color: color, Size: size },
        price,
        mrp,
        stock: Math.floor(Math.random() * 25),
      });
    }
  }
  return variants;
}

/** A single "Default" variant for simple products. */
function simpleVariant(sku: string, price: number, mrp: number, stock: number): VariantSeed[] {
  return [{ sku, label: "Default", price, mrp, stock }];
}

const products: ProductSeed[] = [
  {
    slug: "kosha-cotton-kurta-mens",
    title: "Kosha Men's Handloom Cotton Kurta",
    description:
      "Breathable handloom cotton kurta with a mandarin collar and wooden buttons. Perfect for daily wear and festive occasions.",
    categorySlug: "mens-clothing",
    brandSlug: "kosha",
    gstRate: GstRate.FIVE,
    hsnCode: "6205",
    specifications: [
      { group: "Fabric", key: "Material", value: "100% Cotton" },
      { group: "Fit", key: "Fit", value: "Regular" },
      { group: "Care", key: "Wash", value: "Machine wash cold" },
    ],
    isFeatured: true,
    variants: apparelVariants("KSH-KURTA", 129900, 199900, ["Ivory", "Indigo", "Olive"]),
  },
  {
    slug: "rangoli-anarkali-kurti-womens",
    title: "Rangoli Women's Printed Anarkali Kurti",
    description:
      "Flowy Anarkali kurti with an all-over block print and three-quarter sleeves. Pairs beautifully with leggings or palazzos.",
    categorySlug: "womens-clothing",
    brandSlug: "rangoli",
    gstRate: GstRate.FIVE,
    hsnCode: "6211",
    specifications: [
      { group: "Fabric", key: "Material", value: "Rayon" },
      { group: "Fit", key: "Length", value: "Calf length" },
      { group: "Care", key: "Wash", value: "Hand wash" },
    ],
    isFeatured: true,
    isNewArrival: true,
    variants: apparelVariants("RNG-ANRK", 89900, 149900, ["Maroon", "Teal"]),
  },
  {
    slug: "urban-dhaga-slim-jeans-mens",
    title: "Urban Dhaga Men's Slim Fit Stretch Jeans",
    description:
      "Mid-rise slim fit jeans with a hint of stretch for all-day comfort. Five-pocket styling in a clean wash.",
    categorySlug: "mens-clothing",
    brandSlug: "urban-dhaga",
    gstRate: GstRate.FIVE,
    hsnCode: "6203",
    specifications: [
      { group: "Fabric", key: "Material", value: "98% Cotton, 2% Elastane" },
      { group: "Fit", key: "Fit", value: "Slim" },
    ],
    isNewArrival: true,
    variants: apparelVariants("URD-JEAN", 159900, 249900, ["Dark Blue", "Black"]),
  },
  {
    slug: "naaya-cotton-tshirt-womens",
    title: "Naaya Women's Relaxed Cotton T-Shirt",
    description: "Soft combed-cotton tee with a relaxed fit and a ribbed crew neck.",
    categorySlug: "womens-clothing",
    brandSlug: "naaya",
    gstRate: GstRate.FIVE,
    hsnCode: "6109",
    specifications: [
      { group: "Fabric", key: "Material", value: "100% Combed Cotton" },
      { group: "Fit", key: "Fit", value: "Relaxed" },
    ],
    variants: apparelVariants("NYA-TEE", 49900, 79900, ["White", "Blush", "Sage"]),
  },
  {
    slug: "tusker-leather-loafers-mens",
    title: "Tusker Men's Handcrafted Leather Loafers",
    description:
      "Genuine leather slip-on loafers with cushioned insoles and a durable TPR sole. Handcrafted in Kanpur.",
    categorySlug: "footwear",
    brandSlug: "tusker",
    gstRate: GstRate.EIGHTEEN,
    hsnCode: "6403",
    specifications: [
      { group: "Material", key: "Upper", value: "Genuine Leather" },
      { group: "Material", key: "Sole", value: "TPR" },
    ],
    isFeatured: true,
    variants: [6, 7, 8, 9, 10].map((size) => ({
      sku: `TSK-LOAF-${size}`,
      label: `UK ${size}`,
      options: { Size: `UK ${size}` },
      price: 249900,
      mrp: 399900,
      stock: Math.floor(Math.random() * 15),
    })),
  },
  {
    slug: "zaffron-canvas-sneakers",
    title: "Zaffron Unisex Canvas Sneakers",
    description:
      "Everyday lace-up canvas sneakers with a vulcanised rubber sole and memory-foam footbed.",
    categorySlug: "footwear",
    brandSlug: "zaffron",
    gstRate: GstRate.EIGHTEEN,
    hsnCode: "6404",
    specifications: [
      { group: "Material", key: "Upper", value: "Canvas" },
      { group: "Material", key: "Sole", value: "Rubber" },
    ],
    isNewArrival: true,
    variants: [5, 6, 7, 8, 9, 10, 11].map((size) => ({
      sku: `ZFR-SNKR-${size}`,
      label: `UK ${size}`,
      options: { Size: `UK ${size}` },
      price: 119900,
      mrp: 179900,
      stock: Math.floor(Math.random() * 20),
    })),
  },
  {
    slug: "kosha-leather-belt-mens",
    title: "Kosha Men's Reversible Leather Belt",
    description: "Reversible black/brown genuine leather belt with a brushed steel buckle.",
    categorySlug: "accessories",
    brandSlug: "kosha",
    gstRate: GstRate.EIGHTEEN,
    hsnCode: "4203",
    specifications: [{ group: "Material", key: "Material", value: "Genuine Leather" }],
    variants: simpleVariant("KSH-BELT", 79900, 129900, 40),
  },
  {
    slug: "rangoli-silk-scarf",
    title: "Rangoli Women's Printed Silk Scarf",
    description: "Lightweight mulberry-silk scarf with a hand-drawn paisley motif.",
    categorySlug: "accessories",
    brandSlug: "rangoli",
    gstRate: GstRate.FIVE,
    hsnCode: "6214",
    specifications: [{ group: "Material", key: "Material", value: "Mulberry Silk" }],
    isNewArrival: true,
    variants: simpleVariant("RNG-SCRF", 59900, 99900, 30),
  },
  {
    slug: "tusker-triply-kadai",
    title: "Tusker Tri-Ply Stainless Steel Kadai (2.5L)",
    description:
      "Induction-friendly tri-ply kadai with an aluminium core for even heating and a tempered glass lid.",
    categorySlug: "cookware",
    brandSlug: "tusker",
    gstRate: GstRate.TWELVE,
    hsnCode: "7323",
    specifications: [
      { group: "Capacity", key: "Volume", value: "2.5 L" },
      { group: "Compatibility", key: "Cooktop", value: "Gas & Induction" },
    ],
    isFeatured: true,
    variants: simpleVariant("TSK-KADAI", 249900, 349900, 18),
  },
  {
    slug: "naaya-nonstick-tawa",
    title: "Naaya Non-Stick Dosa Tawa (28cm)",
    description:
      "PFOA-free non-stick dosa tawa with a heat-resistant handle. Even browning, easy release.",
    categorySlug: "cookware",
    brandSlug: "naaya",
    gstRate: GstRate.TWELVE,
    hsnCode: "7615",
    specifications: [
      { group: "Dimensions", key: "Diameter", value: "28 cm" },
      { group: "Coating", key: "Type", value: "PFOA-free non-stick" },
    ],
    variants: simpleVariant("NYA-TAWA", 89900, 139900, 25),
  },
  {
    slug: "rangoli-terracotta-planter-set",
    title: "Rangoli Hand-Painted Terracotta Planter (Set of 3)",
    description:
      "Set of three hand-painted terracotta planters with drainage holes and matching saucers.",
    categorySlug: "home-decor",
    brandSlug: "rangoli",
    gstRate: GstRate.TWELVE,
    hsnCode: "6912",
    specifications: [
      { group: "Set", key: "Pieces", value: "3 planters + 3 saucers" },
      { group: "Material", key: "Material", value: "Terracotta" },
    ],
    isNewArrival: true,
    variants: simpleVariant("RNG-PLNT", 99900, 159900, 22),
  },
  {
    slug: "kosha-cotton-cushion-covers",
    title: "Kosha Woven Cotton Cushion Covers (Set of 5)",
    description:
      "Set of five 16x16 inch woven cotton cushion covers with hidden zippers. Jaipur block prints.",
    categorySlug: "home-decor",
    brandSlug: "kosha",
    gstRate: GstRate.FIVE,
    hsnCode: "6304",
    specifications: [
      { group: "Set", key: "Pieces", value: "5 covers" },
      { group: "Dimensions", key: "Size", value: "16 x 16 in" },
    ],
    isFeatured: true,
    variants: simpleVariant("KSH-CUSH", 69900, 119900, 35),
  },
  {
    slug: "zaffron-wireless-earbuds",
    title: "Zaffron Pulse Wireless Earbuds",
    description:
      "True wireless earbuds with 30-hour total battery, ENC calling, and low-latency game mode. IPX5 water resistant.",
    categorySlug: "audio",
    brandSlug: "zaffron",
    gstRate: GstRate.EIGHTEEN,
    hsnCode: "8518",
    specifications: [
      { group: "Battery", key: "Playback", value: "30 hrs total" },
      { group: "Connectivity", key: "Bluetooth", value: "5.3" },
      { group: "Durability", key: "Rating", value: "IPX5" },
    ],
    isFeatured: true,
    isNewArrival: true,
    variants: [
      {
        sku: "ZFR-BUDS-BLK",
        label: "Black",
        options: { Color: "Black" },
        price: 179900,
        mrp: 299900,
        stock: 40,
      },
      {
        sku: "ZFR-BUDS-WHT",
        label: "White",
        options: { Color: "White" },
        price: 179900,
        mrp: 299900,
        stock: 28,
      },
    ],
  },
  {
    slug: "tusker-bluetooth-speaker",
    title: "Tusker BoomBox Portable Bluetooth Speaker",
    description:
      "Punchy 20W portable speaker with 12-hour battery, TWS pairing, and a rugged fabric finish.",
    categorySlug: "audio",
    brandSlug: "tusker",
    gstRate: GstRate.EIGHTEEN,
    hsnCode: "8518",
    specifications: [
      { group: "Output", key: "Power", value: "20 W" },
      { group: "Battery", key: "Playback", value: "12 hrs" },
    ],
    variants: simpleVariant("TSK-SPKR", 219900, 349900, 20),
  },
  {
    slug: "naaya-braided-usb-c-cable",
    title: "Naaya 65W Braided USB-C to USB-C Cable (1.5m)",
    description:
      "Nylon-braided 65W fast-charging USB-C cable with a 480Mbps data rate. Tangle-free and durable.",
    categorySlug: "mobile-accessories",
    brandSlug: "naaya",
    gstRate: GstRate.EIGHTEEN,
    hsnCode: "8544",
    specifications: [
      { group: "Charging", key: "Power", value: "65 W" },
      { group: "Length", key: "Length", value: "1.5 m" },
    ],
    variants: simpleVariant("NYA-CBL", 39900, 69900, 80),
  },
  {
    slug: "urban-dhaga-phone-crossbody",
    title: "Urban Dhaga Canvas Phone Crossbody Bag",
    description:
      "Compact canvas crossbody with an adjustable strap and card slots. Fits phones up to 6.7 inches.",
    categorySlug: "mobile-accessories",
    brandSlug: "urban-dhaga",
    gstRate: GstRate.EIGHTEEN,
    hsnCode: "4202",
    specifications: [
      { group: "Material", key: "Material", value: "Canvas" },
      { group: "Fit", key: "Phone size", value: "Up to 6.7 in" },
    ],
    isNewArrival: true,
    variants: [
      {
        sku: "URD-XBODY-OLV",
        label: "Olive",
        options: { Color: "Olive" },
        price: 84900,
        mrp: 129900,
        stock: 18,
      },
      {
        sku: "URD-XBODY-RUS",
        label: "Rust",
        options: { Color: "Rust" },
        price: 84900,
        mrp: 129900,
        stock: 14,
      },
    ],
  },
];

async function main() {
  console.log("Seeding dev users...");
  for (const u of DEV_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash, emailVerified: new Date() },
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        passwordHash,
        emailVerified: new Date(),
      },
    });

    // Reset the dev user's cart so local/e2e runs start from a known state.
    const devCart = await prisma.cart.findUnique({ where: { userId: user.id } });
    if (devCart) {
      await prisma.cartItem.deleteMany({ where: { cartId: devCart.id } });
    }

    // Give the dev customer a default address so checkout is testable.
    if (u.role === Role.CUSTOMER) {
      const existing = await prisma.address.findFirst({ where: { userId: user.id } });
      if (!existing) {
        await prisma.address.create({
          data: {
            userId: user.id,
            fullName: u.name,
            phone: "9876543210",
            line1: "12, MG Road",
            line2: "Indiranagar",
            city: "Bengaluru",
            state: "Karnataka",
            pincode: "560038",
            isDefault: true,
          },
        });
      }
    }
  }

  console.log("Seeding categories...");
  // First pass: create categories without parents.
  const catIdBySlug = new Map<string, string>();
  for (const c of categories.filter((c) => !c.parent)) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: { name: c.name, slug: c.slug, sortOrder: c.sortOrder },
    });
    catIdBySlug.set(c.slug, row.id);
  }
  // Second pass: children.
  for (const c of categories.filter((c) => c.parent)) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sortOrder, parentId: catIdBySlug.get(c.parent!) },
      create: {
        name: c.name,
        slug: c.slug,
        sortOrder: c.sortOrder,
        parentId: catIdBySlug.get(c.parent!),
      },
    });
    catIdBySlug.set(c.slug, row.id);
  }

  console.log("Seeding brands...");
  const brandIdBySlug = new Map<string, string>();
  for (const b of brands) {
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name },
      create: { name: b.name, slug: b.slug },
    });
    brandIdBySlug.set(b.slug, row.id);
  }

  console.log(`Seeding ${products.length} products...`);
  for (const p of products) {
    const prices = p.variants.map((v) => v.price);
    const mrps = p.variants.map((v) => v.mrp);
    const displayPrice = Math.min(...prices);
    const displayMrp = Math.min(...mrps);
    const hasVariants = p.variants.length > 1;

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        description: p.description,
        status: ProductStatus.ACTIVE,
        categoryId: catIdBySlug.get(p.categorySlug)!,
        brandId: brandIdBySlug.get(p.brandSlug)!,
        displayPrice,
        displayMrp,
        hasVariants,
        hsnCode: p.hsnCode,
        gstRate: p.gstRate,
        specifications: p.specifications,
        isFeatured: p.isFeatured ?? false,
        isNewArrival: p.isNewArrival ?? false,
        metaTitle: p.title,
        metaDescription: p.description.slice(0, 155),
      },
      create: {
        slug: p.slug,
        title: p.title,
        description: p.description,
        status: ProductStatus.ACTIVE,
        categoryId: catIdBySlug.get(p.categorySlug)!,
        brandId: brandIdBySlug.get(p.brandSlug)!,
        displayPrice,
        displayMrp,
        hasVariants,
        hsnCode: p.hsnCode,
        gstRate: p.gstRate,
        specifications: p.specifications,
        isFeatured: p.isFeatured ?? false,
        isNewArrival: p.isNewArrival ?? false,
        metaTitle: p.title,
        metaDescription: p.description.slice(0, 155),
      },
    });

    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          productId: product.id,
          label: v.label,
          options: v.options ?? undefined,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
          isActive: true,
        },
        create: {
          productId: product.id,
          sku: v.sku,
          label: v.label,
          options: v.options ?? undefined,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
          isActive: true,
        },
      });
    }
  }

  const counts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    brands: await prisma.brand.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

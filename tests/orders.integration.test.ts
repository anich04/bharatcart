import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  createPendingOrder,
  confirmOrder,
  CheckoutError,
  InsufficientStockError,
} from "@/lib/orders/service";

const tag = randomBytes(4).toString("hex");
const ids: {
  categoryId?: string;
  brandId?: string;
  productId?: string;
  variantId?: string;
  userA?: string;
  userB?: string;
} = {};

async function makeUser(label: string) {
  const u = await prisma.user.create({
    data: { email: `test-${label}-${tag}@example.test`, name: `Test ${label}`, role: "CUSTOMER" },
  });
  await prisma.address.create({
    data: {
      userId: u.id,
      fullName: `Test ${label}`,
      phone: "9876543210",
      line1: "1 Test Street",
      city: "Bengaluru",
      state: "Karnataka", // same as SELLER_STATE => CGST/SGST
      pincode: "560001",
      isDefault: true,
    },
  });
  return u.id;
}

async function setStock(qty: number) {
  await prisma.productVariant.update({
    where: { id: ids.variantId! },
    data: { stock: qty },
  });
}

async function putInCart(userId: string, quantity = 1) {
  const cart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: ids.variantId! } },
    update: { quantity },
    create: { cartId: cart.id, variantId: ids.variantId!, quantity },
  });
}

async function addressOf(userId: string) {
  const a = await prisma.address.findFirst({ where: { userId } });
  return a!.id;
}

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: `Test Cat ${tag}`, slug: `test-cat-${tag}` },
  });
  const brand = await prisma.brand.create({
    data: { name: `Test Brand ${tag}`, slug: `test-brand-${tag}` },
  });
  const product = await prisma.product.create({
    data: {
      slug: `test-product-${tag}`,
      title: "Test Product",
      description: "For integration tests",
      status: "ACTIVE",
      categoryId: category.id,
      brandId: brand.id,
      displayPrice: 118000, // ₹1,180 inclusive @18% => ₹1,000 + ₹180
      displayMrp: 150000,
      gstRate: "EIGHTEEN",
      hsnCode: "9999",
      variants: {
        create: {
          sku: `TEST-SKU-${tag}`,
          label: "Default",
          price: 118000,
          mrp: 150000,
          stock: 5,
        },
      },
    },
    include: { variants: true },
  });

  ids.categoryId = category.id;
  ids.brandId = brand.id;
  ids.productId = product.id;
  ids.variantId = product.variants[0].id;
  ids.userA = await makeUser("a");
  ids.userB = await makeUser("b");
});

afterAll(async () => {
  // Children first (FKs), then parents.
  const userIds = [ids.userA!, ids.userB!];
  const orders = await prisma.order.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  await prisma.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { variantId: ids.variantId } });
  await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.productVariant.deleteMany({ where: { productId: ids.productId } });
  await prisma.product.deleteMany({ where: { id: ids.productId } });
  await prisma.brand.deleteMany({ where: { id: ids.brandId } });
  await prisma.category.deleteMany({ where: { id: ids.categoryId } });
  await prisma.$disconnect();
});

describe("order creation", () => {
  it("recomputes totals from the database, not the client", async () => {
    await setStock(5);
    await putInCart(ids.userA!, 2);

    const order = await createPendingOrder({
      userId: ids.userA!,
      addressId: await addressOf(ids.userA!),
      paymentMode: "PREPAID",
    });

    // 2 x ₹1,180 = ₹2,360, above the free-shipping threshold.
    expect(order.itemsSubtotal).toBe(236000);
    expect(order.shippingTotal).toBe(0);
    expect(order.codCharge).toBe(0);
    expect(order.grandTotal).toBe(236000);
    expect(order.status).toBe("PENDING");

    // Intra-state => CGST + SGST, no IGST, and tax reconciles.
    expect(order.igstTotal).toBe(0);
    expect(order.taxableTotal + order.cgstTotal + order.sgstTotal).toBe(order.grandTotal);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].unitPrice).toBe(118000);
  });

  it("refuses an address belonging to another user", async () => {
    await setStock(5);
    await putInCart(ids.userA!, 1);
    const foreignAddress = await addressOf(ids.userB!);

    await expect(
      createPendingOrder({
        userId: ids.userA!,
        addressId: foreignAddress,
        paymentMode: "PREPAID",
      }),
    ).rejects.toBeInstanceOf(CheckoutError);
  });

  it("refuses to create an order from an empty cart", async () => {
    const cart = await prisma.cart.findUnique({ where: { userId: ids.userB! } });
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    await expect(
      createPendingOrder({
        userId: ids.userB!,
        addressId: await addressOf(ids.userB!),
        paymentMode: "PREPAID",
      }),
    ).rejects.toBeInstanceOf(CheckoutError);
  });
});

describe("confirmOrder — stock and idempotency", () => {
  it("decrements stock inside the confirming transaction", async () => {
    await setStock(5);
    await putInCart(ids.userA!, 2);
    const order = await createPendingOrder({
      userId: ids.userA!,
      addressId: await addressOf(ids.userA!),
      paymentMode: "COD",
    });

    const res = await confirmOrder({
      orderId: order.id,
      payment: { provider: "COD", status: "COD_PENDING" },
    });
    expect(res.alreadyProcessed).toBe(false);

    const variant = await prisma.productVariant.findUnique({ where: { id: ids.variantId! } });
    expect(variant!.stock).toBe(3);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe("CONFIRMED");
    expect(updated!.invoiceNumber).toBeTruthy();
  });

  it("is idempotent — a repeated confirmation never double-decrements", async () => {
    await setStock(5);
    await putInCart(ids.userA!, 1);
    const order = await createPendingOrder({
      userId: ids.userA!,
      addressId: await addressOf(ids.userA!),
      paymentMode: "COD",
    });

    const first = await confirmOrder({
      orderId: order.id,
      payment: { provider: "COD", status: "COD_PENDING" },
    });
    const stockAfterFirst = (await prisma.productVariant.findUnique({
      where: { id: ids.variantId! },
    }))!.stock;

    // Simulate the same webhook arriving three more times.
    for (let i = 0; i < 3; i++) {
      const again = await confirmOrder({
        orderId: order.id,
        payment: { provider: "COD", status: "COD_PENDING" },
      });
      expect(again.alreadyProcessed).toBe(true);
    }

    const stockAfterRepeats = (await prisma.productVariant.findUnique({
      where: { id: ids.variantId! },
    }))!.stock;

    expect(first.alreadyProcessed).toBe(false);
    expect(stockAfterFirst).toBe(4);
    expect(stockAfterRepeats).toBe(stockAfterFirst);
  });

  it("lets only ONE of two buyers win the last unit", async () => {
    await setStock(1);
    await putInCart(ids.userA!, 1);
    await putInCart(ids.userB!, 1);

    const [orderA, orderB] = await Promise.all([
      createPendingOrder({
        userId: ids.userA!,
        addressId: await addressOf(ids.userA!),
        paymentMode: "COD",
      }),
      createPendingOrder({
        userId: ids.userB!,
        addressId: await addressOf(ids.userB!),
        paymentMode: "COD",
      }),
    ]);

    const results = await Promise.allSettled([
      confirmOrder({ orderId: orderA.id, payment: { provider: "COD", status: "COD_PENDING" } }),
      confirmOrder({ orderId: orderB.id, payment: { provider: "COD", status: "COD_PENDING" } }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);

    // Stock never goes negative, and the loser's order stays PENDING.
    const variant = await prisma.productVariant.findUnique({ where: { id: ids.variantId! } });
    expect(variant!.stock).toBe(0);

    const statuses = await prisma.order.findMany({
      where: { id: { in: [orderA.id, orderB.id] } },
      select: { status: true },
    });
    expect(statuses.filter((s) => s.status === "CONFIRMED")).toHaveLength(1);
    expect(statuses.filter((s) => s.status === "PENDING")).toHaveLength(1);
  });

  it("never oversells under a burst of concurrent confirmations", async () => {
    await setStock(3);

    // Five separate single-unit orders competing for three units.
    const orders = [];
    for (let i = 0; i < 5; i++) {
      const userId = i % 2 === 0 ? ids.userA! : ids.userB!;
      await putInCart(userId, 1);
      orders.push(
        await createPendingOrder({
          userId,
          addressId: await addressOf(userId),
          paymentMode: "COD",
        }),
      );
    }

    const results = await Promise.allSettled(
      orders.map((o) =>
        confirmOrder({ orderId: o.id, payment: { provider: "COD", status: "COD_PENDING" } }),
      ),
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const variant = await prisma.productVariant.findUnique({ where: { id: ids.variantId! } });

    expect(ok).toBe(3);
    expect(variant!.stock).toBe(0);
  });
});

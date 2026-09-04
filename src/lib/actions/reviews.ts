"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdminAction, ForbiddenError } from "@/lib/admin/guard";

type Result = { ok: boolean; error?: string };

const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1, "Pick a rating").max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body: z.string().trim().min(1, "Please write a few words").max(5000),
  images: z.array(z.string().url()).max(5).default([]),
});

/**
 * Recompute the denormalized rating aggregates on the product.
 * Hidden reviews are excluded so moderation immediately affects the score.
 */
async function recomputeProductRating(productId: string) {
  const groups = await prisma.review.groupBy({
    by: ["rating"],
    where: { productId, isHidden: false },
    _count: { rating: true },
  });

  const counts = [0, 0, 0, 0, 0]; // index 0 => 1 star
  for (const g of groups) counts[g.rating - 1] = g._count.rating;

  const ratingCount = counts.reduce((a, b) => a + b, 0);
  const weighted = counts.reduce((sum, c, i) => sum + c * (i + 1), 0);
  const ratingAverage = ratingCount > 0 ? weighted / ratingCount : 0;

  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingCount,
      ratingAverage,
      rating1: counts[0],
      rating2: counts[1],
      rating3: counts[2],
      rating4: counts[3],
      rating5: counts[4],
    },
  });
}

/**
 * Create or update the signed-in user's review for a product.
 * ENFORCED SERVER-SIDE: only a user with a DELIVERED order containing this
 * product may review it, and only once (editable thereafter).
 */
export async function submitReviewAction(input: unknown): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in to review." };
  const userId = session.user.id;

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid review" };
  }
  const { productId, rating, title, body, images } = parsed.data;

  const limit = rateLimit(`review:${userId}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return { ok: false, error: `Too many reviews. Try again in ${limit.retryAfterSec}s.` };
  }

  // Verified purchase: a DELIVERED order of this user containing this product.
  const deliveredItem = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId, status: "DELIVERED" },
    },
    select: { orderId: true },
    orderBy: { id: "desc" },
  });
  if (!deliveredItem) {
    return {
      ok: false,
      error: "You can review this product once your order has been delivered.",
    };
  }

  const existing = await prisma.review.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.review.update({
      where: { id: existing.id },
      data: { rating, title: title || null, body, images },
    });
  } else {
    await prisma.review.create({
      data: {
        userId,
        productId,
        orderId: deliveredItem.orderId,
        rating,
        title: title || null,
        body,
        images,
        isVerifiedPurchase: true,
      },
    });
  }

  await recomputeProductRating(productId);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (product) revalidatePath(`/p/${product.slug}`);
  return { ok: true };
}

export async function deleteOwnReviewAction(productId: string): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };

  await prisma.review.deleteMany({
    where: { userId: session.user.id, productId },
  });
  await recomputeProductRating(productId);
  return { ok: true };
}

/** Admin moderation: hide or unhide an abusive review. */
export async function setReviewHiddenAction(reviewId: string, isHidden: boolean): Promise<Result> {
  try {
    await requireAdminAction();
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "Forbidden" };
    throw e;
  }

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: { isHidden },
    select: { productId: true },
  });
  await recomputeProductRating(review.productId);
  revalidatePath("/admin/reviews");
  return { ok: true };
}

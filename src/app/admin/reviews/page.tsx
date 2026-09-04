import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RatingStars } from "@/components/rating-stars";
import { ReviewModerationButton } from "@/components/admin/review-moderation";

export const metadata: Metadata = { title: "Reviews · Admin" };

const PAGE_SIZE = 25;

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; hidden?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const onlyHidden = sp.hidden === "1";

  const where = onlyHidden ? { isHidden: true } : {};

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        isHidden: true,
        isVerifiedPurchase: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        product: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Reviews ({total})</h2>
        <div className="flex gap-2">
          <Link
            href="/admin/reviews"
            className={
              !onlyHidden
                ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs"
                : "border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
            }
          >
            All
          </Link>
          <Link
            href="/admin/reviews?hidden=1"
            className={
              onlyHidden
                ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs"
                : "border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
            }
          >
            Hidden only
          </Link>
        </div>
      </div>

      <div className="border-border divide-border divide-y rounded-lg border">
        {reviews.length === 0 && (
          <p className="text-muted-foreground p-6 text-center text-sm">No reviews.</p>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="flex flex-col gap-1 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars value={r.rating} />
                {r.title && <span className="font-medium">{r.title}</span>}
                {r.isHidden && (
                  <span className="bg-destructive/10 text-destructive rounded px-2 py-0.5 text-xs">
                    Hidden
                  </span>
                )}
              </div>
              <ReviewModerationButton reviewId={r.id} isHidden={r.isHidden} />
            </div>
            <p className="text-muted-foreground text-xs">
              {r.user.name ?? r.user.email} on{" "}
              <Link href={`/p/${r.product.slug}`} className="hover:underline">
                {r.product.title}
              </Link>{" "}
              · {r.createdAt.toLocaleDateString("en-IN")}
              {r.isVerifiedPurchase ? " · verified" : ""}
            </p>
            <p className="line-clamp-3 text-sm">{r.body}</p>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/reviews?page=${page - 1}${onlyHidden ? "&hidden=1" : ""}`}
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
            >
              Previous
            </Link>
          )}
          <span className="text-muted-foreground px-3 py-1.5">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/reviews?page=${page + 1}${onlyHidden ? "&hidden=1" : ""}`}
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

import { BadgeCheck } from "lucide-react";
import { RatingStars } from "@/components/rating-stars";

export type ReviewItem = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  user: { name: string | null };
};

export function ReviewList({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No written reviews yet. Verified buyers can review after delivery.
      </p>
    );
  }

  return (
    <ul className="divide-border flex flex-col divide-y">
      {reviews.map((r) => (
        <li key={r.id} className="py-4">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <RatingStars value={r.rating} />
            {r.title && <span className="text-sm font-medium">{r.title}</span>}
          </div>
          <p className="text-muted-foreground mb-1 flex flex-wrap items-center gap-2 text-xs">
            <span>{r.user.name ?? "Customer"}</span>
            <span>· {r.createdAt.toLocaleDateString("en-IN")}</span>
            {r.isVerifiedPurchase && (
              <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-500">
                <BadgeCheck className="size-3.5" /> Verified Purchase
              </span>
            )}
          </p>
          <p className="text-sm leading-6 whitespace-pre-line">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}

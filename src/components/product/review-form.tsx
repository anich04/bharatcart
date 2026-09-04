"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { submitReviewAction } from "@/lib/actions/reviews";
import { cn } from "@/lib/utils";

export function ReviewForm({
  productId,
  existing,
}: {
  productId: string;
  existing: { rating: number; title: string | null; body: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-input hover:bg-muted w-fit rounded-md border px-4 py-2 text-sm font-medium"
      >
        {existing ? "Edit your review" : "Write a review"}
      </button>
    );
  }

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await submitReviewAction({ productId, rating, title, body, images: [] });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Could not save your review.");
      }
    });

  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
      {error && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium">Your rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              <Star
                className={cn(
                  "size-6",
                  (hover || rating) >= n
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        maxLength={120}
        className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you think of this product?"
        rows={4}
        maxLength={5000}
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
      />

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending || rating === 0 || body.trim() === ""}
          className="bg-primary text-primary-foreground h-10 rounded-md px-4 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Saving…" : existing ? "Update review" : "Submit review"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="border-input hover:bg-muted h-10 rounded-md border px-4 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

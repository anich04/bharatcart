"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setReviewHiddenAction } from "@/lib/actions/reviews";

export function ReviewModerationButton({
  reviewId,
  isHidden,
}: {
  reviewId: string;
  isHidden: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setReviewHiddenAction(reviewId, !isHidden);
          router.refresh();
        })
      }
      className={
        isHidden
          ? "text-primary text-xs hover:underline disabled:opacity-50"
          : "text-destructive text-xs hover:underline disabled:opacity-50"
      }
    >
      {pending ? "…" : isHidden ? "Unhide" : "Hide"}
    </button>
  );
}

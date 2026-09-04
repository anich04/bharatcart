"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { removeWishlistAction } from "@/lib/actions/wishlist";

export function RemoveWishlistButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await removeWishlistAction(productId);
          router.refresh();
        })
      }
      className="text-muted-foreground hover:text-destructive text-xs disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleWishlistAction } from "@/lib/actions/wishlist";
import { cn } from "@/lib/utils";

export function WishlistButton({
  productId,
  authed,
  initialInWishlist,
}: {
  productId: string;
  authed: boolean;
  initialInWishlist: boolean;
}) {
  const router = useRouter();
  const [inWishlist, setInWishlist] = useState(initialInWishlist);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!authed) {
      router.push(`/login?callbackUrl=/p`);
      return;
    }
    startTransition(async () => {
      const res = await toggleWishlistAction(productId);
      if (res.ok) setInWishlist(!!res.inWishlist);
    });
  };

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="border-input hover:bg-muted flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium disabled:opacity-60"
    >
      <Heart className={cn("size-4", inWishlist && "fill-red-500 text-red-500")} />
      {inWishlist ? "Saved" : "Save"}
    </button>
  );
}

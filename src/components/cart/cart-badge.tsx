"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./cart-provider";

export function CartBadge() {
  const { itemCount } = useCart();
  return (
    <Link
      href="/cart"
      className="hover:bg-muted relative flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm"
    >
      <span className="relative">
        <ShoppingCart className="size-4" />
        {itemCount > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </span>
      <span className="hidden md:inline">Cart</span>
    </Link>
  );
}

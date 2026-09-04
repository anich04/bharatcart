"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  addToCartAction,
  setCartQuantityAction,
  mergeGuestCartAction,
  getCartDetails,
} from "@/lib/cart/actions";
import type { CartInput } from "@/lib/cart/pricing";

const STORAGE_KEY = "bharatcart_cart";

type CartContextValue = {
  items: CartInput[];
  itemCount: number;
  authed: boolean;
  pending: boolean;
  add: (variantId: string, quantity?: number, stock?: number) => Promise<void>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function readLocal(): CartInput[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i) => i?.variantId && i.quantity > 0);
  } catch {
    return [];
  }
}

function writeLocal(items: CartInput[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota/private-mode errors */
  }
}

export function CartProvider({
  authed,
  initialItems,
  children,
}: {
  authed: boolean;
  initialItems: CartInput[];
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartInput[]>(initialItems);
  const [pending, startTransition] = useTransition();
  const merged = useRef(false);

  const refresh = useCallback(async () => {
    const priced = await getCartDetails(authed ? [] : readLocal());
    setItems(priced.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })));
  }, [authed]);

  // On mount: guests hydrate from localStorage; a fresh login merges the
  // guest cart into the DB once, then clears localStorage.
  useEffect(() => {
    if (authed) {
      const guest = readLocal();
      if (guest.length > 0 && !merged.current) {
        merged.current = true;
        startTransition(async () => {
          await mergeGuestCartAction(guest);
          writeLocal([]);
          await refresh();
        });
      }
    } else {
      setItems(readLocal());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const add = useCallback(
    async (variantId: string, quantity = 1, stock?: number) => {
      if (authed) {
        startTransition(async () => {
          await addToCartAction(variantId, quantity);
          await refresh();
        });
        return;
      }
      setItems((prev) => {
        const next = [...prev];
        const idx = next.findIndex((i) => i.variantId === variantId);
        const cap = stock ?? 99;
        if (idx >= 0) {
          next[idx] = {
            variantId,
            quantity: Math.min(cap, 99, next[idx].quantity + quantity),
          };
        } else {
          next.push({ variantId, quantity: Math.min(cap, 99, quantity) });
        }
        writeLocal(next);
        return next;
      });
    },
    [authed, refresh],
  );

  const setQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      if (authed) {
        startTransition(async () => {
          await setCartQuantityAction(variantId, quantity);
          await refresh();
        });
        return;
      }
      setItems((prev) => {
        const next =
          quantity <= 0
            ? prev.filter((i) => i.variantId !== variantId)
            : prev.map((i) => (i.variantId === variantId ? { variantId, quantity } : i));
        writeLocal(next);
        return next;
      });
    },
    [authed, refresh],
  );

  const remove = useCallback(async (variantId: string) => setQuantity(variantId, 0), [setQuantity]);

  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, itemCount, authed, pending, add, setQuantity, remove, refresh }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

import Link from "next/link";
import { Search, User, ChevronDown } from "lucide-react";
import { auth } from "@/auth";
import { getCategoryTree } from "@/lib/catalog/queries";
import { logoutAction } from "@/lib/actions/auth";
import { CartBadge } from "@/components/cart/cart-badge";

const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? "BharatCart";

export async function SiteHeader() {
  let categories: Awaited<ReturnType<typeof getCategoryTree>> = [];
  try {
    categories = await getCategoryTree();
  } catch (err) {
    console.error("SiteHeader: failed to load categories", err);
  }
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-border bg-background sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold">
            B
          </span>
          <span className="hidden text-lg font-semibold tracking-tight sm:inline">{storeName}</span>
        </Link>

        <form action="/search" method="get" className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="search"
            name="q"
            placeholder={`Search ${storeName}`}
            aria-label="Search products"
            className="border-input bg-muted/40 focus:ring-ring h-9 w-full rounded-md border pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
        </form>

        <nav className="flex shrink-0 items-center gap-1">
          {/* Account menu (no-JS dropdown via <details>) */}
          <details className="group relative">
            <summary className="hover:bg-muted flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
              <User className="size-4" />
              <span className="hidden max-w-24 truncate md:inline">
                {user ? (user.name?.split(" ")[0] ?? "Account") : "Account"}
              </span>
              <ChevronDown className="size-3" />
            </summary>
            <div className="border-border bg-popover absolute right-0 z-50 mt-1 w-48 rounded-md border p-1 shadow-md">
              {user ? (
                <>
                  <Link href="/account" className="hover:bg-muted block rounded px-3 py-2 text-sm">
                    My account
                  </Link>
                  <Link
                    href="/account/orders"
                    className="hover:bg-muted block rounded px-3 py-2 text-sm"
                  >
                    My orders
                  </Link>
                  <Link href="/wishlist" className="hover:bg-muted block rounded px-3 py-2 text-sm">
                    Wishlist
                  </Link>
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="hover:bg-muted block w-full rounded px-3 py-2 text-left text-sm"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:bg-muted block rounded px-3 py-2 text-sm">
                    Sign in
                  </Link>
                  <Link href="/signup" className="hover:bg-muted block rounded px-3 py-2 text-sm">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </details>

          <CartBadge />
        </nav>
      </div>

      <div className="border-border/60 bg-muted/30 border-t">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1.5 text-sm">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="hover:bg-background text-muted-foreground hover:text-foreground rounded px-2.5 py-1 whitespace-nowrap"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

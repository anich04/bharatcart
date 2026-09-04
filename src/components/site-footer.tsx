import Link from "next/link";

const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? "BharatCart";

export function SiteFooter() {
  return (
    <footer className="border-border bg-muted/30 mt-16 border-t">
      <div className="text-muted-foreground mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 text-sm sm:grid-cols-4">
        <div>
          <h3 className="text-foreground mb-3 font-semibold">{storeName}</h3>
          <p className="text-xs leading-5">
            Online shopping across India. Fast, reliable delivery.
          </p>
        </div>
        <div>
          <h4 className="text-foreground mb-3 font-medium">Shop</h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/c/fashion" className="hover:underline">
                Fashion
              </Link>
            </li>
            <li>
              <Link href="/c/home-kitchen" className="hover:underline">
                Home &amp; Kitchen
              </Link>
            </li>
            <li>
              <Link href="/c/electronics" className="hover:underline">
                Electronics
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-foreground mb-3 font-medium">Help</h4>
          <ul className="space-y-2 text-xs">
            <li>Shipping &amp; delivery</li>
            <li>Returns &amp; refunds</li>
            <li>Contact us</li>
          </ul>
        </div>
        <div>
          <h4 className="text-foreground mb-3 font-medium">Policies</h4>
          <ul className="space-y-2 text-xs">
            <li>Terms of use</li>
            <li>Privacy policy</li>
          </ul>
        </div>
      </div>
      <div className="border-border/60 text-muted-foreground border-t px-4 py-4 text-center text-xs">
        © {new Date().getFullYear()} {storeName}. All prices in ₹ (INR), inclusive of GST.
      </div>
    </footer>
  );
}

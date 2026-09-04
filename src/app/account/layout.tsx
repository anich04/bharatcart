import Link from "next/link";

const links = [
  { href: "/account", label: "Profile" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/orders", label: "Orders" },
  { href: "/wishlist", label: "Wishlist" },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">My account</h1>
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto lg:w-48 lg:shrink-0 lg:flex-col">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:bg-muted rounded-md px-3 py-2 text-sm whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

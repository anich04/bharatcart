import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  TicketPercent,
  Star,
  AlertTriangle,
} from "lucide-react";
import { requireAdminPage } from "@/lib/admin/guard";

const links = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", Icon: ShoppingBag },
  { href: "/admin/products", label: "Products", Icon: Package },
  { href: "/admin/inventory", label: "Low stock", Icon: AlertTriangle },
  { href: "/admin/coupons", label: "Coupons", Icon: TicketPercent },
  { href: "/admin/reviews", label: "Reviews", Icon: Star },
  { href: "/admin/customers", label: "Customers", Icon: Users },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <span className="text-muted-foreground text-xs">Signed in as {user.email}</span>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto lg:w-48 lg:shrink-0 lg:flex-col">
          {links.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="hover:bg-muted flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

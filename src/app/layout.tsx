import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { auth } from "@/auth";
import { getDbCartItems } from "@/lib/cart/queries";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const storeName = process.env.NEXT_PUBLIC_STORE_NAME ?? "BharatCart";

export const metadata: Metadata = {
  title: {
    default: `${storeName} — Online Shopping in India`,
    template: `%s | ${storeName}`,
  },
  description: `Shop online at ${storeName}. Fast delivery across India.`,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  let initialItems: { variantId: string; quantity: number }[] = [];
  if (session?.user?.id) {
    try {
      initialItems = await getDbCartItems(session.user.id);
    } catch (err) {
      console.error("RootLayout: failed to load cart", err);
    }
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <CartProvider authed={!!session?.user} initialItems={initialItems}>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}

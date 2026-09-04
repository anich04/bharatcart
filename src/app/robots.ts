import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Never index private or transactional areas.
        disallow: [
          "/admin",
          "/account",
          "/checkout",
          "/cart",
          "/wishlist",
          "/order",
          "/api",
          "/login",
          "/signup",
          "/reset-password",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}

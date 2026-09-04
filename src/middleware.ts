import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe auth instance (no Prisma/bcrypt) for route protection.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const path = nextUrl.pathname;

  const needsAuth =
    path.startsWith("/account") ||
    path.startsWith("/checkout") ||
    path.startsWith("/wishlist") ||
    path.startsWith("/admin");

  if (!needsAuth) return;

  if (!isLoggedIn) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", path);
    return Response.redirect(url);
  }

  // Admin area additionally requires the ADMIN role. This is defence-in-depth;
  // every admin server action re-checks the role independently.
  if (path.startsWith("/admin") && role !== "ADMIN") {
    return Response.redirect(new URL("/", nextUrl));
  }
});

export const config = {
  matcher: ["/account/:path*", "/checkout/:path*", "/wishlist/:path*", "/admin/:path*"],
};

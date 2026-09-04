import { redirect } from "next/navigation";
import { auth } from "@/auth";

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
  }
}

/**
 * Page guard: redirects non-admins away from /admin.
 * Middleware already blocks these routes — this is the authoritative re-check
 * on the server (never rely on middleware or hidden UI alone).
 */
export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");
  return session.user;
}

/**
 * Server-action guard. Every admin mutation must call this — returns the admin
 * user or throws ForbiddenError.
 */
export async function requireAdminAction() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new ForbiddenError();
  }
  return session.user;
}

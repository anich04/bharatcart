import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createUploadSignature, isCloudinaryConfigured } from "@/lib/cloudinary";

export const runtime = "nodejs";

const bodySchema = z.object({ kind: z.enum(["products", "reviews"]) });

/**
 * Mint a short-lived Cloudinary upload signature.
 *
 * - `products` uploads are ADMIN-only.
 * - `reviews` uploads are allowed for any signed-in customer.
 * The API secret never leaves the server; the client gets only a signature
 * scoped to a fixed folder and timestamp.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Image uploads are not configured yet." },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.kind === "products" && session.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const limit = await rateLimit(`upload:${session.user.id}`, 40, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: `Too many uploads. Try again in ${limit.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  return NextResponse.json({ ok: true, ...createUploadSignature(parsed.data.kind) });
}

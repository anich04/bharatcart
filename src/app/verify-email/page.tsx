import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyEmailToken } from "@/lib/actions/verify-email";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token
    ? await verifyEmailToken(token)
    : { ok: false, message: "Missing verification token." };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      {result.ok ? (
        <CheckCircle2 className="size-12 text-green-600" />
      ) : (
        <XCircle className="text-destructive size-12" />
      )}
      <h1 className="text-xl font-semibold">
        {result.ok ? "Email verified" : "Verification failed"}
      </h1>
      <p className="text-muted-foreground text-sm">{result.message}</p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
      >
        Continue shopping
      </Link>
    </div>
  );
}

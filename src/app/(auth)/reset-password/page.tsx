import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <p className="text-muted-foreground text-sm">
        Missing reset token. Please use the link from your email.
      </p>
    );
  }

  return <ResetPasswordForm token={token} />;
}

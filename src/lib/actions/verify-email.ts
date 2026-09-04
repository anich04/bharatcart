import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";

/** Verify an email using the raw token from the emailed link. Idempotent-ish. */
export async function verifyEmailToken(
  rawToken: string,
): Promise<{ ok: boolean; message: string }> {
  if (!rawToken || rawToken.length < 10) {
    return { ok: false, message: "Invalid verification link." };
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!record || record.expires < new Date()) {
    return { ok: false, message: "This verification link is invalid or has expired." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { ok: true, message: "Your email is verified. Thank you!" };
}

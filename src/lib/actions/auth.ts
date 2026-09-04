"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, absoluteUrl } from "@/lib/email";
import { generateToken, hashToken, EMAIL_VERIFY_TTL_MS, PASSWORD_RESET_TTL_MS } from "@/lib/tokens";
import {
  signupSchema,
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export type ActionState = { error?: string; success?: boolean; message?: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

const SALT_ROUNDS = 12;

async function sendVerificationEmail(userId: string, email: string) {
  const { raw, hash } = generateToken();
  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hash, expires: new Date(Date.now() + EMAIL_VERIFY_TTL_MS) },
  });
  const link = absoluteUrl(`/verify-email?token=${raw}`);
  await sendEmail({
    to: email,
    subject: "Verify your BharatCart email",
    html: `<p>Welcome to BharatCart! Confirm your email:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const limit = rateLimit(`signup:${await clientIp()}`, 5, 60_000);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` };

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "An account with this email already exists." };

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "CUSTOMER" },
    select: { id: true, email: true },
  });

  await sendVerificationEmail(user.id, user.email);

  // Sign the user in immediately (throws a redirect on success).
  await signIn("credentials", { email, password, redirectTo: "/" });
  return { success: true };
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const ip = await clientIp();
  const limit = rateLimit(`login:${ip}:${parsed.data.email}`, 8, 5 * 60_000);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` };

  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw err; // redirect errors must propagate
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/" });
}

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email." };

  const limit = rateLimit(`reset:${await clientIp()}`, 5, 10 * 60_000);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true },
  });

  // Always report success — never reveal whether an email is registered.
  if (user) {
    const { raw, hash } = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expires: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
    const link = absoluteUrl(`/reset-password?token=${raw}`);
    await sendEmail({
      to: user.email,
      subject: "Reset your BharatCart password",
      html: `<p>Reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
    });
  }

  return { success: true, message: "If that email is registered, a reset link is on its way." };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tokenHash = hashToken(parsed.data.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expires < new Date()) {
    return { error: "This reset link is invalid or has expired." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, SALT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other outstanding reset tokens for this user.
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    }),
  ]);

  return { success: true, message: "Password updated. You can now sign in." };
}

import { randomBytes, createHash } from "node:crypto";

/**
 * Single-use tokens for email verification and password reset.
 * We email the RAW token and store only its SHA-256 HASH, so a database leak
 * never exposes usable tokens.
 */
export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

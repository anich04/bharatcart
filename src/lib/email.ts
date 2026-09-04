/**
 * Transactional email via the Resend REST API (no SDK dependency).
 * If RESEND_API_KEY is unset (local dev), emails are logged to the server
 * console instead of sent — so token flows are testable without credentials.
 */
const FROM = process.env.EMAIL_FROM ?? "BharatCart <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.log(
      `\n──────── [email:dev] (RESEND_API_KEY unset — not actually sent) ────────\n` +
        `To: ${to}\nSubject: ${subject}\n\n${html}\n` +
        `───────────────────────────────────────────────────────────────────────\n`,
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}

export function absoluteUrl(path: string): string {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

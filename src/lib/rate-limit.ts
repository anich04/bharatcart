/**
 * Lightweight fixed-window rate limiter.
 *
 * This in-memory implementation works for local/dev and single-instance
 * deployments. On serverless (Vercel) it does NOT share state across instances
 * — swap the internals for Upstash Redis (`@upstash/ratelimit`) in production;
 * the `rateLimit()` signature stays the same.
 */
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

// Occasionally evict expired buckets so the map doesn't grow unbounded.
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
    },
    5 * 60 * 1000,
  ).unref?.();
}

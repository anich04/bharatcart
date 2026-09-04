/**
 * Fixed-window rate limiter.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set (required on
 * serverless, where instances don't share memory), and falls back to an
 * in-process map for local development or if Upstash is unreachable.
 */
export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function isDistributedRateLimitEnabled(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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

// Evict expired buckets so the map can't grow without bound.
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
    },
    5 * 60 * 1000,
  ).unref?.();
}

// ---------------------------------------------------------------------------
// Upstash Redis (REST)
// ---------------------------------------------------------------------------

/**
 * One pipelined round trip: INCR the counter, set the expiry only if the key is
 * new (NX), then read the TTL so we can tell the caller when to retry.
 */
async function upstashLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSec), "NX"],
        ["TTL", key],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { result?: number }[];
    const count = Number(data?.[0]?.result ?? 0);
    const ttl = Number(data?.[2]?.result ?? windowSec);
    if (!Number.isFinite(count) || count <= 0) return null;

    if (count > limit) {
      return { ok: false, remaining: 0, retryAfterSec: ttl > 0 ? ttl : windowSec };
    }
    return { ok: true, remaining: Math.max(0, limit - count), retryAfterSec: 0 };
  } catch {
    return null; // network/Upstash failure -> fall back
  }
}

// ---------------------------------------------------------------------------

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (isDistributedRateLimitEnabled()) {
    const result = await upstashLimit(key, limit, windowMs);
    if (result) return result;
    // Upstash unavailable: degrade to the local limiter rather than locking
    // everyone out or letting everything through unchecked.
    console.warn("rate-limit: Upstash unavailable, falling back to in-memory");
  }
  return memoryLimit(key, limit, windowMs);
}

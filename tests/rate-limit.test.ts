import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * The limiter reads Upstash env vars at import time, so each scenario imports a
 * fresh module instance via vi.resetModules().
 */
async function loadLimiter(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("@/lib/rate-limit");
}

let key = 0;
const nextKey = () => `test-key-${Date.now()}-${key++}`;

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("in-memory rate limiter", () => {
  it("allows up to the limit, then blocks", async () => {
    const { rateLimit } = await loadLimiter();
    const k = nextKey();

    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(k, 3, 60_000);
      expect(r.ok).toBe(true);
    }
    const blocked = await rateLimit(k, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("keeps separate counters per key", async () => {
    const { rateLimit } = await loadLimiter();
    const a = nextKey();
    const b = nextKey();

    await rateLimit(a, 1, 60_000);
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(false);
    // A different key is unaffected.
    expect((await rateLimit(b, 1, 60_000)).ok).toBe(true);
  });

  it("resets once the window has elapsed", async () => {
    const { rateLimit } = await loadLimiter();
    const k = nextKey();

    expect((await rateLimit(k, 1, 50)).ok).toBe(true);
    expect((await rateLimit(k, 1, 50)).ok).toBe(false);

    await new Promise((r) => setTimeout(r, 70));
    expect((await rateLimit(k, 1, 50)).ok).toBe(true);
  });
});

describe("Upstash-backed rate limiter", () => {
  beforeEach(() => {
    key++;
  });

  it("reports as enabled only when both env vars are present", async () => {
    const off = await loadLimiter();
    expect(off.isDistributedRateLimitEnabled()).toBe(false);

    const on = await loadLimiter({
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    });
    expect(on.isDistributedRateLimitEnabled()).toBe(true);
  });

  it("blocks when Redis reports a count above the limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 9 }, { result: 1 }, { result: 42 }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rateLimit } = await loadLimiter({
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    });

    const r = await rateLimit(nextKey(), 5, 60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBe(42);
  });

  it("allows when the count is within the limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ result: 2 }, { result: 1 }, { result: 30 }],
      }),
    );

    const { rateLimit } = await loadLimiter({
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    });

    const r = await rateLimit(nextKey(), 5, 60_000);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(3);
  });

  it("degrades to the in-memory limiter if Upstash is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { rateLimit } = await loadLimiter({
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    });

    const k = nextKey();
    // Still enforces the limit locally rather than failing open or shut.
    expect((await rateLimit(k, 2, 60_000)).ok).toBe(true);
    expect((await rateLimit(k, 2, 60_000)).ok).toBe(true);
    expect((await rateLimit(k, 2, 60_000)).ok).toBe(false);
  });
});

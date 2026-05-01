/**
 * In-memory token-bucket rate limiter.
 *
 * Adequate for a single-instance deploy and the v1 launch volume. In Phase 5+
 * (multi-region or horizontal scale) this is replaced with Cloudflare WAF
 * rate-limit rules at the edge, plus an Upstash/Redis-backed bucket for any
 * app-layer logic that needs to be cluster-aware.
 */

type Bucket = {
  tokens: number;
  lastRefill: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

export type RateLimitOptions = {
  /** Maximum tokens (= maximum burst). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
};

export function rateLimit(
  key: string,
  { capacity, refillPerSecond }: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  let tokens: number;
  if (existing) {
    const elapsed = (now - existing.lastRefill) / 1000;
    tokens = Math.min(capacity, existing.tokens + elapsed * refillPerSecond);
  } else {
    tokens = capacity;
  }

  if (tokens >= 1) {
    tokens -= 1;
    buckets.set(key, { tokens, lastRefill: now });
    return {
      allowed: true,
      remaining: Math.floor(tokens),
      resetMs: 0,
    };
  }

  // Not enough tokens.
  buckets.set(key, { tokens, lastRefill: now });
  const needed = 1 - tokens;
  const resetMs = Math.ceil((needed / refillPerSecond) * 1000);
  return {
    allowed: false,
    remaining: 0,
    resetMs,
  };
}

/** Pull a stable client identifier from the request (best-effort). */
export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  // Fallback — single-client bucket.
  return "anonymous";
}

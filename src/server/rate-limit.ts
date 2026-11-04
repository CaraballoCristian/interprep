/**
 * Tiny in-memory sliding-window limiter. A single container is the deployment
 * model, so this is enough to stop runaway loops without adding a dependency.
 * It resets on restart, which is acceptable for cost protection.
 */
const buckets = new Map<string, number[]>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(
  key: string,
  limit = 20,
  windowMs = 5 * 60_000,
  now = Date.now(),
): RateLimitResult {
  const recent = (buckets.get(key) ?? []).filter(
    (timestamp) => now - timestamp < windowMs,
  );

  if (recent.length >= limit) {
    const oldest = recent[0] ?? now;
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((windowMs - (now - oldest)) / 1000),
      ),
    };
  }

  recent.push(now);
  buckets.set(key, recent);
  return { ok: true };
}

/** Test helper; also useful if a future admin action needs to clear limits. */
export function resetRateLimits(): void {
  buckets.clear();
}

import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  resetRateLimits,
} from "@/server/rate-limit";

beforeEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit", () => {
    const now = 1_000_000;

    expect(checkRateLimit("user", 2, 60_000, now).ok).toBe(true);
    expect(checkRateLimit("user", 2, 60_000, now + 1).ok).toBe(true);

    const blocked = checkRateLimit("user", 2, 60_000, now + 2);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      return;
    }
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each user separately", () => {
    const now = 1_000_000;

    expect(checkRateLimit("a", 1, 60_000, now).ok).toBe(true);
    expect(checkRateLimit("a", 1, 60_000, now).ok).toBe(false);
    expect(checkRateLimit("b", 1, 60_000, now).ok).toBe(true);
  });

  it("frees the window over time", () => {
    const now = 1_000_000;

    expect(checkRateLimit("user", 1, 60_000, now).ok).toBe(true);
    expect(checkRateLimit("user", 1, 60_000, now + 60_001).ok).toBe(true);
  });
});

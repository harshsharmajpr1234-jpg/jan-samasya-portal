import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("fixed-window rate limiter", () => {
  it("allows up to the limit then blocks", () => {
    const key = `test:${Math.random()}`;
    const results = Array.from({ length: 6 }, () => rateLimit(key, 5, 60_000));
    expect(results.slice(0, 5).every((r) => r.allowed)).toBe(true);
    expect(results[5]!.allowed).toBe(false);
    expect(results[5]!.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).allowed).toBe(false);
    expect(rateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it("resets after the window expires", async () => {
    const key = `expiry:${Math.random()}`;
    rateLimit(key, 1, 40);
    expect(rateLimit(key, 1, 40).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(rateLimit(key, 1, 40).allowed).toBe(true);
  });
});

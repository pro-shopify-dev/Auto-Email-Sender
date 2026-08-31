import { describe, it, expect } from "vitest";
import { RateLimiter } from "@/lib/rateLimit";

describe("RateLimiter (token bucket)", () => {
  it("allows an immediate burst up to capacity", async () => {
    const limiter = new RateLimiter(60);
    const start = Date.now();
    for (let i = 0; i < 5; i++) await limiter.take();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("throttles once the bucket is drained", async () => {
    // 600/min => capacity 600, refill ~100ms/token. Drain the burst, then the next
    // take must wait for a refill.
    const limiter = new RateLimiter(600);
    for (let i = 0; i < 600; i++) await limiter.take();
    const start = Date.now();
    await limiter.take(); // bucket empty -> must wait ~100ms
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
  });
});

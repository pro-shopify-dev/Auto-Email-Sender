/**
 * Simple token-bucket rate limiter. Used by the worker to keep sends under Gmail's
 * per-account quota. `take()` resolves once a token is available.
 */
export class RateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private last: number;

  constructor(ratePerMinute: number) {
    this.capacity = Math.max(1, ratePerMinute);
    this.tokens = this.capacity;
    this.refillPerMs = this.capacity / 60_000;
    this.last = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.last;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.last = now;
  }

  async take(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const needed = 1 - this.tokens;
    const waitMs = Math.ceil(needed / this.refillPerMs);
    await new Promise((r) => setTimeout(r, waitMs));
    return this.take();
  }
}

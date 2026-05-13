import { Injectable, Logger } from '@nestjs/common';

/**
 * Token-bucket rate limiter for outbound API calls.
 *
 * Each slot (token) represents one permitted operation. Tokens refill at a
 * steady rate (maxPerMinute / 60 per second). Callers `await acquire()` which
 * returns immediately if a token is available, or waits until one is.
 *
 * Designed for I/O-bound work (Gemini API). Not thread-safe — single-process.
 */
@Injectable()
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);
  private readonly maxTokens: number;
  private readonly refillMsPerToken: number;
  private tokens: number;
  private lastRefillAt: number;
  private readonly disabled: boolean;
  private waiters: Array<() => void> = [];

  /**
   * @param maxPerMinute - Max operations per minute. 0 or negative = unlimited.
   */
  constructor(maxPerMinute: number) {
    this.disabled = maxPerMinute <= 0;
    this.maxTokens = Math.max(1, maxPerMinute);
    this.refillMsPerToken = this.disabled ? 0 : 60_000 / this.maxTokens;
    this.tokens = this.maxTokens;
    this.lastRefillAt = Date.now();

    if (this.disabled) {
      this.logger.log('RateLimiter disabled (unlimited)');
    } else {
      this.logger.log(`RateLimiter: ${maxPerMinute} ops/minute (${this.refillMsPerToken.toFixed(0)}ms per token)`);
    }
  }

  /**
   * Wait until a token is available, then consume it.
   * Resolves immediately when disabled or tokens are available.
   */
  async acquire(): Promise<void> {
    if (this.disabled) return;

    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // No token — wait for one to refill
    const waitMs = Math.ceil(this.refillMsPerToken - ((Date.now() - this.lastRefillAt) % this.refillMsPerToken));
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
      setTimeout(() => this.releaseNextWaiter(), waitMs + 10);
    });
  }

  /** Get current available tokens (for observability). */
  availableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /** Refill tokens based on elapsed time. */
  private refill(): void {
    if (this.disabled) return;
    const now = Date.now();
    const elapsed = now - this.lastRefillAt;
    const tokensToAdd = Math.floor(elapsed / this.refillMsPerToken);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillAt += tokensToAdd * this.refillMsPerToken;
    }
  }

  /** Release the next waiting caller if a token is available. */
  private releaseNextWaiter(): void {
    this.refill();
    while (this.tokens >= 1 && this.waiters.length > 0) {
      this.tokens -= 1;
      const resolve = this.waiters.shift();
      if (resolve) resolve();
    }
  }
}

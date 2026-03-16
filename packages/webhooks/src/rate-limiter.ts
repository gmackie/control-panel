import { RateLimitError } from "./errors";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request, ip?: string) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: Required<RateLimitConfig>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: (_req, ip) => ip || "unknown",
      ...config,
    };
  }

  /** Start periodic cleanup. Called automatically on first checkLimit. */
  private ensureCleanupTimer(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    // Allow the process to exit even if the timer is still running
    if (this.cleanupTimer && typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
      (this.cleanupTimer as NodeJS.Timeout).unref();
    }
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  private getKey(req: Request): string {
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

    return this.config.keyGenerator(req, ip);
  }

  async checkLimit(req: Request): Promise<void> {
    this.ensureCleanupTimer();

    const key = this.getKey(req);
    const now = Date.now();

    let entry = this.store.get(key);

    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
      this.store.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > this.config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      );
    }
  }

  getStatus(req: Request) {
    const key = this.getKey(req);
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || entry.resetTime <= now) {
      return {
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        reset: this.config.windowMs / 1000,
        resetTime: new Date(now + this.config.windowMs),
      };
    }

    return {
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      reset: Math.ceil((entry.resetTime - now) / 1000),
      resetTime: new Date(entry.resetTime),
    };
  }

  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }
}

/** Create a new webhook rate limiter instance */
export function createWebhookLimiter(): RateLimiter {
  return new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyGenerator: (req) => {
      const source = req.headers.get("x-webhook-source");
      const webhookId = req.headers.get("x-request-id");
      if (source) return source;
      if (webhookId) return webhookId;

      const forwardedFor = req.headers.get("x-forwarded-for");
      const realIp = req.headers.get("x-real-ip");
      return forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
    },
  });
}

let _webhookLimiter: RateLimiter | null = null;

/** Lazy singleton webhook rate limiter */
export const webhookLimiter: RateLimiter = new Proxy({} as RateLimiter, {
  get(_target, prop, _receiver) {
    if (!_webhookLimiter) {
      _webhookLimiter = createWebhookLimiter();
    }
    const value = (_webhookLimiter as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(_webhookLimiter);
    }
    return value;
  },
});

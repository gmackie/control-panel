import { describe, it, expect, afterEach } from "vitest";
import { RateLimiter } from "../rate-limiter";
import { RateLimitError } from "../errors";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter.dispose();
  });

  function makeRequest(ip = "127.0.0.1"): Request {
    return new Request("https://example.com/webhook", {
      headers: { "x-real-ip": ip },
    });
  }

  it("allows requests under the limit", async () => {
    limiter = new RateLimiter({ windowMs: 1000, maxRequests: 2 });
    await expect(limiter.checkLimit(makeRequest())).resolves.toBeUndefined();
    await expect(limiter.checkLimit(makeRequest())).resolves.toBeUndefined();
  });

  it("throws RateLimitError when over the limit", async () => {
    limiter = new RateLimiter({ windowMs: 1000, maxRequests: 2 });
    await limiter.checkLimit(makeRequest());
    await limiter.checkLimit(makeRequest());
    await expect(limiter.checkLimit(makeRequest())).rejects.toThrow(RateLimitError);
  });

  it("evicts expired entries after cleanup", async () => {
    limiter = new RateLimiter({ windowMs: 10, maxRequests: 1 });
    await limiter.checkLimit(makeRequest());

    await new Promise((resolve) => setTimeout(resolve, 20));
    limiter.cleanup();

    // After cleanup, the window has expired so requests should pass again
    await expect(limiter.checkLimit(makeRequest())).resolves.toBeUndefined();
  });
});

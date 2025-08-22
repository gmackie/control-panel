import { RateLimitError } from './api-errors';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request, ip?: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: (req, ip) => ip || 'unknown',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    };

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  private getKey(req: Request): string {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0].trim() || realIP || 'unknown';
    
    return this.config.keyGenerator(req, ip);
  }

  async checkLimit(req: Request): Promise<void> {
    const key = this.getKey(req);
    const now = Date.now();
    
    let entry = this.store.get(key);
    
    if (!entry || entry.resetTime <= now) {
      // Create new window
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs
      };
      this.store.set(key, entry);
    }

    entry.count++;

    if (entry.count > this.config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      );
    }
  }

  getStatus(req: Request): {
    limit: number;
    remaining: number;
    reset: number;
    resetTime: Date;
  } {
    const key = this.getKey(req);
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || entry.resetTime <= now) {
      return {
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        reset: this.config.windowMs / 1000,
        resetTime: new Date(now + this.config.windowMs)
      };
    }

    return {
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      reset: Math.ceil((entry.resetTime - now) / 1000),
      resetTime: new Date(entry.resetTime)
    };
  }
}

// Pre-configured rate limiters for different use cases
export const apiLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100 // 100 requests per 15 minutes
});

export const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  keyGenerator: (req) => {
    // Use email or IP for auth requests
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    if (email) return email;
    
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    return forwardedFor?.split(',')[0].trim() || realIP || 'unknown';
  }
});

export const strictLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10 // 10 requests per minute
});

export const webhookLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 webhook calls per minute
  keyGenerator: (req) => {
    // Use webhook source header or IP
    const source = req.headers.get('x-webhook-source');
    if (source) return source;
    
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    return forwardedFor?.split(',')[0].trim() || realIP || 'unknown';
  }
});

export function withRateLimit(limiter: RateLimiter) {
  return function rateLimitMiddleware<T extends any[]>(
    handler: (...args: T) => Promise<Response>
  ) {
    return async (...args: T): Promise<Response> => {
      const request = args[0] as Request;
      
      try {
        await limiter.checkLimit(request);
        
        const response = await handler(...args);
        const status = limiter.getStatus(request);
        
        // Add rate limit headers to response
        const headers = new Headers(response.headers);
        headers.set('X-RateLimit-Limit', status.limit.toString());
        headers.set('X-RateLimit-Remaining', status.remaining.toString());
        headers.set('X-RateLimit-Reset', status.resetTime.toISOString());
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      } catch (error) {
        if (error instanceof RateLimitError) {
          const status = limiter.getStatus(request);
          const response = {
            error: {
              code: error.code,
              message: error.message,
              statusCode: error.statusCode,
              timestamp: new Date().toISOString(),
              retryAfter: error.retryAfter
            }
          };
          
          return new Response(JSON.stringify(response), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': error.retryAfter?.toString() || '60',
              'X-RateLimit-Limit': status.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': status.resetTime.toISOString()
            }
          });
        }
        
        throw error;
      }
    };
  };
}

// Utility function to create custom rate limiters
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}
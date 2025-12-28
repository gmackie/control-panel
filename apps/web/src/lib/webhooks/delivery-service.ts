import crypto from 'crypto';

export interface WebhookDelivery {
  webhookId: string;
  eventId: string;
  url: string;
  payload: any;
  secret?: string;
  attempt: number;
  maxAttempts?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  error?: string;
}

export interface WebhookEvent {
  id: string;
  webhookId: string;
  provider: string;
  eventType: string;
  payload: any;
  status: 'pending' | 'success' | 'failed' | 'retrying' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  responseCode?: number;
  responseTime?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  errorMessage?: string;
  timestamp: Date;
  deliveredAt?: Date;
  nextRetry?: Date;
  lastAttemptAt?: Date;
}

class WebhookDeliveryService {
  private retryDelays = [1000, 5000, 30000, 300000, 3600000]; // 1s, 5s, 30s, 5m, 1h
  private defaultTimeout = 10000; // 10 seconds
  private maxAttempts = 5;

  /**
   * Deliver a webhook event to its endpoint
   */
  async deliver(delivery: WebhookDelivery): Promise<DeliveryResult> {
    const startTime = Date.now();
    
    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'GMAC.IO-Webhooks/1.0',
        'X-Webhook-ID': delivery.webhookId,
        'X-Event-ID': delivery.eventId,
        'X-Delivery-Attempt': delivery.attempt.toString(),
        ...delivery.headers,
      };

      // Add signature if secret is provided
      if (delivery.secret) {
        const signature = this.generateSignature(delivery.payload, delivery.secret);
        headers['X-Signature-SHA256'] = signature;
        headers['X-Webhook-Signature'] = signature; // Alternative header name
      }

      // Make the HTTP request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), delivery.timeout || this.defaultTimeout);

      const response = await fetch(delivery.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseTime = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');
      const responseHeaders = Object.fromEntries(response.headers.entries());

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime,
        responseHeaders,
        responseBody,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      let errorMessage = error.message;
      if (error.name === 'AbortError') {
        errorMessage = `Request timeout after ${delivery.timeout || this.defaultTimeout}ms`;
      }

      return {
        success: false,
        responseTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Process a webhook event with retry logic
   */
  async processEvent(event: WebhookEvent, webhookUrl: string, webhookSecret?: string): Promise<WebhookEvent> {
    const delivery: WebhookDelivery = {
      webhookId: event.webhookId,
      eventId: event.id,
      url: webhookUrl,
      payload: event.payload,
      secret: webhookSecret,
      attempt: event.attempts + 1,
    };

    // Update event status to indicate delivery attempt
    event.status = event.attempts === 0 ? 'pending' : 'retrying';
    event.attempts++;
    event.lastAttemptAt = new Date();

    const result = await this.deliver(delivery);

    // Update event based on delivery result
    event.responseCode = result.statusCode;
    event.responseTime = result.responseTime;
    event.responseHeaders = result.responseHeaders;
    event.responseBody = result.responseBody;

    if (result.success) {
      event.status = 'success';
      event.deliveredAt = new Date();
      event.nextRetry = undefined;
    } else {
      event.errorMessage = result.error;
      
      if (event.attempts >= (event.maxAttempts || this.maxAttempts)) {
        event.status = 'failed';
        event.nextRetry = undefined;
      } else {
        event.status = 'retrying';
        event.nextRetry = this.calculateNextRetry(event.attempts);
      }
    }

    return event;
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(payload: any, secret: string): string {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');
  }

  /**
   * Calculate the next retry time based on exponential backoff
   */
  private calculateNextRetry(attemptNumber: number): Date {
    const delayIndex = Math.min(attemptNumber - 1, this.retryDelays.length - 1);
    const delay = this.retryDelays[delayIndex];
    return new Date(Date.now() + delay);
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    
    // Clean the signature (remove 'sha256=' prefix if present)
    const cleanSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(cleanSignature, 'hex')
    );
  }

  /**
   * Parse webhook signature from headers
   */
  parseSignatureHeader(signatureHeader: string): { timestamp?: string; signature?: string } {
    const parts = signatureHeader.split(',');
    const result: { timestamp?: string; signature?: string } = {};

    parts.forEach(part => {
      const [key, value] = part.split('=');
      if (key === 't') result.timestamp = value;
      if (key === 'v1') result.signature = value;
    });

    return result;
  }

  /**
   * Check if an event should be retried
   */
  shouldRetry(event: WebhookEvent): boolean {
    if (event.status === 'success' || event.status === 'cancelled') {
      return false;
    }

    if (event.attempts >= (event.maxAttempts || this.maxAttempts)) {
      return false;
    }

    if (event.nextRetry && event.nextRetry > new Date()) {
      return false; // Not time for retry yet
    }

    return true;
  }

  /**
   * Get retry configuration for different providers
   */
  getProviderConfig(provider: string): { maxAttempts: number; retryDelays: number[] } {
    const configs: Record<string, { maxAttempts: number; retryDelays: number[] }> = {
      stripe: {
        maxAttempts: 3,
        retryDelays: [1000, 5000, 30000], // Stripe recommends shorter delays
      },
      sendgrid: {
        maxAttempts: 5,
        retryDelays: [1000, 5000, 30000, 300000, 3600000],
      },
      twilio: {
        maxAttempts: 4,
        retryDelays: [1000, 10000, 60000, 600000],
      },
      github: {
        maxAttempts: 3,
        retryDelays: [5000, 30000, 300000],
      },
    };

    return configs[provider] || {
      maxAttempts: this.maxAttempts,
      retryDelays: this.retryDelays,
    };
  }

  /**
   * Create a webhook event from provider data
   */
  createEvent(data: {
    webhookId: string;
    provider: string;
    eventType: string;
    payload: any;
    maxAttempts?: number;
  }): WebhookEvent {
    const config = this.getProviderConfig(data.provider);
    
    return {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      webhookId: data.webhookId,
      provider: data.provider,
      eventType: data.eventType,
      payload: data.payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: data.maxAttempts || config.maxAttempts,
      timestamp: new Date(),
    };
  }
}

// Export singleton instance
export const webhookDeliveryService = new WebhookDeliveryService();

export default webhookDeliveryService;
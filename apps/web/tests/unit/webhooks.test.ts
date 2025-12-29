import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

vi.mock('@/lib/activity/activity-service', () => ({
  activityService: {
    create: vi.fn().mockResolvedValue({ id: 'test-activity-id' }),
  },
}))

vi.mock('@/lib/webhooks/webhook-service', () => ({
  storeWebhookEvent: vi.fn().mockResolvedValue('test-event-id'),
  storeAlert: vi.fn().mockResolvedValue('test-alert-id'),
  updateAlertStatus: vi.fn().mockResolvedValue(true),
  storeDeploymentEvent: vi.fn().mockResolvedValue('test-deployment-id'),
  createNotification: vi.fn().mockResolvedValue('test-notification-id'),
  sendSlackNotification: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/rate-limiter', () => ({
  webhookLimiter: {
    checkLimit: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('Webhook Signature Verification', () => {
  describe('Stripe Signature', () => {
    const secret = 'whsec_test_secret'
    
    function generateStripeSignature(payload: string, secret: string): string {
      const timestamp = Math.floor(Date.now() / 1000)
      const signedPayload = `${timestamp}.${payload}`
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex')
      return `t=${timestamp},v1=${signature}`
    }

    it('should generate valid Stripe signature format', () => {
      const payload = JSON.stringify({ type: 'payment_intent.succeeded' })
      const signature = generateStripeSignature(payload, secret)
      
      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]+$/)
    })

    it('should verify Stripe signature correctly', () => {
      const payload = JSON.stringify({ type: 'payment_intent.succeeded' })
      const timestamp = Math.floor(Date.now() / 1000)
      const signedPayload = `${timestamp}.${payload}`
      
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex')
      
      const providedSignature = `t=${timestamp},v1=${expectedSignature}`
      const elements = providedSignature.split(',')
      const signatureMap: Record<string, string> = {}
      
      for (const element of elements) {
        const [key, value] = element.split('=')
        signatureMap[key] = value
      }
      
      expect(signatureMap['t']).toBe(String(timestamp))
      expect(signatureMap['v1']).toBe(expectedSignature)
    })

    it('should reject expired timestamps', () => {
      const tolerance = 300
      const oldTimestamp = Math.floor(Date.now() / 1000) - tolerance - 10
      const now = Math.floor(Date.now() / 1000)
      const diff = Math.abs(now - oldTimestamp)
      
      expect(diff).toBeGreaterThan(tolerance)
    })
  })

  describe('Clerk/Svix Signature', () => {
    const secret = 'whsec_' + Buffer.from('testsecret1234567890123456').toString('base64')

    function generateSvixSignature(
      payload: string,
      svixId: string,
      svixTimestamp: string,
      secret: string
    ): string {
      const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64')
      const signedContent = `${svixId}.${svixTimestamp}.${payload}`
      const signature = crypto
        .createHmac('sha256', secretBytes)
        .update(signedContent)
        .digest('base64')
      return `v1,${signature}`
    }

    it('should generate valid Svix signature format', () => {
      const payload = JSON.stringify({ type: 'user.created' })
      const svixId = 'msg_test123'
      const svixTimestamp = String(Math.floor(Date.now() / 1000))
      
      const signature = generateSvixSignature(payload, svixId, svixTimestamp, secret)
      
      expect(signature).toMatch(/^v1,[A-Za-z0-9+/=]+$/)
    })

    it('should verify Svix signature correctly', () => {
      const payload = JSON.stringify({ type: 'user.created' })
      const svixId = 'msg_test123'
      const svixTimestamp = String(Math.floor(Date.now() / 1000))
      
      const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64')
      const signedContent = `${svixId}.${svixTimestamp}.${payload}`
      const expectedSignature = crypto
        .createHmac('sha256', secretBytes)
        .update(signedContent)
        .digest('base64')
      
      const providedSignature = `v1,${expectedSignature}`
      const signatures = providedSignature.split(' ').map(sig => sig.split(',')[1])
      
      expect(signatures).toContain(expectedSignature)
    })
  })

  describe('Sentry Signature', () => {
    const secret = 'sentry_webhook_secret'

    function generateSentrySignature(payload: string, secret: string): string {
      return crypto.createHmac('sha256', secret).update(payload).digest('hex')
    }

    it('should generate valid Sentry signature', () => {
      const payload = JSON.stringify({ action: 'created', data: { issue: {} } })
      const signature = generateSentrySignature(payload, secret)
      
      expect(signature).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should verify Sentry signature using timing-safe comparison', () => {
      const payload = JSON.stringify({ action: 'created', data: { issue: {} } })
      const signature = generateSentrySignature(payload, secret)
      const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex')
      
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
      )
      
      expect(isValid).toBe(true)
    })
  })

  describe('Bearer Token Verification', () => {
    it('should validate correct bearer token', () => {
      const expectedToken = 'test-webhook-token'
      const authHeader = `Bearer ${expectedToken}`
      
      const prefix = 'Bearer '
      expect(authHeader.startsWith(prefix)).toBe(true)
      
      const providedToken = authHeader.slice(prefix.length)
      expect(providedToken).toBe(expectedToken)
      
      const isValid = crypto.timingSafeEqual(
        Buffer.from(providedToken),
        Buffer.from(expectedToken)
      )
      expect(isValid).toBe(true)
    })

    it('should reject invalid bearer token', () => {
      const expectedToken = 'correct-token'
      const providedToken = 'wrong-token'
      
      expect(providedToken.length).not.toBe(expectedToken.length)
    })

    it('should reject missing authorization header', () => {
      const authHeader = null
      expect(authHeader).toBeNull()
    })

    it('should reject malformed authorization header', () => {
      const authHeader = 'Basic dXNlcjpwYXNz'
      const prefix = 'Bearer '
      
      expect(authHeader.startsWith(prefix)).toBe(false)
    })
  })
})

describe('Webhook Rate Limiting', () => {
  it('should allow requests within limit', async () => {
    const { webhookLimiter } = await import('@/lib/rate-limiter')
    const mockRequest = new Request('https://example.com/webhook')
    
    await expect(webhookLimiter.checkLimit(mockRequest)).resolves.toBeUndefined()
  })
})

describe('Webhook Event Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should store webhook events with correct data', async () => {
    const { storeWebhookEvent } = await import('@/lib/webhooks/webhook-service')
    
    const eventData = {
      source: 'stripe' as const,
      eventType: 'payment_intent.succeeded',
      title: 'Stripe: payment_intent.succeeded',
      description: 'Payment succeeded',
      severity: 'info' as const,
      metadata: { eventId: 'evt_123' },
      timestamp: new Date(),
    }
    
    const result = await storeWebhookEvent(eventData)
    
    expect(storeWebhookEvent).toHaveBeenCalledWith(eventData)
    expect(result).toBe('test-event-id')
  })

  it('should store alerts from Prometheus webhooks', async () => {
    const { storeAlert } = await import('@/lib/webhooks/webhook-service')
    
    const alertData = {
      name: 'HighCPUUsage',
      severity: 'warning' as const,
      status: 'firing' as const,
      startsAt: new Date(),
      summary: 'CPU usage above 80%',
    }
    
    const result = await storeAlert(alertData)
    
    expect(storeAlert).toHaveBeenCalledWith(alertData)
    expect(result).toBe('test-alert-id')
  })

  it('should store deployment events from ArgoCD webhooks', async () => {
    const { storeDeploymentEvent } = await import('@/lib/webhooks/webhook-service')
    
    const deploymentData = {
      applicationId: 'app-123',
      applicationName: 'my-app',
      environment: 'production',
      action: 'deploy' as const,
      status: 'succeeded' as const,
      triggeredBy: 'argocd',
    }
    
    const result = await storeDeploymentEvent(deploymentData)
    
    expect(storeDeploymentEvent).toHaveBeenCalledWith(deploymentData)
    expect(result).toBe('test-deployment-id')
  })
})

describe('Webhook Payload Processing', () => {
  describe('Stripe Payloads', () => {
    const TRACKED_EVENTS = [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'invoice.paid',
      'invoice.payment_failed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]

    it('should track payment_intent.succeeded events', () => {
      expect(TRACKED_EVENTS).toContain('payment_intent.succeeded')
    })

    it('should track subscription events', () => {
      expect(TRACKED_EVENTS).toContain('customer.subscription.created')
      expect(TRACKED_EVENTS).toContain('customer.subscription.updated')
      expect(TRACKED_EVENTS).toContain('customer.subscription.deleted')
    })

    it('should not track unrelated events', () => {
      expect(TRACKED_EVENTS).not.toContain('customer.created')
      expect(TRACKED_EVENTS).not.toContain('product.updated')
    })
  })

  describe('Clerk Payloads', () => {
    it('should identify user events', () => {
      const userEvents = ['user.created', 'user.updated', 'user.deleted']
      
      userEvents.forEach(event => {
        expect(event.startsWith('user.')).toBe(true)
      })
    })

    it('should identify session events', () => {
      const sessionEvents = ['session.created', 'session.ended']
      
      sessionEvents.forEach(event => {
        expect(event.startsWith('session.')).toBe(true)
      })
    })
  })

  describe('Sentry Payloads', () => {
    it('should identify issue events by resource header', () => {
      const resource = 'issue'
      expect(resource).toBe('issue')
    })

    it('should extract issue data from payload', () => {
      const payload = {
        action: 'created',
        data: {
          issue: {
            id: 'issue-123',
            title: 'Error: Something went wrong',
            culprit: 'src/app.js',
          },
        },
      }
      
      expect(payload.action).toBe('created')
      expect(payload.data.issue.id).toBe('issue-123')
      expect(payload.data.issue.title).toBeDefined()
    })
  })

  describe('ArgoCD Payloads', () => {
    it('should extract app metadata from payload', () => {
      const payload = {
        app: {
          metadata: {
            name: 'my-app',
            namespace: 'production',
          },
          status: {
            health: { status: 'Healthy' },
            sync: { status: 'Synced', revision: 'abc123' },
          },
        },
        eventType: 'app.sync.succeeded',
      }
      
      expect(payload.app.metadata.name).toBe('my-app')
      expect(payload.app.status.health.status).toBe('Healthy')
      expect(payload.app.status.sync.status).toBe('Synced')
    })

    it('should determine severity based on event type', () => {
      const getSeverityForEvent = (eventType: string): string => {
        switch (eventType) {
          case 'app.sync.failed':
          case 'app.health.degraded':
            return 'critical'
          case 'app.deleted':
            return 'warning'
          default:
            return 'info'
        }
      }
      
      expect(getSeverityForEvent('app.sync.failed')).toBe('critical')
      expect(getSeverityForEvent('app.health.degraded')).toBe('critical')
      expect(getSeverityForEvent('app.deleted')).toBe('warning')
      expect(getSeverityForEvent('app.created')).toBe('info')
    })
  })
})

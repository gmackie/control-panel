import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/webhooks/prometheus/alerts/route'

vi.mock('@repo/webhooks', () => ({
  storeWebhookEvent: vi.fn().mockResolvedValue('test-event-id'),
  storeAlert: vi.fn().mockResolvedValue('test-alert-id'),
  updateAlertStatus: vi.fn().mockResolvedValue(true),
  createNotification: vi.fn().mockResolvedValue('test-notification-id'),
  webhookLimiter: {
    checkLimit: vi.fn().mockResolvedValue(undefined),
  },
  verifyBearerToken: vi.fn().mockImplementation(
    (auth: string | null, webhookToken: string | null, expected: string) => {
      if (!expected) return { valid: true }
      const candidate = auth?.startsWith('Bearer ') ? auth.slice(7) : webhookToken
      if (!candidate) return { valid: false, error: 'Missing token' }
      return candidate === expected ? { valid: true } : { valid: false, error: 'Invalid token' }
    }
  ),
  RateLimitError: class extends Error {
    statusCode = 429
    code = 'RATE_LIMIT_EXCEEDED'
    retryAfter?: number
    constructor(msg = 'Rate limit exceeded', retryAfter?: number) {
      super(msg)
      this.retryAfter = retryAfter
    }
  },
}))

vi.mock('@repo/db', () => ({
  getDb: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/webhooks/webhook-service', () => ({
  sendSlackNotification: vi.fn().mockResolvedValue(true),
}))

vi.mock('@repo/forgegraph', async () => {
  const actual = await vi.importActual<typeof import('@repo/forgegraph')>('@repo/forgegraph')
  return {
    ...actual,
    evaluateBatchRollback: vi.fn().mockResolvedValue([]),
    getControlPlaneClientConfig: vi.fn(),
    sendControlPlaneRollback: vi.fn().mockResolvedValue({ statusCode: 200, body: { ok: true } }),
  }
})

function buildPayload(fingerprint: string, status: 'firing' | 'resolved' = 'firing') {
  const now = new Date()
  return {
    version: '4',
    groupKey: 'group-key',
    truncatedAlerts: 0,
    status,
    receiver: 'forgegraph-control-panel',
    groupLabels: {
      namespace: 'production',
      repository: 'acme/service',
      service: 'api',
    },
    commonLabels: {
      severity: 'critical',
      namespace: 'production',
      repository: 'acme/service',
      service: 'api',
    },
    commonAnnotations: {
      summary: 'Fallback summary',
    },
    externalURL: 'https://prometheus.example.test',
    alerts: [
      {
        status,
        labels: {
          alertname: 'api-high-error-rate',
          severity: 'critical',
          namespace: 'production',
          service: 'api',
          repository: 'acme/service',
          source_revision: 'rev-123',
          source_deployment_id: 'deploy-abc',
          rollback_image_tag: 'rollback-image',
        },
        annotations: {
          summary: 'High 5xx spike',
          description: 'Critical error ratio increased above threshold',
          rollback_image_tag: 'rollback-image',
          runbook_url: 'https://runbooks.example.test/api-errors',
        },
        startsAt: now.toISOString(),
        endsAt: now.toISOString(),
        generatorURL: 'https://grafana.example.test/alert',
        fingerprint,
      },
    ],
  }
}

describe('Prometheus webhook route', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.PROMETHEUS_WEBHOOK_TOKEN = 'prometheus-token'
    process.env.PROMETHEUS_BEARER_TOKEN = 'prometheus-token'
    process.env.FORGEGRAPH_API_URL = 'https://forgegraph.test'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns 401 when token is required but not provided', async () => {
    const request = new NextRequest('https://control-panel.local/api/webhooks/prometheus/alerts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(buildPayload('fp-unauth')),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toHaveProperty('error', 'Unauthorized')
  })

  it('accepts x-webhook-token header as auth fallback', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = 'true'
    const forgeModule = await import('@repo/forgegraph')
    vi.mocked(forgeModule.evaluateBatchRollback).mockResolvedValue([
      { alertName: 'api-high-error-rate', action: 'triggered', reason: 'Rollback request submitted' },
    ])

    const request = new NextRequest('https://control-panel.local/api/webhooks/prometheus/alerts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-token': 'prometheus-token',
      },
      body: JSON.stringify(buildPayload('fp-webhook-token')),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.controlPlaneRollbacks).toHaveLength(1)
    expect(body.controlPlaneRollbacks[0].action).toBe('triggered')
  })

  it('supports bearer token authorization', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = 'true'
    process.env.PROMETHEUS_AUTO_ROLLBACK_SEVERITIES = 'critical'
    process.env.PROMETHEUS_AUTO_ROLLBACK_ENVIRONMENTS = 'production'

    const forgeModule = await import('@repo/forgegraph')
    vi.mocked(forgeModule.evaluateBatchRollback).mockResolvedValue([
      { alertName: 'api-high-error-rate', action: 'triggered', reason: 'Rollback submitted' },
    ])

    const request = new NextRequest('https://control-panel.local/api/webhooks/prometheus/alerts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer prometheus-token',
      },
      body: JSON.stringify(buildPayload('fp-bearer')),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.controlPlaneRollbacks[0].action).toBe('triggered')
  })

  it('returns disabled decision when policy is enabled but callback client is missing', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = 'true'
    process.env.PROMETHEUS_AUTO_ROLLBACK_SEVERITIES = 'critical'
    process.env.PROMETHEUS_AUTO_ROLLBACK_ENVIRONMENTS = 'production'

    const forgeModule = await import('@repo/forgegraph')
    vi.mocked(forgeModule.evaluateBatchRollback).mockResolvedValue([
      { alertName: 'api-high-error-rate', action: 'disabled', reason: 'ForgeGraph control-plane callback not configured in this environment' },
    ])

    const request = new NextRequest('https://control-panel.local/api/webhooks/prometheus/alerts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer prometheus-token',
      },
      body: JSON.stringify(buildPayload('fp-missing-client')),
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.controlPlaneRollbacks).toHaveLength(1)
    expect(body.controlPlaneRollbacks[0].action).toBe('disabled')
    expect(body.controlPlaneRollbacks[0].reason).toContain('not configured')
  })
})

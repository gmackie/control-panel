import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/webhooks/prometheus/alerts/route'

vi.mock('@/lib/webhooks/webhook-service', () => ({
  storeWebhookEvent: vi.fn().mockResolvedValue('test-event-id'),
  storeAlert: vi.fn().mockResolvedValue('test-alert-id'),
  updateAlertStatus: vi.fn().mockResolvedValue(true),
  createNotification: vi.fn().mockResolvedValue('test-notification-id'),
  sendSlackNotification: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/rate-limiter', () => ({
  webhookLimiter: {
    checkLimit: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/forgegraph/control-plane', () => ({
  getControlPlaneClientConfig: vi.fn(),
  sendControlPlaneRollback: vi.fn(),
}))

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
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('accepts x-webhook-token header as auth fallback', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = 'true'
    const forgeModule = await import('@/lib/forgegraph/control-plane')
    vi.mocked(forgeModule.getControlPlaneClientConfig).mockReturnValue({
      baseUrl: 'https://forgegraph.test',
      token: 'control-plane-token',
      endpointPath: '/api/webhooks/control-plane',
      requestTimeoutMs: 5000,
    })

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
    expect(vi.mocked(forgeModule.sendControlPlaneRollback)).toHaveBeenCalledTimes(1)
    expect(body.controlPlaneRollbacks).toHaveLength(1)
    expect(body.controlPlaneRollbacks[0].action).toBe('triggered')
  })

  it('supports bearer token authorization', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = 'true'
    process.env.PROMETHEUS_AUTO_ROLLBACK_SEVERITIES = 'critical'
    process.env.PROMETHEUS_AUTO_ROLLBACK_ENVIRONMENTS = 'production'

    const forgeModule = await import('@/lib/forgegraph/control-plane')
    vi.mocked(forgeModule.getControlPlaneClientConfig).mockReturnValue({
      baseUrl: 'https://forgegraph.test',
      token: 'control-plane-token',
      endpointPath: '/api/webhooks/control-plane',
      requestTimeoutMs: 5000,
    })
    vi.mocked(forgeModule.sendControlPlaneRollback).mockResolvedValue({
      statusCode: 200,
      body: { ok: true },
    })

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
    expect(forgeModule.sendControlPlaneRollback).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'alertmanager',
        repoName: 'acme/service',
        environment: 'production',
        sourceRevision: 'rev-123',
        sourceDeploymentId: 'deploy-abc',
        rollbackImageTag: 'rollback-image',
      }),
      expect.any(String),
      expect.objectContaining({
        baseUrl: 'https://forgegraph.test',
      })
    )
  })

  it('returns disabled decision when policy is enabled but callback client is missing', async () => {
    process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED = 'true'
    process.env.PROMETHEUS_AUTO_ROLLBACK_SEVERITIES = 'critical'
    process.env.PROMETHEUS_AUTO_ROLLBACK_ENVIRONMENTS = 'production'

    const forgeModule = await import('@/lib/forgegraph/control-plane')
    vi.mocked(forgeModule.getControlPlaneClientConfig).mockReturnValue(null)

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

import { NextRequest, NextResponse } from 'next/server'
import {
  storeWebhookEvent,
  storeAlert,
  updateAlertStatus,
  createNotification,
  sendSlackNotification,
} from '@/lib/webhooks/webhook-service'
import {
  sendControlPlaneRollback,
  getControlPlaneClientConfig,
  type ForgeGraphRollbackPayload,
} from '@/lib/forgegraph/control-plane'
import { verifyBearerToken } from '@/lib/webhooks/signature-verification'
import { webhookLimiter } from '@/lib/rate-limiter'
import { RateLimitError } from '@/lib/api-errors'

interface PrometheusAlert {
  status: 'firing' | 'resolved'
  labels: {
    alertname: string
    severity: string
    instance?: string
    job?: string
    namespace?: string
    pod?: string
    service?: string
    [key: string]: string | undefined
  }
  annotations: {
    summary?: string
    description?: string
    runbook_url?: string
    [key: string]: string | undefined
  }
  startsAt: string
  endsAt: string
  generatorURL: string
  fingerprint: string
}

interface AlertmanagerWebhookPayload {
  version: string
  groupKey: string
  truncatedAlerts: number
  status: 'firing' | 'resolved'
  receiver: string
  groupLabels: Record<string, string>
  commonLabels: Record<string, string>
  commonAnnotations: Record<string, string>
  externalURL: string
  alerts: PrometheusAlert[]
}

type RollbackPolicySeverity = 'critical' | 'warning' | 'info'

interface ParsedControlPlaneRollbackConfig {
  enabled: boolean
  severities: RollbackPolicySeverity[]
  environments: string[]
  dedupeWindowMs: number
}

interface RollbackDecision {
  alertName: string
  action: 'skipped' | 'deduped' | 'no-target' | 'disabled' | 'failed' | 'triggered'
  reason: string
  response?: unknown
}

const controlPlaneRollbackDedupe = new Map<string, number>()

function getPrometheusWebhookToken(): string | undefined {
  const token =
    process.env.PROMETHEUS_BEARER_TOKEN ||
    process.env.PROMETHEUS_WEBHOOK_TOKEN ||
    process.env.FORGEGRAPH_WEBHOOK_TOKEN ||
    process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_TOKEN ||
    process.env.CONTROL_PLANE_WEBHOOK_TOKEN ||
    process.env.PROMETHEUS_WEBHOOK_SECRET

  return token?.trim() || undefined
}

function isWebhookRequestAuthorized(request: NextRequest, token: string): boolean {
  const authHeader = request.headers.get('authorization')
  const webhookTokenHeader = request.headers.get('x-webhook-token')?.trim()

  return (
    (authHeader ? verifyBearerToken(authHeader, token).valid : false) ||
    (webhookTokenHeader ? verifyBearerToken(`Bearer ${webhookTokenHeader}`, token).valid : false)
  )
}

function readBooleanEnv(input: string | undefined, defaultValue: boolean): boolean {
  if (input == null || input.trim().length === 0) {
    return defaultValue
  }

  const normalized = input.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
}

function readCommaList(input: string | undefined, fallback: string[]): string[] {
  if (!input) {
    return fallback
  }

  const values = input
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  return values.length > 0 ? values : fallback
}

function readIntEnv(input: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(input ?? '', 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

function getRollbackPolicyConfig(): ParsedControlPlaneRollbackConfig {
  return {
    enabled: readBooleanEnv(
      process.env.FORGEGRAPH_AUTO_ROLLBACK_ENABLED ?? process.env.PROMETHEUS_AUTO_ROLLBACK_ENABLED,
      false
    ),
    severities: readCommaList(
      process.env.FORGEGRAPH_AUTO_ROLLBACK_SEVERITIES ?? process.env.PROMETHEUS_AUTO_ROLLBACK_SEVERITIES,
      ['critical']
    ) as RollbackPolicySeverity[],
    environments: readCommaList(
      process.env.FORGEGRAPH_AUTO_ROLLBACK_ENVIRONMENTS ?? process.env.PROMETHEUS_AUTO_ROLLBACK_ENVIRONMENTS,
      ['production']
    ),
    dedupeWindowMs: readIntEnv(
      process.env.PROMETHEUS_ROLLBACK_DEDUPE_WINDOW_MS ?? process.env.FORGEGRAPH_ROLLBACK_DEDUPE_WINDOW_MS,
      5 * 60 * 1000
    ),
  }
}

function nowIso8601(): string {
  return new Date().toISOString()
}

function normalizeEnvironmentLabel(value: string | undefined): string {
  if (!value) {
    return ''
  }

  const normalized = value.toLowerCase()
  if (normalized.includes('prod')) return 'production'
  if (normalized.includes('stag')) return 'staging'
  if (normalized.includes('dev')) return 'dev'
  if (normalized.includes('preview')) return 'preview'
  return normalized
}

function normalizeSeverityForPolicy(value: string | undefined): RollbackPolicySeverity {
  const normalized = (value || '').toLowerCase()

  if (normalized === 'critical' || normalized === 'fatal' || normalized === 'emergency') {
    return 'critical'
  }

  if (
    normalized === 'warning' ||
    normalized === 'warn' ||
    normalized === 'high' ||
    normalized === 'medium'
  ) {
    return 'warning'
  }

  return 'info'
}

function firstNonEmpty(input: Record<string, string | undefined>, keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = input[key]
    if (candidate && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return undefined
}

function cleanupDedupes(): void {
  const currentTime = Date.now()
  for (const [key, expiresAt] of controlPlaneRollbackDedupe) {
    if (expiresAt <= currentTime) {
      controlPlaneRollbackDedupe.delete(key)
    }
  }
}

function hasRecentRollbackDecision(dedupeKey: string): boolean {
  cleanupDedupes()

  const now = Date.now()
  const expiry = controlPlaneRollbackDedupe.get(dedupeKey)
  if (expiry && expiry > now) {
    return true
  }

  controlPlaneRollbackDedupe.set(dedupeKey, now + getRollbackPolicyConfig().dedupeWindowMs)
  return false
}

function createControlPlanePayload(
  alert: PrometheusAlert,
  commonMetadata: {
    namespace?: string
    environment?: string
  }
): ForgeGraphRollbackPayload | null {
  const repoName = firstNonEmpty(alert.labels, [
    'repository',
    'repo',
    'project',
    'repository_name',
    'service',
  ])

  if (!repoName) {
    return null
  }

  const environment = normalizeEnvironmentLabel(
    firstNonEmpty(alert.labels, ['environment', 'env']) ||
    commonMetadata.environment ||
    commonMetadata.namespace
  ) || normalizeEnvironmentLabel(commonMetadata.namespace) || 'production'

  const sourceDeploymentId = firstNonEmpty(alert.labels, [
    'source_deployment_id',
    'sourceDeploymentId',
  ])

  const sourceRevision = firstNonEmpty(alert.labels, [
    'source_revision',
    'sourceRevision',
    'revision',
    'sha',
    'commit',
  ])

  const rollbackImageTag = firstNonEmpty(alert.annotations, [
    'rollback_image_tag',
    'rollback_image',
    'image_tag',
  ]) || firstNonEmpty(alert.labels, ['rollback_image_tag', 'rollback_image', 'image_tag'])

  const reason =
    alert.annotations.reason ??
    alert.labels.reason ??
    `${alert.labels.alertname} ${alert.status} on ${alert.labels.namespace ?? 'default namespace'}`

  return {
    source: 'alertmanager',
    repoName,
    environment: environment as ForgeGraphRollbackPayload['environment'],
    sourceDeploymentId,
    sourceRevision,
    rollbackImageTag,
    reason,
    metadata: {
      source: 'alertmanager',
      alertname: alert.labels.alertname,
      fingerprint: alert.fingerprint,
      severity: alert.labels.severity,
      namespace: alert.labels.namespace,
      pod: alert.labels.pod,
      service: alert.labels.service,
      reasonSource: 'prometheus-webhook',
    },
  }
}

async function maybeTriggerControlPlaneRollback(
  alert: PrometheusAlert,
  payload: AlertmanagerWebhookPayload
): Promise<RollbackDecision> {
  const policy = getRollbackPolicyConfig()

  if (!policy.enabled) {
    return {
      alertName: alert.labels.alertname,
      action: 'disabled',
      reason: 'Rollback policy disabled in environment',
    }
  }

  const policyAllowedEnvironments = new Set(policy.environments.map((item) => item.toLowerCase()))
  const namespace = alert.labels.namespace || payload.commonLabels.namespace || payload.groupLabels.namespace
  const resolvedSeverity = normalizeSeverityForPolicy(alert.labels.severity)
  const isSeverityAllowed = policy.severities.includes(resolvedSeverity)
  const resolvedEnvironment = normalizeEnvironmentLabel(
    alert.labels.environment ||
    alert.labels.env ||
    namespace ||
    payload.commonLabels.environment ||
    payload.groupLabels.environment
  ) || 'production'

  if (!policyAllowedEnvironments.includes(resolvedEnvironment)) {
    return {
      alertName: alert.labels.alertname,
      action: 'skipped',
      reason: `Environment "${resolvedEnvironment}" not in rollback policy environments`,
    }
  }

  if (!isSeverityAllowed) {
    return {
      alertName: alert.labels.alertname,
      action: 'skipped',
      reason: `Severity "${resolvedSeverity}" not in policy allowlist`,
    }
  }

  const controlPlanePayload = createControlPlanePayload(alert, {
    namespace,
    environment: alert.labels.environment || namespace,
  })

  if (!controlPlanePayload) {
    return {
      alertName: alert.labels.alertname,
      action: 'no-target',
      reason: 'Missing repo context for control-plane rollback',
    }
  }

  if (
    !controlPlanePayload.sourceDeploymentId &&
    !controlPlanePayload.sourceRevision &&
    !controlPlanePayload.rollbackImageTag
  ) {
    return {
      alertName: alert.labels.alertname,
      action: 'no-target',
      reason: 'Missing sourceRevision or rollbackImageTag in alert payload',
    }
  }

  const dedupeSeed = [
    controlPlanePayload.repoName,
    controlPlanePayload.environment,
    controlPlanePayload.sourceRevision,
    controlPlanePayload.rollbackImageTag,
    alert.fingerprint || alert.labels.alertname,
  ]
    .filter(Boolean)
    .join('|')

  if (hasRecentRollbackDecision(dedupeSeed)) {
    return {
      alertName: alert.labels.alertname,
      action: 'deduped',
      reason: 'Rollback event deduplicated within configured window',
    }
  }

  const clientConfig = getControlPlaneClientConfig()
  if (!clientConfig) {
    return {
      alertName: alert.labels.alertname,
      action: 'disabled',
      reason: 'ForgeGraph control-plane callback not configured in this environment',
    }
  }

  const requestId = crypto.randomUUID()
  const response = await sendControlPlaneRollback(
    {
      ...controlPlanePayload,
      metadata: {
        ...controlPlanePayload.metadata,
        controlPlaneRequestAt: nowIso8601(),
        controlPlaneRequestId: requestId,
        sourceAlertStatus: alert.status,
      },
    },
    requestId,
    clientConfig
  )

  return {
    alertName: alert.labels.alertname,
    action: 'triggered',
    reason: 'Rollback request submitted to ForgeGraph',
    response: {
      requestId,
      statusCode: response.statusCode,
      body: response.body,
      repoName: controlPlanePayload.repoName,
      environment: controlPlanePayload.environment,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    await webhookLimiter.checkLimit(request)
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': String(error.retryAfter || 60) } }
      )
    }
    throw error
  }

  const prometheusToken = getPrometheusWebhookToken()
  if (prometheusToken) {
    const authorized = isWebhookRequestAuthorized(request, prometheusToken)
    if (!authorized) {
      console.error('Prometheus webhook auth failed: missing or invalid token')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  try {
    const payload: AlertmanagerWebhookPayload = await request.json()

    console.log(`Processing Prometheus alerts: ${payload.alerts.length} alerts (${payload.status})`)
    const rollbackDecisions: RollbackDecision[] = []

    for (const alert of payload.alerts) {
      const decision = await processAlert(alert, payload)
      if (decision) {
        rollbackDecisions.push(decision)
      }
    }
    
    await storeWebhookEvent({
      source: 'prometheus',
      eventType: 'alert',
      title: `Prometheus: ${payload.alerts.length} ${payload.status} alerts`,
      description: `Receiver: ${payload.receiver}`,
      severity: mapPrometheusSeverity(payload.commonLabels.severity),
      metadata: {
        status: payload.status,
        rollbackPolicyEnabled: getRollbackPolicyConfig().enabled,
        rollbackDecisions,
        alertCount: payload.alerts.length,
        groupKey: payload.groupKey,
        receiver: payload.receiver,
        commonLabels: payload.commonLabels,
        commonAnnotations: payload.commonAnnotations,
      },
    })

    const rollbackFailures = rollbackDecisions.filter((decision) => decision.action === 'failed').length

    const responseStatus = rollbackFailures > 0 ? 502 : 200
    const responseBody = {
      success: true,
      processed: payload.alerts.length,
      status: payload.status,
      controlPlaneRollbacks: rollbackDecisions,
    }

    if (responseStatus !== 200) {
      return NextResponse.json(responseBody, { status: responseStatus })
    }

    return NextResponse.json({
      success: true,
      processed: payload.alerts.length,
      status: payload.status,
      controlPlaneRollbacks: rollbackDecisions,
    })
  } catch (error) {
    console.error('Error processing Prometheus webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function mapPrometheusSeverity(severity?: string): 'info' | 'warning' | 'critical' {
  switch (severity) {
    case 'critical':
      return 'critical'
    case 'warning':
      return 'warning'
    default:
      return 'info'
  }
}

async function processAlert(alert: PrometheusAlert, payload: AlertmanagerWebhookPayload): Promise<RollbackDecision | null> {
  const alertName = alert.labels.alertname
  const severity = mapPrometheusSeverity(alert.labels.severity)
  const status = alert.status

  console.log(`Alert ${status}: ${alertName} (${alert.labels.severity})`)

  if (status === 'firing') {
    await handleFiringAlert(alert)
  } else {
    await handleResolvedAlert(alert)
  }

  if (status === 'firing' && payload.status === 'firing') {
    try {
      return await maybeTriggerControlPlaneRollback(alert, payload)
    } catch (error) {
      console.error(`Failed to trigger control-plane rollback for alert ${alertName}:`, error)
      return {
        alertName,
        action: 'failed',
        reason: error instanceof Error ? error.message : 'Failed to trigger control-plane rollback',
      }
    }
  }

  if (status === 'firing') {
    await storeAlert({
      fingerprint: alert.fingerprint,
      name: alertName,
      severity,
      status: 'firing',
      startsAt: new Date(alert.startsAt),
      endsAt: null,
      summary: alert.annotations.summary || alertName,
      description: alert.annotations.description,
      labels: Object.fromEntries(
        Object.entries(alert.labels).filter(([_, v]) => v !== undefined)
      ) as Record<string, string>,
    })
  } else {
    await updateAlertStatus(
      alertName,
      'resolved',
      new Date(alert.endsAt)
    )
  }

  return null
}

async function handleFiringAlert(alert: PrometheusAlert) {
  const severity = mapPrometheusSeverity(alert.labels.severity)
  const alertName = alert.labels.alertname
  const summary = alert.annotations.summary || alertName
  const description = alert.annotations.description || ''
  
  await createNotification({
    source: 'prometheus',
    category: 'alert',
    severity,
    title: `🚨 Alert: ${summary}`,
    message: description,
    appName: alert.labels.service || alert.labels.job,
    environment: alert.labels.namespace,
    links: alert.generatorURL 
      ? [{ url: alert.generatorURL, label: 'View in Prometheus' }]
      : undefined,
    groupKey: alert.fingerprint,
  })
  
  if (severity === 'critical' || severity === 'warning') {
    await sendSlackNotification({
      title: `🚨 Alert: ${summary}`,
      message: description,
      severity,
      url: alert.generatorURL,
    })
  }
  
  if (severity === 'critical') {
    console.log('Creating incident for critical alert:', summary)
  }
  
  if (alert.annotations.runbook_url) {
    console.log(`Runbook available: ${alert.annotations.runbook_url}`)
  }
}

async function handleResolvedAlert(alert: PrometheusAlert) {
  const alertName = alert.labels.alertname
  const summary = alert.annotations.summary || alertName
  
  console.log(`Alert resolved: ${alertName}`)
  
  await createNotification({
    source: 'prometheus',
    category: 'alert',
    severity: 'info',
    title: `✅ Resolved: ${summary}`,
    message: 'Alert has been resolved',
    appName: alert.labels.service || alert.labels.job,
    environment: alert.labels.namespace,
    groupKey: alert.fingerprint,
  })
  
  await sendSlackNotification({
    title: `✅ Resolved: ${summary}`,
    message: 'Alert has been resolved',
    severity: 'info',
  })
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Prometheus Alert Webhook Handler',
    status: 'active',
    features: [
      'Alert processing',
      'Severity-based routing',
      'Database persistence',
      'Resolution tracking',
      'Slack notifications'
    ]
  })
}

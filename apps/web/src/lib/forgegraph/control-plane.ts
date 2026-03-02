import { ExternalServiceError } from '@/lib/api-errors'

export type ForgeGraphRollbackEnvironment =
  | 'dev'
  | 'staging'
  | 'production'
  | 'preview'
  | 'prod'

export interface ForgeGraphRollbackPayload {
  source: 'control-plane' | 'alertmanager'
  repoId?: string
  repoName?: string
  workspaceId?: string
  environment: ForgeGraphRollbackEnvironment
  sourceDeploymentId?: string
  sourceRevision?: string
  rollbackDeploymentId?: string
  rollbackImageTag?: string
  reason?: string
  metadata?: Record<string, unknown>
}

export interface ForgeGraphControlPlaneClientConfig {
  baseUrl: string
  token: string
  endpointPath: string
  requestTimeoutMs: number
}

export interface ForgeGraphControlPlaneResponse {
  statusCode: number
  body: unknown
}

function parseTimeoutMs(rawValue: string | undefined): number {
  if (!rawValue) {
    return 5000
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 5000
  }

  return parsed
}

function normalizeEndpointPath(rawPath: string | undefined): string {
  if (!rawPath || rawPath.trim().length === 0) {
    return '/api/webhooks/control-plane'
  }

  if (!rawPath.startsWith('/')) {
    return `/${rawPath}`
  }

  return rawPath
}

function resolveControlPlaneToken(): string {
  return (
    process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_TOKEN ||
    process.env.CONTROL_PLANE_WEBHOOK_TOKEN ||
    process.env.FORGEGRAPH_WEBHOOK_TOKEN ||
    process.env.PROMETHEUS_WEBHOOK_TOKEN ||
    process.env.PROMETHEUS_BEARER_TOKEN ||
    ''
  ).trim()
}

function resolveControlPlaneBaseUrl(): string {
  return (
    process.env.FORGEGRAPH_API_URL ||
    process.env.LINEAR_CLONE_URL ||
    process.env.NEXT_PUBLIC_TASK_URL ||
    ''
  ).trim().replace(/\/$/, '')
}

export function getControlPlaneClientConfig(): ForgeGraphControlPlaneClientConfig | null {
  const baseUrl = resolveControlPlaneBaseUrl()
  const token = resolveControlPlaneToken()

  if (!baseUrl || !token) {
    return null
  }

  return {
    baseUrl,
    token,
    endpointPath: normalizeEndpointPath(process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_PATH),
    requestTimeoutMs: parseTimeoutMs(process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_TIMEOUT_MS),
  }
}

function buildEndpointUrl(config: ForgeGraphControlPlaneClientConfig): string {
  return `${config.baseUrl}${config.endpointPath}`
}

export async function sendControlPlaneRollback(
  payload: ForgeGraphRollbackPayload,
  requestId?: string,
  configOverride?: ForgeGraphControlPlaneClientConfig
): Promise<ForgeGraphControlPlaneResponse> {
  const config = configOverride ?? getControlPlaneClientConfig()
  if (!config) {
    throw new Error('ForgeGraph control-plane callback is not configured')
  }

  const endpointUrl = buildEndpointUrl(config)
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, config.requestTimeoutMs)

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'x-webhook-token': config.token,
        'Content-Type': 'application/json',
        ...(requestId ? { 'x-request-id': requestId } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const responseText = await response.text()
    let body: unknown
    try {
      body = JSON.parse(responseText)
    } catch {
      body = responseText
    }

    if (!response.ok) {
      throw new ExternalServiceError(
        'ForgeGraph control-plane callback',
        `Control-plane request failed: ${response.status} ${response.statusText}`,
      )
    }

    return {
      statusCode: response.status,
      body,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExternalServiceError('ForgeGraph control-plane callback', 'Request timed out')
    }

    if (error instanceof ExternalServiceError) {
      throw error
    }

    throw new ExternalServiceError(
      'ForgeGraph control-plane callback',
      error instanceof Error ? error.message : 'Unknown control-plane callback error',
    )
  } finally {
    clearTimeout(timer)
  }
}


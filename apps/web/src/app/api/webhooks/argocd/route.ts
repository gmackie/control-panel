import { NextRequest, NextResponse } from 'next/server'
import { 
  storeWebhookEvent, 
  storeDeploymentEvent, 
  createNotification,
  sendSlackNotification 
} from '@/lib/webhooks/webhook-service'
import { webhookLimiter } from '@/lib/rate-limiter'
import { RateLimitError } from '@/lib/api-errors'

interface ArgoCDWebhookPayload {
  app: {
    metadata: {
      name: string
      namespace: string
    }
    spec: {
      source: {
        repoURL: string
        path: string
        targetRevision: string
      }
      destination: {
        server: string
        namespace: string
      }
    }
    status: {
      health: {
        status: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown'
        message?: string
      }
      sync: {
        status: 'Synced' | 'OutOfSync' | 'Unknown'
        revision?: string
        message?: string
      }
      operationState?: {
        phase: 'Running' | 'Succeeded' | 'Failed' | 'Error' | 'Terminating'
        message?: string
        startedAt: string
        finishedAt?: string
      }
    }
  }
  eventType: string
  eventTime: string
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

  try {
    const payload: ArgoCDWebhookPayload = await request.json()
    
    console.log(`Processing ArgoCD webhook: ${payload.eventType} for app ${payload.app.metadata.name}`)
    
    switch (payload.eventType) {
      case 'app.created':
        await handleAppCreated(payload)
        break
      
      case 'app.updated':
        await handleAppUpdated(payload)
        break
      
      case 'app.deleted':
        await handleAppDeleted(payload)
        break
      
      case 'app.health.degraded':
        await handleAppDegraded(payload)
        break
      
      case 'app.sync.running':
        await handleSyncRunning(payload)
        break
      
      case 'app.sync.succeeded':
        await handleSyncSucceeded(payload)
        break
      
      case 'app.sync.failed':
        await handleSyncFailed(payload)
        break
      
      default:
        console.log(`Unhandled ArgoCD event type: ${payload.eventType}`)
    }
    
    await storeWebhookEvent({
      source: 'argocd',
      eventType: payload.eventType,
      appName: payload.app.metadata.name,
      environment: payload.app.metadata.namespace,
      title: `ArgoCD: ${payload.eventType}`,
      description: `Application ${payload.app.metadata.name} - ${payload.eventType}`,
      severity: getSeverityForEvent(payload.eventType),
      metadata: {
        syncStatus: payload.app.status.sync.status,
        healthStatus: payload.app.status.health.status,
        revision: payload.app.status.sync.revision,
      },
      timestamp: new Date(payload.eventTime),
    })
    
    return NextResponse.json({
      success: true,
      event: payload.eventType,
      app: payload.app.metadata.name
    })
  } catch (error) {
    console.error('Error processing ArgoCD webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getSeverityForEvent(eventType: string): 'info' | 'warning' | 'critical' {
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

async function handleAppCreated(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  const repoURL = payload.app.spec.source.repoURL
  
  console.log(`ArgoCD app created: ${appName} from ${repoURL}`)
  
  await storeDeploymentEvent({
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'deploy',
    branch: payload.app.spec.source.targetRevision,
    status: 'pending',
    triggeredBy: 'argocd',
    details: `New application created from ${repoURL}`,
  })
}

async function handleAppUpdated(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  const syncStatus = payload.app.status.sync.status
  const healthStatus = payload.app.status.health.status
  
  console.log(`ArgoCD app updated: ${appName} (sync: ${syncStatus}, health: ${healthStatus})`)
  
  await storeDeploymentEvent({
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'sync',
    version: payload.app.status.sync.revision,
    status: syncStatus === 'Synced' && healthStatus === 'Healthy' ? 'succeeded' : 'running',
    triggeredBy: 'argocd',
    details: `Sync: ${syncStatus}, Health: ${healthStatus}`,
    metadata: { syncStatus, healthStatus },
  })
}

async function handleAppDeleted(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  
  console.log(`ArgoCD app deleted: ${appName}`)
  
  await createNotification({
    source: 'argocd',
    category: 'deployment',
    severity: 'warning',
    title: `Application Deleted: ${appName}`,
    message: `ArgoCD application ${appName} has been deleted`,
    appName,
    environment: payload.app.metadata.namespace,
  })
}

async function handleAppDegraded(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  const message = payload.app.status.health.message || 'Application health is degraded'
  
  console.error(`ArgoCD app degraded: ${appName} - ${message}`)
  
  await createNotification({
    source: 'argocd',
    category: 'alert',
    severity: 'critical',
    title: `Application Degraded: ${appName}`,
    message,
    appName,
    environment: payload.app.metadata.namespace,
  })
  
  await sendSlackNotification({
    title: `⚠️ Application Degraded: ${appName}`,
    message,
    severity: 'warning',
  })
}

async function handleSyncRunning(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  
  console.log(`ArgoCD sync running for: ${appName}`)
  
  await storeDeploymentEvent({
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'sync',
    status: 'running',
    triggeredBy: 'argocd',
    details: 'Sync in progress',
    startedAt: payload.app.status.operationState?.startedAt 
      ? new Date(payload.app.status.operationState.startedAt) 
      : new Date(),
  })
}

async function handleSyncSucceeded(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  const revision = payload.app.status.sync.revision
  
  console.log(`ArgoCD sync succeeded for: ${appName} (revision: ${revision})`)
  
  await storeDeploymentEvent({
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'sync',
    version: revision,
    commitSha: revision,
    status: 'succeeded',
    triggeredBy: 'argocd',
    details: 'Sync completed successfully',
    completedAt: payload.app.status.operationState?.finishedAt 
      ? new Date(payload.app.status.operationState.finishedAt) 
      : new Date(),
  })
  
  await createNotification({
    source: 'argocd',
    category: 'deployment',
    severity: 'info',
    title: `Deployment Succeeded: ${appName}`,
    message: `Application ${appName} synced to revision ${revision?.slice(0, 7) || 'latest'}`,
    appName,
    environment: payload.app.metadata.namespace,
  })
}

async function handleSyncFailed(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  const message = payload.app.status.operationState?.message || 'ArgoCD sync failed'
  
  console.error(`ArgoCD sync failed for: ${appName} - ${message}`)
  
  await storeDeploymentEvent({
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'sync',
    status: 'failed',
    triggeredBy: 'argocd',
    details: message,
    completedAt: new Date(),
  })
  
  await createNotification({
    source: 'argocd',
    category: 'alert',
    severity: 'critical',
    title: `Deployment Failed: ${appName}`,
    message,
    appName,
    environment: payload.app.metadata.namespace,
  })
  
  await sendSlackNotification({
    title: `🚨 Deployment Failed: ${appName}`,
    message,
    severity: 'critical',
  })
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'ArgoCD Webhook Handler',
    status: 'active',
    supportedEvents: [
      'app.created',
      'app.updated',
      'app.deleted',
      'app.health.degraded',
      'app.sync.running',
      'app.sync.succeeded',
      'app.sync.failed'
    ]
  })
}

import { NextRequest, NextResponse } from 'next/server'

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
    const payload: ArgoCDWebhookPayload = await request.json()
    
    console.log(`Processing ArgoCD webhook: ${payload.eventType} for app ${payload.app.metadata.name}`)
    
    // Process different event types
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
    
    // Store webhook event
    await storeWebhookEvent({
      source: 'argocd',
      event: payload.eventType,
      appName: payload.app.metadata.name,
      payload,
      timestamp: new Date(payload.eventTime)
    })
    
    // Update application deployment status
    await updateDeploymentStatus(payload)
    
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

async function handleAppCreated(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  const repoURL = payload.app.spec.source.repoURL
  
  console.log(`ArgoCD app created: ${appName} from ${repoURL}`)
  
  // Register new application in control panel
  // TODO: Create application entry in database
}

async function handleAppUpdated(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  const syncStatus = payload.app.status.sync.status
  const healthStatus = payload.app.status.health.status
  
  console.log(`ArgoCD app updated: ${appName} (sync: ${syncStatus}, health: ${healthStatus})`)
  
  // Update application status
  // TODO: Update application status in database
}

async function handleAppDeleted(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  
  console.log(`ArgoCD app deleted: ${appName}`)
  
  // Mark application as deleted
  // TODO: Update application status to deleted
}

async function handleAppDegraded(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  const message = payload.app.status.health.message
  
  console.error(`ArgoCD app degraded: ${appName} - ${message}`)
  
  // Send alert about degraded application
  // TODO: Trigger alert for degraded application
  await sendAlert({
    severity: 'warning',
    title: `Application Degraded: ${appName}`,
    message: message || 'Application health is degraded',
    source: 'argocd'
  })
}

async function handleSyncRunning(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  
  console.log(`ArgoCD sync running for: ${appName}`)
  
  // Update deployment status to in-progress
  // TODO: Update deployment status
}

async function handleSyncSucceeded(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  const revision = payload.app.status.sync.revision
  
  console.log(`ArgoCD sync succeeded for: ${appName} (revision: ${revision})`)
  
  // Update deployment status to success
  // TODO: Update deployment status and record revision
}

async function handleSyncFailed(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name
  const message = payload.app.status.operationState?.message
  
  console.error(`ArgoCD sync failed for: ${appName} - ${message}`)
  
  // Send alert about sync failure
  await sendAlert({
    severity: 'critical',
    title: `Deployment Failed: ${appName}`,
    message: message || 'ArgoCD sync failed',
    source: 'argocd'
  })
}

async function updateDeploymentStatus(payload: ArgoCDWebhookPayload) {
  // TODO: Update deployment status in database
  const status = {
    appName: payload.app.metadata.name,
    syncStatus: payload.app.status.sync.status,
    healthStatus: payload.app.status.health.status,
    revision: payload.app.status.sync.revision,
    timestamp: new Date(payload.eventTime)
  }
  
  console.log('Updating deployment status:', status)
}

async function sendAlert(alert: any) {
  // TODO: Send alert through notification system
  console.log('Sending alert:', alert)
}

async function storeWebhookEvent(event: any) {
  // TODO: Store in database for audit and monitoring
  console.log('Storing webhook event:', event.source, event.event)
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
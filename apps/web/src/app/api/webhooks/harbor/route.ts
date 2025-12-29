import { NextRequest, NextResponse } from 'next/server'
import {
  storeWebhookEvent,
  storeAlert,
  createNotification,
  sendSlackNotification,
} from '@/lib/webhooks/webhook-service'
import { webhookLimiter } from '@/lib/rate-limiter'
import { RateLimitError } from '@/lib/api-errors'

interface HarborWebhookPayload {
  type: string
  occur_at: number
  operator: string
  event_data: {
    resources?: Array<{
      resource_url: string
      tag: string
      digest: string
    }>
    repository?: {
      name: string
      namespace: string
      repo_full_name: string
      repo_type: string
    }
    custom_attributes?: Record<string, unknown>
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

  try {
    const authHeader = request.headers.get('Authorization')
    const expectedToken = `Bearer ${process.env.HARBOR_WEBHOOK_TOKEN || ''}`
    
    if (authHeader !== expectedToken) {
      console.error('Invalid Harbor webhook authorization')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const payload: HarborWebhookPayload = await request.json()
    
    console.log(`Processing Harbor webhook: ${payload.type}`)
    
    const repo = payload.event_data.repository?.repo_full_name || 'unknown'
    const tag = payload.event_data.resources?.[0]?.tag || 'unknown'
    
    switch (payload.type) {
      case 'PUSH_ARTIFACT':
        await handlePushArtifact(payload, repo, tag)
        break
      
      case 'PULL_ARTIFACT':
        await handlePullArtifact(repo, tag)
        break
      
      case 'DELETE_ARTIFACT':
        await handleDeleteArtifact(payload, repo, tag)
        break
      
      case 'SCANNING_COMPLETED':
        await handleScanCompleted(repo, tag)
        break
      
      case 'SCANNING_FAILED':
        await handleScanFailed(payload, repo, tag)
        break
      
      case 'QUOTA_EXCEED':
        await handleQuotaExceed(payload)
        break
      
      default:
        console.log(`Unhandled Harbor event type: ${payload.type}`)
    }
    
    await storeWebhookEvent({
      source: 'harbor',
      eventType: payload.type,
      appName: repo,
      title: `Harbor ${payload.type}: ${repo}:${tag}`,
      description: `Operator: ${payload.operator}`,
      severity: getSeverityForEvent(payload.type),
      metadata: {
        operator: payload.operator,
        repository: payload.event_data.repository,
        resources: payload.event_data.resources,
      },
      timestamp: new Date(payload.occur_at * 1000),
    })
    
    return NextResponse.json({
      success: true,
      event: payload.type
    })
  } catch (error) {
    console.error('Error processing Harbor webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getSeverityForEvent(eventType: string): 'info' | 'warning' | 'critical' {
  switch (eventType) {
    case 'SCANNING_FAILED':
    case 'QUOTA_EXCEED':
      return 'critical'
    case 'DELETE_ARTIFACT':
      return 'warning'
    default:
      return 'info'
  }
}

async function handlePushArtifact(payload: HarborWebhookPayload, repo: string, tag: string) {
  console.log(`New artifact pushed: ${repo}:${tag}`)
  
  await createNotification({
    source: 'harbor',
    category: 'registry',
    severity: 'info',
    title: `New Image Pushed: ${repo}:${tag}`,
    message: `A new container image was pushed by ${payload.operator}`,
    appName: repo,
    links: payload.event_data.resources?.[0]?.resource_url 
      ? [{ url: payload.event_data.resources[0].resource_url, label: 'View in Harbor' }]
      : undefined,
  })
  
  if (tag === 'latest' || tag?.startsWith('v')) {
    console.log('Triggering deployment for new artifact...')
    // TODO: Trigger ArgoCD sync or deployment pipeline
  }
}

async function handlePullArtifact(repo: string, tag: string) {
  console.log(`Artifact pulled: ${repo}:${tag}`)
}

async function handleDeleteArtifact(payload: HarborWebhookPayload, repo: string, tag: string) {
  console.log(`Artifact deleted: ${repo}:${tag}`)
  
  await createNotification({
    source: 'harbor',
    category: 'registry',
    severity: 'warning',
    title: `Image Deleted: ${repo}:${tag}`,
    message: `Container image was deleted by ${payload.operator}`,
    appName: repo,
  })
}

async function handleScanCompleted(repo: string, tag: string) {
  console.log(`Security scan completed: ${repo}:${tag}`)
  
  await createNotification({
    source: 'harbor',
    category: 'security',
    severity: 'info',
    title: `Security Scan Complete: ${repo}:${tag}`,
    message: 'Image security scan has completed successfully',
    appName: repo,
  })
}

async function handleScanFailed(payload: HarborWebhookPayload, repo: string, tag: string) {
  console.error(`Security scan failed: ${repo}:${tag}`)
  
  await storeAlert({
    name: `harbor-scan-failed-${repo}`,
    severity: 'critical',
    status: 'firing',
    startsAt: new Date(payload.occur_at * 1000),
    summary: `Security scan failed for ${repo}:${tag}`,
    description: 'Harbor security scan was unable to complete. Manual investigation required.',
    labels: { repository: repo, tag, source: 'harbor' },
  })
  
  await createNotification({
    source: 'harbor',
    category: 'security',
    severity: 'critical',
    title: `Security Scan Failed: ${repo}:${tag}`,
    message: 'Image security scan failed. Manual investigation required.',
    appName: repo,
  })
  
  await sendSlackNotification({
    title: `🚨 Security Scan Failed: ${repo}:${tag}`,
    message: 'Harbor security scan was unable to complete. Manual investigation required.',
    severity: 'critical',
  })
}

async function handleQuotaExceed(payload: HarborWebhookPayload) {
  console.error('Harbor storage quota exceeded!')
  
  await storeAlert({
    name: 'harbor-quota-exceeded',
    severity: 'critical',
    status: 'firing',
    startsAt: new Date(payload.occur_at * 1000),
    summary: 'Harbor storage quota exceeded',
    description: 'Container registry storage quota has been exceeded. Cleanup required.',
  })
  
  await createNotification({
    source: 'harbor',
    category: 'infrastructure',
    severity: 'critical',
    title: 'Harbor Storage Quota Exceeded',
    message: 'Container registry storage quota has been exceeded. Immediate cleanup required.',
  })
  
  await sendSlackNotification({
    title: '🚨 Harbor Storage Quota Exceeded',
    message: 'Container registry storage quota has been exceeded. Immediate cleanup required.',
    severity: 'critical',
  })
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Harbor Webhook Handler',
    status: 'active',
    supportedEvents: [
      'PUSH_ARTIFACT',
      'PULL_ARTIFACT',
      'DELETE_ARTIFACT',
      'SCANNING_COMPLETED',
      'SCANNING_FAILED',
      'QUOTA_EXCEED'
    ]
  })
}

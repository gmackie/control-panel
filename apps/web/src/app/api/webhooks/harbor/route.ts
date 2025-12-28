import { NextRequest, NextResponse } from 'next/server'

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
    custom_attributes?: Record<string, any>
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const expectedToken = `Bearer ${process.env.HARBOR_WEBHOOK_TOKEN || ''}`
    
    // Verify authorization
    if (authHeader !== expectedToken) {
      console.error('Invalid Harbor webhook authorization')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const payload: HarborWebhookPayload = await request.json()
    
    console.log(`Processing Harbor webhook: ${payload.type}`)
    
    // Process different event types
    switch (payload.type) {
      case 'PUSH_ARTIFACT':
        await handlePushArtifact(payload)
        break
      
      case 'PULL_ARTIFACT':
        await handlePullArtifact(payload)
        break
      
      case 'DELETE_ARTIFACT':
        await handleDeleteArtifact(payload)
        break
      
      case 'SCANNING_COMPLETED':
        await handleScanCompleted(payload)
        break
      
      case 'SCANNING_FAILED':
        await handleScanFailed(payload)
        break
      
      case 'QUOTA_EXCEED':
        await handleQuotaExceed(payload)
        break
      
      default:
        console.log(`Unhandled Harbor event type: ${payload.type}`)
    }
    
    // Store webhook event
    await storeWebhookEvent({
      source: 'harbor',
      event: payload.type,
      operator: payload.operator,
      payload,
      timestamp: new Date(payload.occur_at * 1000)
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

async function handlePushArtifact(payload: HarborWebhookPayload) {
  const repo = payload.event_data.repository?.repo_full_name
  const tag = payload.event_data.resources?.[0]?.tag
  
  console.log(`New artifact pushed: ${repo}:${tag}`)
  
  // Trigger deployment if it's a production tag
  if (tag === 'latest' || tag?.startsWith('v')) {
    console.log('Triggering deployment for new artifact...')
    // TODO: Trigger ArgoCD sync or deployment pipeline
  }
}

async function handlePullArtifact(payload: HarborWebhookPayload) {
  const repo = payload.event_data.repository?.repo_full_name
  const tag = payload.event_data.resources?.[0]?.tag
  
  console.log(`Artifact pulled: ${repo}:${tag}`)
  
  // Track usage metrics
  // TODO: Update pull metrics
}

async function handleDeleteArtifact(payload: HarborWebhookPayload) {
  const repo = payload.event_data.repository?.repo_full_name
  const tag = payload.event_data.resources?.[0]?.tag
  
  console.log(`Artifact deleted: ${repo}:${tag}`)
  
  // Clean up related deployments if needed
  // TODO: Check if any deployments use this artifact
}

async function handleScanCompleted(payload: HarborWebhookPayload) {
  const repo = payload.event_data.repository?.repo_full_name
  const tag = payload.event_data.resources?.[0]?.tag
  
  console.log(`Security scan completed: ${repo}:${tag}`)
  
  // Check scan results and take action if vulnerabilities found
  // TODO: Fetch scan results and alert if critical vulnerabilities
}

async function handleScanFailed(payload: HarborWebhookPayload) {
  const repo = payload.event_data.repository?.repo_full_name
  const tag = payload.event_data.resources?.[0]?.tag
  
  console.error(`Security scan failed: ${repo}:${tag}`)
  
  // Alert about scan failure
  // TODO: Send alert about scan failure
}

async function handleQuotaExceed(payload: HarborWebhookPayload) {
  console.error('Harbor storage quota exceeded!')
  
  // Alert about quota issue
  // TODO: Send critical alert about quota
}

async function storeWebhookEvent(event: any) {
  // TODO: Store in database for audit and monitoring
  console.log('Storing webhook event:', event.source, event.event)
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
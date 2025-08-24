import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

interface GiteaWebhookPayload {
  action?: string
  repository?: {
    name: string
    full_name: string
    owner: {
      username: string
    }
  }
  pusher?: {
    username: string
  }
  sender?: {
    username: string
  }
  pull_request?: {
    id: number
    state: string
    title: string
  }
  issue?: {
    id: number
    state: string
    title: string
  }
  release?: {
    tag_name: string
    name: string
  }
  ref?: string
  commits?: Array<{
    id: string
    message: string
    author: {
      name: string
      email: string
    }
  }>
}

function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const expectedSignature = hmac.digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('X-Gitea-Signature')
    const event = request.headers.get('X-Gitea-Event')
    const deliveryId = request.headers.get('X-Gitea-Delivery')
    
    // Verify webhook signature
    const webhookSecret = process.env.WEBHOOK_SECRET || ''
    if (webhookSecret && !verifyWebhookSignature(body, signature, webhookSecret)) {
      console.error('Invalid Gitea webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
    
    const payload: GiteaWebhookPayload = JSON.parse(body)
    
    console.log(`Processing Gitea webhook: ${event} (delivery: ${deliveryId})`)
    
    // Process different event types
    switch (event) {
      case 'push':
        await handlePushEvent(payload)
        break
      
      case 'pull_request':
        await handlePullRequestEvent(payload)
        break
      
      case 'issues':
        await handleIssueEvent(payload)
        break
      
      case 'release':
        await handleReleaseEvent(payload)
        break
      
      default:
        console.log(`Unhandled Gitea event type: ${event}`)
    }
    
    // Store webhook event for monitoring
    await storeWebhookEvent({
      source: 'gitea',
      event: event || 'unknown',
      deliveryId: deliveryId || '',
      payload,
      timestamp: new Date()
    })
    
    return NextResponse.json({
      success: true,
      event,
      deliveryId
    })
  } catch (error) {
    console.error('Error processing Gitea webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handlePushEvent(payload: GiteaWebhookPayload) {
  const repo = payload.repository?.full_name
  const branch = payload.ref?.replace('refs/heads/', '')
  const pusher = payload.pusher?.username
  const commits = payload.commits?.length || 0
  
  console.log(`Push to ${repo}/${branch} by ${pusher} (${commits} commits)`)
  
  // Trigger CI/CD pipeline if needed
  if (branch === 'main' || branch === 'master') {
    // TODO: Trigger deployment pipeline
    console.log('Triggering deployment pipeline...')
  }
}

async function handlePullRequestEvent(payload: GiteaWebhookPayload) {
  const pr = payload.pull_request
  const action = payload.action
  const repo = payload.repository?.full_name
  
  console.log(`PR ${action} in ${repo}: #${pr?.id} - ${pr?.title}`)
  
  // Update PR status in monitoring dashboard
  // TODO: Update application PR status
}

async function handleIssueEvent(payload: GiteaWebhookPayload) {
  const issue = payload.issue
  const action = payload.action
  const repo = payload.repository?.full_name
  
  console.log(`Issue ${action} in ${repo}: #${issue?.id} - ${issue?.title}`)
  
  // Track issue metrics
  // TODO: Update issue metrics
}

async function handleReleaseEvent(payload: GiteaWebhookPayload) {
  const release = payload.release
  const repo = payload.repository?.full_name
  
  console.log(`New release in ${repo}: ${release?.tag_name} - ${release?.name}`)
  
  // Trigger production deployment
  // TODO: Trigger production deployment pipeline
}

async function storeWebhookEvent(event: any) {
  // TODO: Store in database for audit and monitoring
  console.log('Storing webhook event:', event.source, event.event)
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Gitea Webhook Handler',
    status: 'active',
    supportedEvents: [
      'push',
      'pull_request',
      'issues',
      'issue_comment',
      'release',
      'create',
      'delete'
    ]
  })
}
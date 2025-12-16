import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { commitTracker } from '@/lib/pipeline/commit-tracker'

interface GiteaCommit {
  id: string
  message: string
  url?: string
  author: {
    name: string
    email: string
  }
  timestamp?: string
}

interface GiteaWebhookPayload {
  action?: string
  repository?: {
    name: string
    full_name: string
    html_url?: string
    owner: {
      username: string
      avatar_url?: string
    }
  }
  pusher?: {
    username: string
    avatar_url?: string
  }
  sender?: {
    username: string
    avatar_url?: string
  }
  pull_request?: {
    id: number
    state: string
    title: string
    head?: {
      sha: string
      ref: string
    }
    base?: {
      ref: string
    }
  }
  issue?: {
    id: number
    state: string
    title: string
  }
  release?: {
    tag_name: string
    name: string
    body?: string
    author?: {
      username: string
    }
    target_commitish?: string
  }
  ref?: string
  before?: string
  after?: string
  commits?: GiteaCommit[]
  head_commit?: GiteaCommit
  workflow_run?: {
    id: number
    name: string
    head_sha: string
    head_branch: string
    status: string
    conclusion?: string
    event: string
    actor?: {
      login: string
    }
    created_at?: string
    updated_at?: string
  }
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
    
    // Store webhook event first
    const webhookEventId = await commitTracker.storeWebhookEvent(
      'gitea',
      event || 'unknown',
      payload,
      payload.repository?.full_name,
      signature || undefined
    )
    
    try {
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

        case 'workflow_run':
          await handleWorkflowRunEvent(payload)
          break
        
        default:
          console.log(`Unhandled Gitea event type: ${event}`)
      }
      
      // Mark webhook as processed
      await commitTracker.markWebhookProcessed(webhookEventId)
      
    } catch (error) {
      // Mark webhook with error
      await commitTracker.markWebhookProcessed(webhookEventId, String(error))
      throw error
    }
    
    return NextResponse.json({
      success: true,
      event,
      deliveryId,
      webhookEventId
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
  const commits = payload.commits || []
  
  console.log(`Push to ${repo}/${branch} by ${pusher} (${commits.length} commits)`)
  
  if (!repo || !branch) return
  
  // Record each commit
  for (const commit of commits) {
    await commitTracker.recordCommit({
      sha: commit.id,
      shortSha: commit.id.substring(0, 7),
      message: commit.message.split('\n')[0], // First line only
      author: commit.author.name,
      authorEmail: commit.author.email,
      authorAvatar: payload.pusher?.avatar_url,
      branch,
      repository: repo,
      timestamp: commit.timestamp || new Date().toISOString(),
      url: commit.url || `${payload.repository?.html_url}/commit/${commit.id}`,
    })
    
    // Create a pending pipeline run for main/master branch
    if (branch === 'main' || branch === 'master') {
      await commitTracker.recordPipelineRun({
        id: `gitea-push-${commit.id.substring(0, 7)}-${Date.now()}`,
        commitSha: commit.id,
        repository: repo,
        workflowName: 'CI/CD Pipeline',
        status: 'pending',
        branch,
        event: 'push',
        triggeredBy: pusher,
        startedAt: new Date().toISOString(),
      })
    }
  }
  
  // Record head commit separately if not in commits array
  if (payload.head_commit && !commits.find(c => c.id === payload.head_commit?.id)) {
    await commitTracker.recordCommit({
      sha: payload.head_commit.id,
      shortSha: payload.head_commit.id.substring(0, 7),
      message: payload.head_commit.message.split('\n')[0],
      author: payload.head_commit.author.name,
      authorEmail: payload.head_commit.author.email,
      authorAvatar: payload.pusher?.avatar_url,
      branch,
      repository: repo,
      timestamp: payload.head_commit.timestamp || new Date().toISOString(),
      url: payload.head_commit.url || `${payload.repository?.html_url}/commit/${payload.head_commit.id}`,
    })
  }
}

async function handlePullRequestEvent(payload: GiteaWebhookPayload) {
  const pr = payload.pull_request
  const action = payload.action
  const repo = payload.repository?.full_name
  
  console.log(`PR ${action} in ${repo}: #${pr?.id} - ${pr?.title}`)
  
  if (!repo || !pr) return
  
  // Record the PR head commit if available
  if (pr.head?.sha) {
    await commitTracker.recordCommit({
      sha: pr.head.sha,
      shortSha: pr.head.sha.substring(0, 7),
      message: `PR #${pr.id}: ${pr.title}`,
      author: payload.sender?.username || 'Unknown',
      authorAvatar: payload.sender?.avatar_url,
      branch: pr.head.ref,
      repository: repo,
      timestamp: new Date().toISOString(),
    })
    
    // Record pipeline for PR
    if (action === 'opened' || action === 'synchronize') {
      await commitTracker.recordPipelineRun({
        id: `gitea-pr-${pr.id}-${Date.now()}`,
        commitSha: pr.head.sha,
        repository: repo,
        workflowName: 'PR Build',
        status: 'pending',
        branch: pr.head.ref,
        event: 'pull_request',
        triggeredBy: payload.sender?.username,
        startedAt: new Date().toISOString(),
      })
    }
  }
}

async function handleIssueEvent(payload: GiteaWebhookPayload) {
  const issue = payload.issue
  const action = payload.action
  const repo = payload.repository?.full_name
  
  console.log(`Issue ${action} in ${repo}: #${issue?.id} - ${issue?.title}`)
  
  // Issues don't directly affect pipeline, just log for now
}

async function handleReleaseEvent(payload: GiteaWebhookPayload) {
  const release = payload.release
  const repo = payload.repository?.full_name
  
  console.log(`New release in ${repo}: ${release?.tag_name} - ${release?.name}`)
  
  if (!repo || !release) return
  
  // Record release commit if available
  if (release.target_commitish) {
    // Create a deployment event for production
    await commitTracker.recordDeployment({
      id: `release-${release.tag_name}-${Date.now()}`,
      commitSha: release.target_commitish,
      repository: repo,
      environment: 'production',
      namespace: repo.split('/')[1] || 'default',
      deploymentName: repo.split('/')[1] || 'app',
      status: 'pending',
      imageTag: release.tag_name,
      deployedBy: release.author?.username,
    })
  }
}

async function handleWorkflowRunEvent(payload: GiteaWebhookPayload) {
  const workflowRun = payload.workflow_run
  const repo = payload.repository?.full_name
  
  if (!workflowRun || !repo) return
  
  console.log(`Workflow run ${workflowRun.status} for ${repo}: ${workflowRun.name}`)
  
  // Map Gitea workflow status to our status
  let status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled' = 'pending'
  if (workflowRun.status === 'in_progress') {
    status = 'running'
  } else if (workflowRun.status === 'completed') {
    switch (workflowRun.conclusion) {
      case 'success':
        status = 'success'
        break
      case 'failure':
        status = 'failure'
        break
      case 'cancelled':
        status = 'cancelled'
        break
      default:
        status = 'failure'
    }
  }
  
  // Record or update pipeline run
  const pipelineId = `gitea-workflow-${workflowRun.id}`
  
  if (payload.action === 'created' || payload.action === 'requested') {
    await commitTracker.recordPipelineRun({
      id: pipelineId,
      commitSha: workflowRun.head_sha,
      repository: repo,
      workflowName: workflowRun.name,
      status,
      conclusion: workflowRun.conclusion,
      branch: workflowRun.head_branch,
      event: workflowRun.event,
      triggeredBy: workflowRun.actor?.login,
      startedAt: workflowRun.created_at,
      url: `${payload.repository?.html_url}/actions/runs/${workflowRun.id}`,
    })
  } else if (payload.action === 'completed') {
    await commitTracker.updatePipelineStatus(
      pipelineId,
      status,
      workflowRun.conclusion,
      workflowRun.updated_at
    )
    
    // If workflow succeeded on main/master, create staging deployment
    if (status === 'success' && 
        (workflowRun.head_branch === 'main' || workflowRun.head_branch === 'master')) {
      await commitTracker.recordDeployment({
        id: `auto-staging-${workflowRun.head_sha.substring(0, 7)}-${Date.now()}`,
        commitSha: workflowRun.head_sha,
        repository: repo,
        environment: 'staging',
        namespace: `${repo.split('/')[1]}-staging`,
        deploymentName: repo.split('/')[1] || 'app',
        status: 'pending',
        imageTag: `sha-${workflowRun.head_sha.substring(0, 7)}`,
        deployedBy: workflowRun.actor?.login,
      })
    }
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Gitea Webhook Handler',
    status: 'active',
    supportedEvents: [
      'push',
      'pull_request',
      'issues',
      'release',
      'workflow_run',
      'create',
      'delete'
    ],
    features: [
      'Commit tracking',
      'Pipeline run tracking',
      'Deployment tracking',
      'Webhook event storage'
    ]
  })
}

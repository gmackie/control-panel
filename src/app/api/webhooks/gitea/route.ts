import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { 
  applicationsRepo, 
  commitsRepo, 
  deploymentsRepo, 
  webhooksRepo 
} from '@/lib/db/repositories'

// Lazy import commitTracker to avoid module-level errors from libsql
let commitTrackerModule: typeof import('@/lib/pipeline/commit-tracker') | null = null
async function getCommitTracker() {
  if (!commitTrackerModule) {
    try {
      commitTrackerModule = await import('@/lib/pipeline/commit-tracker')
    } catch (err) {
      console.warn('Failed to load commitTracker module:', err)
      return null
    }
  }
  return commitTrackerModule?.commitTracker
}

// Type for the commit tracker
type CommitTrackerType = Awaited<ReturnType<typeof getCommitTracker>>

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
    
    // Look up application by repository
    const repoFullName = payload.repository?.full_name
    let applicationId: string | undefined
    
    if (repoFullName) {
      try {
        const app = await applicationsRepo.getByRepository(repoFullName)
        applicationId = app?.id
      } catch (err) {
        console.warn('Could not look up application for repository:', repoFullName, err)
      }
    }
    
    // Store webhook event in PostgreSQL first
    let pgWebhookEventId: string | undefined
    try {
      pgWebhookEventId = await webhooksRepo.storeWebhookEvent({
        source: 'gitea',
        eventType: event || 'unknown',
        applicationId,
        payload: payload as Record<string, unknown>,
        signature: signature || undefined,
      })
    } catch (err) {
      console.warn('Failed to store webhook in PostgreSQL:', err)
    }
    
    // Also store in Turso for backward compatibility (optional - may fail if libsql not available)
    let webhookEventId: string | undefined
    const commitTracker = await getCommitTracker()
    if (commitTracker) {
      try {
        webhookEventId = await commitTracker.storeWebhookEvent(
          'gitea',
          event || 'unknown',
          payload,
          payload.repository?.full_name,
          signature || undefined
        )
      } catch (err) {
        console.warn('Failed to store webhook in Turso:', err)
      }
    }
    
    try {
      // Process different event types
      switch (event) {
        case 'push':
          await handlePushEvent(payload, applicationId, commitTracker)
          break
        
        case 'pull_request':
          await handlePullRequestEvent(payload, applicationId, commitTracker)
          break
        
        case 'issues':
          await handleIssueEvent(payload)
          break
        
        case 'release':
          await handleReleaseEvent(payload, applicationId, commitTracker)
          break

        case 'workflow_run':
          await handleWorkflowRunEvent(payload, applicationId, commitTracker)
          break
        
        default:
          console.log(`Unhandled Gitea event type: ${event}`)
      }
      
      // Mark webhook as processed in both databases
      if (webhookEventId && commitTracker) {
        try {
          await commitTracker.markWebhookProcessed(webhookEventId)
        } catch (err) {
          console.warn('Failed to mark Turso webhook as processed:', err)
        }
      }
      if (pgWebhookEventId) {
        try {
          await webhooksRepo.markWebhookProcessed(pgWebhookEventId)
        } catch (err) {
          console.warn('Failed to mark PostgreSQL webhook as processed:', err)
        }
      }
      
    } catch (error) {
      // Mark webhook with error
      if (webhookEventId && commitTracker) {
        try {
          await commitTracker.markWebhookProcessed(webhookEventId, String(error))
        } catch (err) {
          console.warn('Failed to mark Turso webhook error:', err)
        }
      }
      if (pgWebhookEventId) {
        try {
          await webhooksRepo.markWebhookProcessed(pgWebhookEventId, String(error))
        } catch (err) {
          console.warn('Failed to mark PostgreSQL webhook error:', err)
        }
      }
      throw error
    }
    
    return NextResponse.json({
      success: true,
      event,
      deliveryId,
      webhookEventId,
      pgWebhookEventId,
    })
  } catch (error) {
    console.error('Error processing Gitea webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handlePushEvent(payload: GiteaWebhookPayload, applicationId?: string, commitTracker?: CommitTrackerType) {
  const repo = payload.repository?.full_name
  const branch = payload.ref?.replace('refs/heads/', '')
  const pusher = payload.pusher?.username
  const commits = payload.commits || []
  
  console.log(`Push to ${repo}/${branch} by ${pusher} (${commits.length} commits)`)
  
  if (!repo || !branch) return
  
  // Record each commit
  for (const commit of commits) {
    // Record in Turso (backward compatibility - optional)
    if (commitTracker) {
      try {
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
      } catch (err) {
        console.warn('Failed to record commit in Turso:', err)
      }
    }
    
    // Record in PostgreSQL if applicationId is known
    if (applicationId) {
      try {
        await commitsRepo.create({
          applicationId,
          sha: commit.id,
          shortSha: commit.id.substring(0, 7),
          message: commit.message.split('\n')[0],
          authorName: commit.author.name,
          authorEmail: commit.author.email,
          authorAvatar: payload.pusher?.avatar_url,
          branch,
          repository: repo,
          committedAt: new Date(commit.timestamp || Date.now()),
          url: commit.url || `${payload.repository?.html_url}/commit/${commit.id}`,
        })
      } catch (err) {
        console.warn('Failed to record commit in PostgreSQL:', err)
      }
    }
    
    // Create a pending pipeline run for main/master branch
    if (branch === 'main' || branch === 'master') {
      if (commitTracker) {
        try {
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
        } catch (err) {
          console.warn('Failed to record pipeline run in Turso:', err)
        }
      }
      
      // Also record in PostgreSQL
      if (applicationId) {
        try {
          await deploymentsRepo.createPipelineRun({
            applicationId,
            workflowName: 'CI/CD Pipeline',
            status: 'pending',
            branch,
            event: 'push',
            triggeredBy: pusher,
            startedAt: new Date(),
          })
        } catch (err) {
          console.warn('Failed to record pipeline run in PostgreSQL:', err)
        }
      }
    }
  }
  
  // Record head commit separately if not in commits array
  if (payload.head_commit && !commits.find(c => c.id === payload.head_commit?.id)) {
    if (commitTracker) {
      try {
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
      } catch (err) {
        console.warn('Failed to record head commit in Turso:', err)
      }
    }
    
    // Record in PostgreSQL
    if (applicationId) {
      try {
        await commitsRepo.create({
          applicationId,
          sha: payload.head_commit.id,
          shortSha: payload.head_commit.id.substring(0, 7),
          message: payload.head_commit.message.split('\n')[0],
          authorName: payload.head_commit.author.name,
          authorEmail: payload.head_commit.author.email,
          authorAvatar: payload.pusher?.avatar_url,
          branch,
          repository: repo,
          committedAt: new Date(payload.head_commit.timestamp || Date.now()),
          url: payload.head_commit.url || `${payload.repository?.html_url}/commit/${payload.head_commit.id}`,
        })
      } catch (err) {
        console.warn('Failed to record head commit in PostgreSQL:', err)
      }
    }
  }
}

async function handlePullRequestEvent(payload: GiteaWebhookPayload, applicationId?: string, commitTracker?: CommitTrackerType) {
  const pr = payload.pull_request
  const action = payload.action
  const repo = payload.repository?.full_name
  
  console.log(`PR ${action} in ${repo}: #${pr?.id} - ${pr?.title}`)
  
  if (!repo || !pr) return
  
  // Record the PR head commit if available
  if (pr.head?.sha) {
    if (commitTracker) {
      try {
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
      } catch (err) {
        console.warn('Failed to record PR commit in Turso:', err)
      }
    }
    
    // Record in PostgreSQL
    if (applicationId) {
      try {
        await commitsRepo.create({
          applicationId,
          sha: pr.head.sha,
          shortSha: pr.head.sha.substring(0, 7),
          message: `PR #${pr.id}: ${pr.title}`,
          authorName: payload.sender?.username || 'Unknown',
          authorAvatar: payload.sender?.avatar_url,
          branch: pr.head.ref || 'unknown',
          repository: repo,
          committedAt: new Date(),
        })
      } catch (err) {
        console.warn('Failed to record PR commit in PostgreSQL:', err)
      }
    }
    
    // Record pipeline for PR
    if (action === 'opened' || action === 'synchronize') {
      if (commitTracker) {
        try {
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
        } catch (err) {
          console.warn('Failed to record PR pipeline in Turso:', err)
        }
      }
      
      // Record in PostgreSQL
      if (applicationId) {
        try {
          await deploymentsRepo.createPipelineRun({
            applicationId,
            workflowName: 'PR Build',
            status: 'pending',
            branch: pr.head.ref || 'unknown',
            event: 'pull_request',
            triggeredBy: payload.sender?.username,
            startedAt: new Date(),
          })
        } catch (err) {
          console.warn('Failed to record PR pipeline in PostgreSQL:', err)
        }
      }
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

async function handleReleaseEvent(payload: GiteaWebhookPayload, applicationId?: string, commitTracker?: CommitTrackerType) {
  const release = payload.release
  const repo = payload.repository?.full_name
  
  console.log(`New release in ${repo}: ${release?.tag_name} - ${release?.name}`)
  
  if (!repo || !release) return
  
  // Record release in PostgreSQL
  if (applicationId && release.target_commitish) {
    try {
      await commitsRepo.createRelease({
        applicationId,
        tagName: release.tag_name,
        name: release.name || release.tag_name,
        body: release.body,
        commitSha: release.target_commitish,
        author: release.author?.username || 'unknown',
        publishedAt: new Date(),
      })
    } catch (err) {
      console.warn('Failed to record release in PostgreSQL:', err)
    }
  }
  
  // Record release commit if available
  if (release.target_commitish) {
    // Create a deployment event for production in Turso
    if (commitTracker) {
      try {
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
      } catch (err) {
        console.warn('Failed to record release deployment in Turso:', err)
      }
    }
    
    // Create deployment in PostgreSQL
    if (applicationId) {
      try {
        await deploymentsRepo.create({
          applicationId,
          environment: 'production',
          namespace: repo.split('/')[1] || 'default',
          deploymentName: repo.split('/')[1] || 'app',
          status: 'pending',
          imageTag: release.tag_name,
          deployedBy: release.author?.username,
        })
      } catch (err) {
        console.warn('Failed to record deployment in PostgreSQL:', err)
      }
    }
  }
}

async function handleWorkflowRunEvent(payload: GiteaWebhookPayload, applicationId?: string, commitTracker?: CommitTrackerType) {
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
    if (commitTracker) {
      try {
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
      } catch (err) {
        console.warn('Failed to record pipeline run in Turso:', err)
      }
    }
    
    // Record in PostgreSQL
    if (applicationId) {
      try {
        await deploymentsRepo.createPipelineRun({
          applicationId,
          workflowName: workflowRun.name,
          workflowId: workflowRun.id,
          status,
          conclusion: workflowRun.conclusion,
          branch: workflowRun.head_branch,
          event: workflowRun.event,
          triggeredBy: workflowRun.actor?.login,
          startedAt: workflowRun.created_at ? new Date(workflowRun.created_at) : new Date(),
          url: `${payload.repository?.html_url}/actions/runs/${workflowRun.id}`,
        })
      } catch (err) {
        console.warn('Failed to record workflow run in PostgreSQL:', err)
      }
    }
  } else if (payload.action === 'completed') {
    if (commitTracker) {
      try {
        await commitTracker.updatePipelineStatus(
          pipelineId,
          status,
          workflowRun.conclusion,
          workflowRun.updated_at
        )
      } catch (err) {
        console.warn('Failed to update pipeline status in Turso:', err)
      }
    }
    
    // Calculate duration
    let duration: number | undefined
    if (workflowRun.created_at && workflowRun.updated_at) {
      duration = Math.floor(
        (new Date(workflowRun.updated_at).getTime() - new Date(workflowRun.created_at).getTime()) / 1000
      )
    }
    
    // If workflow succeeded on main/master, create staging deployment
    if (status === 'success' && 
        (workflowRun.head_branch === 'main' || workflowRun.head_branch === 'master')) {
      if (commitTracker) {
        try {
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
        } catch (err) {
          console.warn('Failed to record staging deployment in Turso:', err)
        }
      }
      
      // Create staging deployment in PostgreSQL
      if (applicationId) {
        try {
          await deploymentsRepo.create({
            applicationId,
            environment: 'staging',
            namespace: `${repo.split('/')[1]}-staging`,
            deploymentName: repo.split('/')[1] || 'app',
            status: 'pending',
            imageTag: `sha-${workflowRun.head_sha.substring(0, 7)}`,
            deployedBy: workflowRun.actor?.login,
          })
        } catch (err) {
          console.warn('Failed to record staging deployment in PostgreSQL:', err)
        }
      }
    }
    
    // Log activity for workflow completion
    if (applicationId) {
      try {
        await commitsRepo.logActivity({
          applicationId,
          type: 'pipeline',
          action: 'completed',
          message: `Workflow "${workflowRun.name}" ${status} on ${workflowRun.head_branch}`,
          actor: workflowRun.actor?.login,
          metadata: {
            workflowId: workflowRun.id,
            status,
            conclusion: workflowRun.conclusion,
            branch: workflowRun.head_branch,
            duration,
          },
        })
      } catch (err) {
        console.warn('Failed to log activity in PostgreSQL:', err)
      }
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

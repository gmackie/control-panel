import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { handleAsyncRoute, ValidationError, AuthenticationError } from '@/lib/api-errors';
import { webhookLimiter, withRateLimit } from '@/lib/rate-limiter';

interface DeploymentWebhookPayload {
  source: 'drone' | 'argocd' | 'harbor' | 'gitea' | 'github';
  event: string;
  timestamp: string;
  repository?: {
    name: string;
    full_name: string;
    clone_url: string;
    html_url: string;
    default_branch: string;
  };
  commit?: {
    sha: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    url: string;
  };
  build?: {
    id: number;
    number: number;
    status: 'pending' | 'running' | 'success' | 'failure' | 'error' | 'killed';
    started_at: string;
    finished_at?: string;
    trigger: string;
    target: string;
    stages?: Array<{
      name: string;
      status: string;
      started_at: string;
      finished_at?: string;
      steps: Array<{
        name: string;
        status: string;
        started_at: string;
        finished_at?: string;
      }>;
    }>;
  };
  application?: {
    name: string;
    namespace: string;
    server: string;
    sync: {
      status: 'Synced' | 'OutOfSync' | 'Unknown';
      health: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
      revision: string;
    };
    operation?: {
      sync: {
        revision: string;
        prune: boolean;
        dryRun: boolean;
        syncStrategy: string;
      };
    };
  };
  artifact?: {
    repository: string;
    tag: string;
    digest: string;
    size: number;
    push_time: string;
    pull_time?: string;
    vulnerabilities?: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
}

interface WebhookResponse {
  success: boolean;
  message: string;
  timestamp: string;
  processed_events: string[];
  actions_taken: string[];
  errors?: string[];
}

// Validate webhook signatures
function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  // In a real implementation, this would validate HMAC signatures
  // For now, we'll do basic validation
  return signature && secret && signature.length > 0;
}

// Process different webhook sources
async function processDroneWebhook(payload: DeploymentWebhookPayload): Promise<Partial<WebhookResponse>> {
  const actions: string[] = [];
  const events: string[] = [];

  if (payload.event === 'build' && payload.build) {
    events.push(`drone_build_${payload.build.status}`);
    
    switch (payload.build.status) {
      case 'success':
        actions.push('trigger_argocd_sync');
        actions.push('update_deployment_status');
        actions.push('send_success_notification');
        break;
        
      case 'failure':
        actions.push('send_failure_notification');
        actions.push('create_incident_ticket');
        break;
        
      case 'running':
        actions.push('update_build_progress');
        break;
    }
  }

  return {
    processed_events: events,
    actions_taken: actions
  };
}

async function processArgoCDWebhook(payload: DeploymentWebhookPayload): Promise<Partial<WebhookResponse>> {
  const actions: string[] = [];
  const events: string[] = [];

  if (payload.application) {
    events.push(`argocd_${payload.event}`);
    
    if (payload.application.sync.status === 'OutOfSync') {
      actions.push('trigger_sync_operation');
      actions.push('send_out_of_sync_alert');
    }
    
    if (payload.application.sync.health === 'Degraded') {
      actions.push('send_health_alert');
      actions.push('trigger_rollback_check');
    }
    
    if (payload.application.sync.status === 'Synced' && payload.application.sync.health === 'Healthy') {
      actions.push('update_deployment_success');
      actions.push('send_deployment_notification');
    }
  }

  return {
    processed_events: events,
    actions_taken: actions
  };
}

async function processHarborWebhook(payload: DeploymentWebhookPayload): Promise<Partial<WebhookResponse>> {
  const actions: string[] = [];
  const events: string[] = [];

  if (payload.event === 'PUSH_ARTIFACT' && payload.artifact) {
    events.push('harbor_image_pushed');
    actions.push('trigger_vulnerability_scan');
    actions.push('update_image_registry');
    
    // Auto-deploy to staging if it's a main branch build
    if (payload.artifact.tag === 'latest' || payload.artifact.tag.includes('main')) {
      actions.push('trigger_staging_deployment');
    }
  }
  
  if (payload.event === 'SCANNING_COMPLETED' && payload.artifact?.vulnerabilities) {
    events.push('harbor_scan_completed');
    const vulns = payload.artifact.vulnerabilities;
    
    if (vulns.critical > 0) {
      actions.push('block_deployment');
      actions.push('send_critical_vulnerability_alert');
    } else if (vulns.high > 5) {
      actions.push('require_approval_for_deployment');
      actions.push('send_vulnerability_warning');
    } else {
      actions.push('approve_for_deployment');
    }
  }

  return {
    processed_events: events,
    actions_taken: actions
  };
}

async function processGiteaWebhook(payload: DeploymentWebhookPayload): Promise<Partial<WebhookResponse>> {
  const actions: string[] = [];
  const events: string[] = [];

  if (payload.event === 'push') {
    events.push('gitea_push');
    actions.push('trigger_ci_build');
    
    // Auto-deploy feature branches to preview environments
    if (payload.commit && payload.repository?.default_branch !== 'main') {
      actions.push('create_preview_environment');
    }
  }
  
  if (payload.event === 'pull_request') {
    events.push('gitea_pull_request');
    actions.push('trigger_pr_checks');
    actions.push('create_review_environment');
  }

  return {
    processed_events: events,
    actions_taken: actions
  };
}

// Execute webhook actions
async function executeActions(actions: string[], payload: DeploymentWebhookPayload): Promise<string[]> {
  const executed: string[] = [];
  
  for (const action of actions) {
    try {
      switch (action) {
        case 'trigger_argocd_sync':
          // In real implementation: call ArgoCD API to trigger sync
          console.log('Triggering ArgoCD sync for', payload.repository?.name);
          executed.push(action);
          break;
          
        case 'send_success_notification':
          // In real implementation: send to Slack, email, etc.
          console.log('Sending success notification for deployment');
          executed.push(action);
          break;
          
        case 'send_failure_notification':
          // In real implementation: send alert notifications
          console.log('Sending failure notification');
          executed.push(action);
          break;
          
        case 'trigger_vulnerability_scan':
          // In real implementation: trigger Harbor vulnerability scan
          console.log('Triggering vulnerability scan for', payload.artifact?.repository);
          executed.push(action);
          break;
          
        case 'create_preview_environment':
          // In real implementation: create Kubernetes namespace and deploy
          console.log('Creating preview environment for branch');
          executed.push(action);
          break;
          
        case 'update_deployment_status':
          // In real implementation: update database with deployment status
          console.log('Updating deployment status in database');
          executed.push(action);
          break;
          
        case 'block_deployment':
          // In real implementation: prevent deployment due to security issues
          console.log('Blocking deployment due to critical vulnerabilities');
          executed.push(action);
          break;
          
        default:
          console.log(`Action ${action} not implemented yet`);
      }
    } catch (error) {
      console.error(`Failed to execute action ${action}:`, error);
    }
  }
  
  return executed;
}

export const POST = withRateLimit(webhookLimiter)(handleAsyncRoute(async (request: NextRequest) => {
    const headersList = headers();
    const signature = headersList.get('x-webhook-signature') || headersList.get('x-hub-signature-256');
    const source = headersList.get('x-webhook-source') as 'drone' | 'argocd' | 'harbor' | 'gitea';
    const event = headersList.get('x-webhook-event') || '';
    
    const body = await request.text();
    let payload: DeploymentWebhookPayload;
    
    try {
      payload = JSON.parse(body);
    } catch (error) {
      throw new ValidationError('Invalid JSON payload');
    }

    // Validate webhook signature (in production)
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValid = validateWebhookSignature(body, signature, webhookSecret);
      if (!isValid) {
        throw new AuthenticationError('Invalid webhook signature');
      }
    }

    // Ensure required fields
    if (!payload.source) {
      payload.source = source || 'gitea';
    }
    if (!payload.event) {
      payload.event = event;
    }
    if (!payload.timestamp) {
      payload.timestamp = new Date().toISOString();
    }

    let result: Partial<WebhookResponse> = {
      processed_events: [],
      actions_taken: []
    };

    // Process webhook based on source
    switch (payload.source) {
      case 'drone':
        result = await processDroneWebhook(payload);
        break;
        
      case 'argocd':
        result = await processArgoCDWebhook(payload);
        break;
        
      case 'harbor':
        result = await processHarborWebhook(payload);
        break;
        
      case 'gitea':
        result = await processGiteaWebhook(payload);
        break;
        
      default:
        throw new ValidationError(`Unsupported webhook source: ${payload.source}`);
    }

    // Execute the determined actions
    const executedActions = await executeActions(result.actions_taken || [], payload);

    const response: WebhookResponse = {
      success: true,
      message: `Webhook processed successfully from ${payload.source}`,
      timestamp: new Date().toISOString(),
      processed_events: result.processed_events || [],
      actions_taken: executedActions
    };

    // Log webhook for debugging and audit
    console.log('Webhook processed:', {
      source: payload.source,
      event: payload.event,
      actions: executedActions,
      timestamp: response.timestamp
    });

    // In a real implementation, you would also:
    // 1. Store webhook data in database
    // 2. Trigger real-time updates via SSE
    // 3. Update deployment status in UI
    // 4. Send notifications to configured channels
    // 5. Update monitoring dashboards
    // 6. Create audit logs

  return NextResponse.json(response);
}));

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-webhook-signature, x-webhook-source, x-webhook-event',
    },
  });
}

// GET endpoint for webhook status and configuration
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  
  const webhookInfo = {
    endpoint: '/api/webhooks/deployment',
    supported_sources: ['drone', 'argocd', 'harbor', 'gitea'],
    required_headers: [
      'Content-Type: application/json',
      'x-webhook-source: [drone|argocd|harbor|gitea]',
      'x-webhook-event: [event-name]',
      'x-webhook-signature: [signature] (optional)'
    ],
    supported_events: {
      drone: ['build'],
      argocd: ['app-sync-succeeded', 'app-sync-failed', 'app-health-degraded'],
      harbor: ['PUSH_ARTIFACT', 'SCANNING_COMPLETED', 'PULL_ARTIFACT'],
      gitea: ['push', 'pull_request', 'create', 'delete']
    },
    actions: [
      'trigger_argocd_sync',
      'send_success_notification',
      'send_failure_notification',
      'trigger_vulnerability_scan',
      'create_preview_environment',
      'update_deployment_status',
      'block_deployment',
      'create_incident_ticket',
      'trigger_rollback_check'
    ]
  };

  if (source && webhookInfo.supported_sources.includes(source)) {
    return NextResponse.json({
      source,
      events: webhookInfo.supported_events[source as keyof typeof webhookInfo.supported_events],
      example_payload: `Example payload for ${source} webhook`,
      webhook_url: `${process.env.NEXTAUTH_URL}/api/webhooks/deployment`
    });
  }

  return NextResponse.json(webhookInfo);
}
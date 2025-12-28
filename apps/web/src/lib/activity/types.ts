/**
 * Activity Feed Types
 * 
 * Core types for the real-time activity feed system
 */

// Event sources
export type ActivitySource = 
  | 'gitea' 
  | 'clerk' 
  | 'stripe' 
  | 'sentry' 
  | 'posthog' 
  | 'kubernetes' 
  | 'neon'
  | 'system';

// Event categories
export type ActivityCategory = 
  | 'deployment' 
  | 'auth' 
  | 'payment' 
  | 'error' 
  | 'infrastructure' 
  | 'integration' 
  | 'security'
  | 'repository';

// Severity levels
export type ActivitySeverity = 'info' | 'warning' | 'error' | 'critical';

// Actor types
export type ActorType = 'user' | 'system' | 'webhook' | 'automation';

/**
 * Actor - who/what triggered the event
 */
export interface ActivityActor {
  type: ActorType;
  id?: string;
  name?: string;
  email?: string;
  avatar?: string;
}

/**
 * Link - related URLs for the event
 */
export interface ActivityLink {
  label: string;
  url: string;
  external?: boolean;
}

/**
 * Activity Event - the core event structure
 */
export interface ActivityEvent {
  id: string;
  timestamp: Date;
  
  // Source identification
  source: ActivitySource;
  
  // Event classification
  category: ActivityCategory;
  eventType: string;           // e.g., "deployment.completed", "user.created"
  severity: ActivitySeverity;
  
  // Context
  appId?: string;
  appName?: string;
  environment?: string;
  
  // Content
  title: string;
  description?: string;
  actor?: ActivityActor;
  
  // Links and actions
  links?: ActivityLink[];
  
  // Raw data for drilling down
  metadata?: Record<string, unknown>;
}

/**
 * Activity Event for database insertion (without id/timestamp)
 */
export interface CreateActivityEvent {
  source: ActivitySource;
  category: ActivityCategory;
  eventType: string;
  severity: ActivitySeverity;
  
  appId?: string;
  appName?: string;
  environment?: string;
  
  title: string;
  description?: string;
  actor?: ActivityActor;
  links?: ActivityLink[];
  metadata?: Record<string, unknown>;
}

/**
 * Filter options for querying activity events
 */
export interface ActivityFilter {
  sources?: ActivitySource[];
  categories?: ActivityCategory[];
  severities?: ActivitySeverity[];
  appIds?: string[];
  environments?: string[];
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Activity stats for summary display
 */
export interface ActivityStats {
  total: number;
  last24h: number;
  last7d: number;
  byCategory: Record<ActivityCategory, number>;
  bySeverity: Record<ActivitySeverity, number>;
  bySource: Record<ActivitySource, number>;
}

/**
 * Paginated response for activity queries
 */
export interface ActivityQueryResult {
  events: ActivityEvent[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

// ===================================
// Webhook Payload Types
// ===================================

/**
 * Gitea webhook payloads
 */
export interface GiteaPushPayload {
  ref: string;
  before: string;
  after: string;
  compare_url: string;
  commits: Array<{
    id: string;
    message: string;
    url: string;
    author: {
      name: string;
      email: string;
      username: string;
    };
    timestamp: string;
  }>;
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
  };
  pusher: {
    id: number;
    login: string;
    full_name: string;
    email: string;
    avatar_url: string;
  };
  sender: {
    id: number;
    login: string;
    full_name: string;
    avatar_url: string;
  };
}

export interface GiteaPullRequestPayload {
  action: 'opened' | 'closed' | 'reopened' | 'edited' | 'synchronized' | 'merged';
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string;
    state: string;
    html_url: string;
    user: {
      id: number;
      login: string;
      full_name: string;
      avatar_url: string;
    };
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
    merged: boolean;
    merged_by?: {
      id: number;
      login: string;
      full_name: string;
      avatar_url: string;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
  };
  sender: {
    id: number;
    login: string;
    full_name: string;
    avatar_url: string;
  };
}

export interface GiteaWorkflowPayload {
  action: 'completed' | 'requested';
  workflow_run: {
    id: number;
    name: string;
    head_branch: string;
    head_sha: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    created_at: string;
    updated_at: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
  };
  sender: {
    id: number;
    login: string;
    full_name: string;
    avatar_url: string;
  };
}

/**
 * Clerk webhook payloads
 */
export interface ClerkUserPayload {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses: Array<{
      id: string;
      email_address: string;
    }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
    created_at: number;
    updated_at: number;
  };
}

export interface ClerkSessionPayload {
  type: 'session.created' | 'session.ended' | 'session.revoked';
  data: {
    id: string;
    user_id: string;
    status: string;
    created_at: number;
    updated_at: number;
  };
}

/**
 * Stripe webhook payloads
 */
export interface StripePaymentPayload {
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed' | 
        'invoice.paid' | 'invoice.payment_failed' |
        'customer.subscription.created' | 'customer.subscription.updated' | 
        'customer.subscription.deleted';
  data: {
    object: {
      id: string;
      amount?: number;
      currency?: string;
      customer?: string;
      status?: string;
      metadata?: Record<string, string>;
    };
  };
}

/**
 * Sentry webhook payloads
 */
export interface SentryIssuePayload {
  action: 'created' | 'resolved' | 'assigned' | 'ignored';
  data: {
    issue: {
      id: string;
      shortId: string;
      title: string;
      culprit: string;
      level: string;
      status: string;
      platform: string;
      project: {
        id: string;
        name: string;
        slug: string;
      };
      metadata: {
        type?: string;
        value?: string;
        filename?: string;
      };
      count: string;
      userCount: number;
      firstSeen: string;
      lastSeen: string;
    };
  };
  actor?: {
    type: string;
    id?: string;
    name?: string;
  };
}

/**
 * Kubernetes event payloads (from our cluster monitoring)
 */
export interface KubernetesEventPayload {
  type: 'deployment.updated' | 'pod.crashed' | 'pod.started' | 
        'service.created' | 'node.ready' | 'node.notready' |
        'hpa.scaled';
  namespace: string;
  name: string;
  reason?: string;
  message?: string;
  involvedObject?: {
    kind: string;
    name: string;
    namespace: string;
  };
  timestamp: string;
}

/**
 * Neon webhook/event payloads
 */
export interface NeonEventPayload {
  type: 'branch.created' | 'branch.deleted' | 'endpoint.started' | 
        'endpoint.suspended' | 'project.created';
  data: {
    id: string;
    name: string;
    project_id?: string;
    branch_id?: string;
    created_at: string;
  };
}

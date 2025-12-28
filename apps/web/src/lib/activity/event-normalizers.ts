/**
 * Event Normalizers
 * 
 * Transform webhook payloads from various sources into
 * standardized ActivityEvent format.
 */

import {
  CreateActivityEvent,
  GiteaPushPayload,
  GiteaPullRequestPayload,
  GiteaWorkflowPayload,
  ClerkUserPayload,
  ClerkSessionPayload,
  StripePaymentPayload,
  SentryIssuePayload,
  KubernetesEventPayload,
  NeonEventPayload,
} from "./types";

// ===================================
// Gitea Normalizers
// ===================================

export function normalizeGiteaPush(payload: GiteaPushPayload): CreateActivityEvent[] {
  const events: CreateActivityEvent[] = [];
  const branch = payload.ref.replace("refs/heads/", "");
  
  // Create an event for the push itself
  events.push({
    source: "gitea",
    category: "repository",
    eventType: "push",
    severity: "info",
    appName: payload.repository.name,
    title: `Pushed ${payload.commits.length} commit${payload.commits.length !== 1 ? "s" : ""} to ${branch}`,
    description: payload.commits[0]?.message || undefined,
    actor: {
      type: "user",
      id: payload.pusher.id.toString(),
      name: payload.pusher.full_name || payload.pusher.login,
      email: payload.pusher.email,
      avatar: payload.sender.avatar_url,
    },
    links: [
      { label: "Compare", url: payload.compare_url, external: true },
      { label: "Repository", url: payload.repository.html_url, external: true },
    ],
    metadata: {
      repository: payload.repository.full_name,
      branch,
      before: payload.before,
      after: payload.after,
      commitCount: payload.commits.length,
      commits: payload.commits.map(c => ({
        sha: c.id.substring(0, 7),
        message: c.message.split("\n")[0],
        author: c.author.name,
      })),
    },
  });

  return events;
}

export function normalizeGiteaPullRequest(payload: GiteaPullRequestPayload): CreateActivityEvent {
  const pr = payload.pull_request;
  
  let eventType: string;
  let title: string;
  let severity: "info" | "warning" | "error" | "critical" = "info";

  switch (payload.action) {
    case "opened":
      eventType = "pull_request.opened";
      title = `PR #${pr.number} opened: ${pr.title}`;
      break;
    case "closed":
      if (pr.merged) {
        eventType = "pull_request.merged";
        title = `PR #${pr.number} merged: ${pr.title}`;
      } else {
        eventType = "pull_request.closed";
        title = `PR #${pr.number} closed: ${pr.title}`;
      }
      break;
    case "reopened":
      eventType = "pull_request.reopened";
      title = `PR #${pr.number} reopened: ${pr.title}`;
      break;
    case "synchronized":
      eventType = "pull_request.updated";
      title = `PR #${pr.number} updated: ${pr.title}`;
      break;
    default:
      eventType = `pull_request.${payload.action}`;
      title = `PR #${pr.number} ${payload.action}: ${pr.title}`;
  }

  return {
    source: "gitea",
    category: "repository",
    eventType,
    severity,
    appName: payload.repository.name,
    title,
    description: pr.body?.substring(0, 200) || undefined,
    actor: {
      type: "user",
      id: payload.sender.id.toString(),
      name: payload.sender.full_name || payload.sender.login,
      avatar: payload.sender.avatar_url,
    },
    links: [
      { label: `PR #${pr.number}`, url: pr.html_url, external: true },
      { label: "Repository", url: payload.repository.html_url, external: true },
    ],
    metadata: {
      repository: payload.repository.full_name,
      prNumber: pr.number,
      action: payload.action,
      state: pr.state,
      headBranch: pr.head.ref,
      baseBranch: pr.base.ref,
      merged: pr.merged,
      mergedBy: pr.merged_by?.login,
    },
  };
}

export function normalizeGiteaWorkflow(payload: GiteaWorkflowPayload): CreateActivityEvent {
  const run = payload.workflow_run;
  
  let severity: "info" | "warning" | "error" | "critical" = "info";
  let eventType: string;
  let title: string;

  if (payload.action === "completed") {
    eventType = `workflow.${run.conclusion || "completed"}`;
    
    switch (run.conclusion) {
      case "success":
        title = `Workflow "${run.name}" succeeded`;
        severity = "info";
        break;
      case "failure":
        title = `Workflow "${run.name}" failed`;
        severity = "error";
        break;
      case "cancelled":
        title = `Workflow "${run.name}" was cancelled`;
        severity = "warning";
        break;
      default:
        title = `Workflow "${run.name}" completed: ${run.conclusion}`;
    }
  } else {
    eventType = "workflow.started";
    title = `Workflow "${run.name}" started`;
  }

  return {
    source: "gitea",
    category: "deployment",
    eventType,
    severity,
    appName: payload.repository.name,
    title,
    actor: {
      type: "system",
      name: "Gitea Actions",
    },
    links: [
      { label: "View Run", url: run.html_url, external: true },
    ],
    metadata: {
      repository: payload.repository.full_name,
      workflowId: run.id,
      workflowName: run.name,
      branch: run.head_branch,
      sha: run.head_sha.substring(0, 7),
      status: run.status,
      conclusion: run.conclusion,
    },
  };
}

// ===================================
// Clerk Normalizers
// ===================================

export function normalizeClerkUser(payload: ClerkUserPayload): CreateActivityEvent {
  const user = payload.data;
  const email = user.email_addresses[0]?.email_address || "unknown";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || email;
  
  let eventType: string;
  let title: string;
  let severity: "info" | "warning" | "error" | "critical" = "info";

  switch (payload.type) {
    case "user.created":
      eventType = "user.created";
      title = `New user signed up: ${name}`;
      break;
    case "user.updated":
      eventType = "user.updated";
      title = `User updated: ${name}`;
      break;
    case "user.deleted":
      eventType = "user.deleted";
      title = `User deleted: ${name}`;
      severity = "warning";
      break;
    default:
      eventType = payload.type;
      title = `User event: ${payload.type}`;
  }

  return {
    source: "clerk",
    category: "auth",
    eventType,
    severity,
    title,
    description: `Email: ${email}`,
    actor: {
      type: "user",
      id: user.id,
      name,
      email,
      avatar: user.image_url,
    },
    links: [
      { label: "View in Clerk", url: `https://dashboard.clerk.com/users/${user.id}`, external: true },
    ],
    metadata: {
      userId: user.id,
      email,
      firstName: user.first_name,
      lastName: user.last_name,
      createdAt: user.created_at,
    },
  };
}

export function normalizeClerkSession(payload: ClerkSessionPayload): CreateActivityEvent {
  const session = payload.data;
  
  let eventType: string;
  let title: string;
  let severity: "info" | "warning" | "error" | "critical" = "info";

  switch (payload.type) {
    case "session.created":
      eventType = "session.created";
      title = "New session started";
      break;
    case "session.ended":
      eventType = "session.ended";
      title = "Session ended";
      break;
    case "session.revoked":
      eventType = "session.revoked";
      title = "Session revoked";
      severity = "warning";
      break;
    default:
      eventType = payload.type;
      title = `Session event: ${payload.type}`;
  }

  return {
    source: "clerk",
    category: "auth",
    eventType,
    severity,
    title,
    actor: {
      type: "user",
      id: session.user_id,
    },
    metadata: {
      sessionId: session.id,
      userId: session.user_id,
      status: session.status,
    },
  };
}

// ===================================
// Stripe Normalizers
// ===================================

export function normalizeStripePayment(payload: StripePaymentPayload): CreateActivityEvent {
  const obj = payload.data.object;
  
  let eventType: string;
  let title: string;
  let severity: "info" | "warning" | "error" | "critical" = "info";
  let category: "payment" | "auth" | "error" = "payment";

  const amount = obj.amount ? `$${(obj.amount / 100).toFixed(2)}` : "";

  switch (payload.type) {
    case "payment_intent.succeeded":
      eventType = "payment.succeeded";
      title = `Payment succeeded: ${amount} ${obj.currency?.toUpperCase() || ""}`.trim();
      break;
    case "payment_intent.payment_failed":
      eventType = "payment.failed";
      title = `Payment failed: ${amount} ${obj.currency?.toUpperCase() || ""}`.trim();
      severity = "error";
      break;
    case "invoice.paid":
      eventType = "invoice.paid";
      title = `Invoice paid: ${amount}`;
      break;
    case "invoice.payment_failed":
      eventType = "invoice.failed";
      title = `Invoice payment failed: ${amount}`;
      severity = "error";
      break;
    case "customer.subscription.created":
      eventType = "subscription.created";
      title = "New subscription created";
      break;
    case "customer.subscription.updated":
      eventType = "subscription.updated";
      title = "Subscription updated";
      break;
    case "customer.subscription.deleted":
      eventType = "subscription.cancelled";
      title = "Subscription cancelled";
      severity = "warning";
      break;
    default:
      eventType = payload.type;
      title = `Stripe event: ${payload.type}`;
  }

  return {
    source: "stripe",
    category,
    eventType,
    severity,
    title,
    actor: {
      type: "system",
      name: "Stripe",
    },
    links: [
      { label: "View in Stripe", url: `https://dashboard.stripe.com/payments/${obj.id}`, external: true },
    ],
    metadata: {
      stripeId: obj.id,
      amount: obj.amount,
      currency: obj.currency,
      customer: obj.customer,
      status: obj.status,
      appId: obj.metadata?.appId,
    },
  };
}

// ===================================
// Sentry Normalizers
// ===================================

export function normalizeSentryIssue(payload: SentryIssuePayload): CreateActivityEvent {
  const issue = payload.data.issue;
  
  let eventType: string;
  let title: string;
  let severity: "info" | "warning" | "error" | "critical" = "error";

  switch (payload.action) {
    case "created":
      eventType = "issue.created";
      title = `New error: ${issue.title}`;
      if (issue.level === "fatal") severity = "critical";
      break;
    case "resolved":
      eventType = "issue.resolved";
      title = `Issue resolved: ${issue.title}`;
      severity = "info";
      break;
    case "ignored":
      eventType = "issue.ignored";
      title = `Issue ignored: ${issue.title}`;
      severity = "info";
      break;
    case "assigned":
      eventType = "issue.assigned";
      title = `Issue assigned: ${issue.title}`;
      severity = "info";
      break;
    default:
      eventType = `issue.${payload.action}`;
      title = `Issue ${payload.action}: ${issue.title}`;
  }

  return {
    source: "sentry",
    category: "error",
    eventType,
    severity,
    appName: issue.project.name,
    title,
    description: issue.culprit,
    actor: payload.actor ? {
      type: payload.actor.type === "user" ? "user" : "system",
      id: payload.actor.id,
      name: payload.actor.name,
    } : {
      type: "system",
      name: "Sentry",
    },
    links: [
      { label: `${issue.shortId}`, url: `https://sentry.io/issues/${issue.id}`, external: true },
    ],
    metadata: {
      issueId: issue.id,
      shortId: issue.shortId,
      level: issue.level,
      platform: issue.platform,
      project: issue.project.slug,
      count: issue.count,
      userCount: issue.userCount,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
    },
  };
}

// ===================================
// Kubernetes Normalizers
// ===================================

export function normalizeKubernetesEvent(payload: KubernetesEventPayload): CreateActivityEvent {
  let severity: "info" | "warning" | "error" | "critical" = "info";
  let category: "deployment" | "infrastructure" = "infrastructure";
  let title: string;

  switch (payload.type) {
    case "deployment.updated":
      category = "deployment";
      title = `Deployment ${payload.name} updated`;
      break;
    case "pod.crashed":
      title = `Pod ${payload.name} crashed`;
      severity = "error";
      break;
    case "pod.started":
      title = `Pod ${payload.name} started`;
      break;
    case "service.created":
      title = `Service ${payload.name} created`;
      break;
    case "node.ready":
      title = `Node ${payload.name} is ready`;
      break;
    case "node.notready":
      title = `Node ${payload.name} is not ready`;
      severity = "error";
      break;
    case "hpa.scaled":
      title = `HPA scaled ${payload.name}`;
      break;
    default:
      title = `K8s event: ${payload.type} on ${payload.name}`;
  }

  return {
    source: "kubernetes",
    category,
    eventType: payload.type,
    severity,
    environment: payload.namespace,
    title,
    description: payload.message,
    actor: {
      type: "system",
      name: "Kubernetes",
    },
    metadata: {
      namespace: payload.namespace,
      name: payload.name,
      reason: payload.reason,
      involvedObject: payload.involvedObject,
    },
  };
}

// ===================================
// Neon Normalizers
// ===================================

export function normalizeNeonEvent(payload: NeonEventPayload): CreateActivityEvent {
  let title: string;
  let severity: "info" | "warning" | "error" | "critical" = "info";

  switch (payload.type) {
    case "branch.created":
      title = `Database branch created: ${payload.data.name}`;
      break;
    case "branch.deleted":
      title = `Database branch deleted: ${payload.data.name}`;
      severity = "warning";
      break;
    case "endpoint.started":
      title = `Database endpoint started: ${payload.data.name}`;
      break;
    case "endpoint.suspended":
      title = `Database endpoint suspended: ${payload.data.name}`;
      severity = "warning";
      break;
    case "project.created":
      title = `Database project created: ${payload.data.name}`;
      break;
    default:
      title = `Neon event: ${payload.type}`;
  }

  return {
    source: "neon",
    category: "infrastructure",
    eventType: payload.type,
    severity,
    title,
    actor: {
      type: "system",
      name: "Neon",
    },
    links: [
      { label: "View in Neon", url: "https://console.neon.tech", external: true },
    ],
    metadata: {
      ...payload.data,
    },
  };
}

// ===================================
// System Event Helper
// ===================================

export function createSystemEvent(
  eventType: string,
  title: string,
  options: {
    severity?: "info" | "warning" | "error" | "critical";
    category?: "deployment" | "infrastructure" | "integration" | "security";
    appId?: string;
    appName?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): CreateActivityEvent {
  return {
    source: "system",
    category: options.category || "integration",
    eventType,
    severity: options.severity || "info",
    appId: options.appId,
    appName: options.appName,
    title,
    description: options.description,
    actor: {
      type: "system",
      name: "Control Panel",
    },
    metadata: options.metadata,
  };
}

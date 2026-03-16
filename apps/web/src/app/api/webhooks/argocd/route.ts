import { NextRequest, NextResponse } from 'next/server';
import {
  storeWebhookEvent,
  storeDeploymentEvent,
  createNotification,
} from '@repo/webhooks';
import { sendSlackNotification } from '@/lib/webhooks/webhook-service';
import { verifyBearerToken } from '@repo/webhooks';
import { webhookLimiter } from '@repo/webhooks';
import { RateLimitError } from '@repo/webhooks';
import { getDb } from '@repo/db';
import { metrics } from '@/lib/metrics/collector';

interface ArgoCDStatus {
  health: {
    status: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
    message?: string;
  };
  sync: {
    status: 'Synced' | 'OutOfSync' | 'Unknown';
    revision?: string;
    message?: string;
  };
  operationState?: {
    phase: 'Running' | 'Succeeded' | 'Failed' | 'Error' | 'Terminating';
    message?: string;
    startedAt: string;
    finishedAt?: string;
  };
}

interface ArgoCDWebhookPayload {
  app: {
    metadata: {
      name: string;
      namespace: string;
    };
    spec: {
      source: {
        repoURL: string;
        path: string;
        targetRevision: string;
      };
      destination: {
        server: string;
        namespace: string;
      };
    };
    status: ArgoCDStatus;
  };
  eventType: string;
  eventTime: string;
}

function getDeploymentStatusFromArgoCDState(
  eventType: string,
  syncStatus: ArgoCDStatus['sync']['status'],
  healthStatus: ArgoCDStatus['health']['status']
): 'pending' | 'building' | 'testing' | 'deploying' | 'verifying' | 'succeeded' | 'failed' {
  if (eventType === 'app.sync.running') {
    return 'deploying';
  }

  if (eventType === 'app.sync.failed') {
    return 'failed';
  }

  if (eventType === 'app.sync.succeeded') {
    return 'succeeded';
  }

  if (healthStatus === 'Progressing') {
    return 'deploying';
  }

  if (syncStatus === 'Synced' && healthStatus === 'Healthy') {
    return 'succeeded';
  }

  if (healthStatus === 'Degraded') {
    return 'failed';
  }

  if (healthStatus === 'Missing') {
    return 'building';
  }

  if (syncStatus === 'OutOfSync') {
    return 'deploying';
  }

  return 'pending';
}

function getDeploymentStepFromArgoCDStatus(
  eventType: string,
  syncStatus: ArgoCDStatus['sync']['status'],
  healthStatus: ArgoCDStatus['health']['status']
): 'build' | 'test' | 'deploy' | 'verify' {
  if (eventType === 'app.sync.succeeded') {
    return 'verify';
  }

  if (eventType === 'app.sync.failed') {
    return 'deploy';
  }

  if (healthStatus === 'Progressing' || syncStatus === 'OutOfSync') {
    return 'deploy';
  }

  return syncStatus === 'Synced' ? 'verify' : 'deploy';
}

function getDeploymentMetadata(payload: ArgoCDWebhookPayload) {
  const { app } = payload;

  return {
    syncStatus: app.status.sync.status,
    healthStatus: app.status.health.status,
    revision: app.status.sync.revision,
    operationPhase: app.status.operationState?.phase,
    operationMessage: app.status.operationState?.message,
    sourceRepo: app.spec.source.repoURL,
    sourcePath: app.spec.source.path,
    targetRevision: app.spec.source.targetRevision,
  };
}

function statusFromEvent(payload: ArgoCDWebhookPayload) {
  const status = getDeploymentStatusFromArgoCDState(
    payload.eventType,
    payload.app.status.sync.status,
    payload.app.status.health.status
  );

  const deploymentStep = getDeploymentStepFromArgoCDStatus(
    payload.eventType,
    payload.app.status.sync.status,
    payload.app.status.health.status
  );

  return { status, deploymentStep };
}

export async function POST(request: NextRequest) {
  const startMs = Date.now();

  try {
    await webhookLimiter.checkLimit(request);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': String(error.retryAfter || 60) } }
      );
    }
    throw error;
  }

  const argocdToken = process.env.ARGOCD_WEBHOOK_TOKEN;
  if (argocdToken) {
    const authHeader = request.headers.get('Authorization');
    const verification = verifyBearerToken(authHeader, null, argocdToken);
    if (!verification.valid) {
      console.error('ArgoCD webhook auth failed:', verification.error);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  metrics.incrementCounter("webhook_received_total", { source: "argocd" });

  try {
    const payload: ArgoCDWebhookPayload = await request.json();

    console.log(`Processing ArgoCD webhook: ${payload.eventType} for app ${payload.app.metadata.name}`);

    switch (payload.eventType) {
      case 'app.created':
        await handleAppCreated(payload);
        break;

      case 'app.updated':
        await handleAppUpdated(payload);
        break;

      case 'app.deleted':
        await handleAppDeleted(payload);
        break;

      case 'app.health.degraded':
        await handleAppDegraded(payload);
        break;

      case 'app.sync.running':
        await handleSyncRunning(payload);
        break;

      case 'app.sync.succeeded':
        await handleSyncSucceeded(payload);
        break;

      case 'app.sync.failed':
        await handleSyncFailed(payload);
        break;

      default:
        console.log(`Unhandled ArgoCD event type: ${payload.eventType}`);
    }

    await storeWebhookEvent(getDb(), {
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
    });

    metrics.observeHistogram("webhook_processing_duration_seconds", (Date.now() - startMs) / 1000, { source: "argocd" });

    return NextResponse.json({
      success: true,
      event: payload.eventType,
      app: payload.app.metadata.name,
    });
  } catch (error) {
    metrics.incrementCounter("webhook_errors_total", { source: "argocd" });
    console.error('Error processing ArgoCD webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getSeverityForEvent(eventType: string): 'info' | 'warning' | 'critical' {
  switch (eventType) {
    case 'app.sync.failed':
    case 'app.health.degraded':
      return 'critical';
    case 'app.deleted':
      return 'warning';
    default:
      return 'info';
  }
}

async function handleAppCreated(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name;

  console.log(`ArgoCD app created: ${appName}`);

  await storeDeploymentEvent(getDb(), {
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'sync',
    branch: payload.app.spec.source.targetRevision,
    status: 'pending',
    triggeredBy: 'argocd',
    details: 'New application creation event',
    metadata: {
      ...getDeploymentMetadata(payload),
      deploymentStep: 'deploy',
    },
    startedAt: payload.app.status.operationState?.startedAt
      ? new Date(payload.app.status.operationState.startedAt)
      : new Date(),
  });
}

async function handleAppUpdated(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name;
  const syncStatus = payload.app.status.sync.status;
  const healthStatus = payload.app.status.health.status;

  const derived = statusFromEvent(payload);

  console.log(
    `ArgoCD app updated: ${appName} (sync: ${syncStatus}, health: ${healthStatus}, status: ${derived.status})`
  );

  await storeDeploymentEvent(getDb(), {
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'sync',
    version: payload.app.status.sync.revision,
    status: derived.status,
    triggeredBy: 'argocd',
    details: `Sync: ${syncStatus}, Health: ${healthStatus}`,
    metadata: getDeploymentMetadata(payload),
    ...(payload.app.status.operationState?.startedAt
      ? { startedAt: new Date(payload.app.status.operationState.startedAt) }
      : {}),
    ...(payload.app.status.operationState?.finishedAt
      ? { completedAt: new Date(payload.app.status.operationState.finishedAt) }
      : {}),
  });
}

async function handleAppDeleted(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name;

  console.log(`ArgoCD app deleted: ${appName}`);

  await createNotification(getDb(), {
    source: 'argocd',
    category: 'deployment',
    severity: 'warning',
    title: `Application Deleted: ${appName}`,
    message: `ArgoCD application ${appName} has been deleted`,
    appName,
    environment: payload.app.metadata.namespace,
  });
}

async function handleAppDegraded(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name;
  const message = payload.app.status.health.message || 'Application health is degraded';

  console.error(`ArgoCD app degraded: ${appName} - ${message}`);

  await storeDeploymentEvent(getDb(), {
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'sync',
    status: 'failed',
    triggeredBy: 'argocd',
    details: message,
    metadata: getDeploymentMetadata(payload),
  });

  await createNotification(getDb(), {
    source: 'argocd',
    category: 'alert',
    severity: 'critical',
    title: `Application Degraded: ${appName}`,
    message,
    appName,
    environment: payload.app.metadata.namespace,
  });

  await sendSlackNotification({
    title: `⚠️ Application Degraded: ${appName}`,
    message,
    severity: 'warning',
  });
}

async function handleSyncRunning(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name;
  const derived = statusFromEvent(payload);

  console.log(`ArgoCD sync running for: ${appName}`);

  await storeDeploymentEvent(getDb(), {
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'sync',
    status: derived.status,
    triggeredBy: 'argocd',
    details: `Sync operation phase: ${payload.app.status.operationState?.phase ?? 'Running'}`,
    metadata: {
      ...getDeploymentMetadata(payload),
      deploymentStep: derived.deploymentStep,
    },
    startedAt: payload.app.status.operationState?.startedAt
      ? new Date(payload.app.status.operationState.startedAt)
      : new Date(),
  });
}

async function handleSyncSucceeded(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name;
  const revision = payload.app.status.sync.revision;
  const derived = statusFromEvent(payload);

  console.log(
    `ArgoCD sync succeeded for: ${appName} (revision: ${revision}, status: ${derived.status})`
  );

  await storeDeploymentEvent(getDb(), {
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'sync',
    version: revision,
    commitSha: revision,
    status: derived.status,
    triggeredBy: 'argocd',
    details: 'Sync completed successfully',
    metadata: {
      ...getDeploymentMetadata(payload),
      deploymentStep: derived.deploymentStep,
    },
    completedAt: payload.app.status.operationState?.finishedAt
      ? new Date(payload.app.status.operationState.finishedAt)
      : new Date(),
  });

  await createNotification(getDb(), {
    source: 'argocd',
    category: 'deployment',
    severity: 'info',
    title: `Deployment Succeeded: ${appName}`,
    message: `Application ${appName} synced to revision ${revision?.slice(0, 7) || 'latest'}`,
    appName,
    environment: payload.app.metadata.namespace,
  });
}

async function handleSyncFailed(payload: ArgoCDWebhookPayload) {
  const appName = payload.app.metadata.name;
  const message = payload.app.status.operationState?.message || 'ArgoCD sync failed';
  const derived = statusFromEvent(payload);

  console.error(`ArgoCD sync failed for: ${appName} - ${message}`);

  await storeDeploymentEvent(getDb(), {
    applicationId: appName,
    applicationName: appName,
    environment: payload.app.metadata.namespace,
    action: 'sync',
    status: derived.status,
    triggeredBy: 'argocd',
    details: message,
    metadata: {
      ...getDeploymentMetadata(payload),
      deploymentStep: derived.deploymentStep,
    },
    completedAt: payload.app.status.operationState?.finishedAt
      ? new Date(payload.app.status.operationState.finishedAt)
      : new Date(),
  });

  await createNotification(getDb(), {
    source: 'argocd',
    category: 'alert',
    severity: 'critical',
    title: `Deployment Failed: ${appName}`,
    message,
    appName,
    environment: payload.app.metadata.namespace,
  });

  await sendSlackNotification({
    title: `🚨 Deployment Failed: ${appName}`,
    message,
    severity: 'critical',
  });
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
      'app.sync.failed',
    ],
  });
}

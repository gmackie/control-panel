# Cluster Health Monitoring & Alerting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect node and pod health issues within 30s and alert via Slack/push/in-app/email, plus manage Prometheus & AlertManager config from the control panel.

**Architecture:** New `ClusterHealthWatcher` service uses `K8sApiClient` directly (HTTP, no kubectl) to poll node+pod health every 30s. Events feed into the existing `NotificationRulesEngine` for multi-channel delivery. Separate API routes manage PrometheusRule CRDs and AlertManager config. Auto-starts via Next.js instrumentation hook.

**Tech Stack:** Next.js 14 (App Router), TypeScript, K8sApiClient (existing), NotificationRulesEngine (existing), Drizzle ORM

---

## Task 1: ClusterHealthWatcher - Pod Health Detection

The core service that polls the K8s API and detects unhealthy pods.

**Files:**
- Create: `apps/web/src/lib/monitoring/cluster-health-watcher.ts`

**Step 1: Create the ClusterHealthWatcher service**

This service uses `K8sApiClient` (direct HTTP to K8s API) to avoid the orchestrator/kubectl dependency chain. It polls every 30s, evaluates node + pod health, and creates notifications.

```typescript
/**
 * ClusterHealthWatcher - Lightweight cluster health polling service
 *
 * Uses K8sApiClient directly (HTTP) to poll node and pod health every 30s.
 * Creates notifications via the rules engine for multi-channel delivery.
 * Auto-started via Next.js instrumentation hook.
 */
import { EventEmitter } from 'events';
import { getK8sClient, K8sPod, K8sNode } from '@/lib/cluster/k8s-api-client';
import { rulesEngine } from '@/lib/notifications/rules-engine';
import type { CreateNotification } from '@/lib/notifications/types';

// --- Types ---

export interface PodHealthIssue {
  id: string;
  namespace: string;
  podName: string;
  nodeName: string;
  type: 'crash-loop' | 'excessive-restarts' | 'stuck-unknown' | 'stuck-pending' | 'error';
  severity: 'critical' | 'warning';
  message: string;
  containerName?: string;
  restartCount?: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface NodeHealthIssue {
  id: string;
  nodeName: string;
  type: 'unreachable' | 'not-ready' | 'cpu-pressure' | 'memory-pressure' | 'disk-pressure' | 'pid-pressure';
  severity: 'critical' | 'warning';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface ClusterHealthSnapshot {
  timestamp: Date;
  nodes: {
    total: number;
    ready: number;
    issues: NodeHealthIssue[];
  };
  pods: {
    total: number;
    running: number;
    issues: PodHealthIssue[];
  };
}

export interface ClusterHealthWatcherConfig {
  checkIntervalSeconds: number;
  thresholds: {
    podRestartCount: number;       // restarts in window to trigger alert
    podRestartWindow: number;      // seconds
    pendingTimeout: number;        // seconds before Pending pod is flagged
    nodeHeartbeatWarning: number;  // seconds
    nodeHeartbeatCritical: number; // seconds
    nodeCpuWarning: number;        // percentage
    nodeCpuCritical: number;       // percentage
    nodeMemoryWarning: number;     // percentage
    nodeMemoryCritical: number;    // percentage
  };
}

const DEFAULT_CONFIG: ClusterHealthWatcherConfig = {
  checkIntervalSeconds: 30,
  thresholds: {
    podRestartCount: 5,
    podRestartWindow: 3600,   // 1 hour
    pendingTimeout: 300,      // 5 minutes
    nodeHeartbeatWarning: 60,
    nodeHeartbeatCritical: 120,
    nodeCpuWarning: 70,
    nodeCpuCritical: 90,
    nodeMemoryWarning: 80,
    nodeMemoryCritical: 95,
  },
};

// --- Service ---

export class ClusterHealthWatcher extends EventEmitter {
  private config: ClusterHealthWatcherConfig;
  private interval?: NodeJS.Timeout;
  private running = false;

  // Track active issues for dedup and resolution
  private activePodIssues: Map<string, PodHealthIssue> = new Map();
  private activeNodeIssues: Map<string, NodeHealthIssue> = new Map();

  // History for dashboard
  private snapshots: ClusterHealthSnapshot[] = [];
  private maxSnapshots = 2880; // 24h at 30s intervals

  constructor(config: Partial<ClusterHealthWatcherConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config, thresholds: { ...DEFAULT_CONFIG.thresholds, ...config.thresholds } };
  }

  async start(): Promise<void> {
    if (this.running) return;

    const client = getK8sClient();
    if (!client) {
      console.warn('[ClusterHealthWatcher] K8s client not available, skipping start');
      return;
    }

    this.running = true;
    console.log(`[ClusterHealthWatcher] Starting with ${this.config.checkIntervalSeconds}s interval`);

    // Initial check
    await this.check();

    this.interval = setInterval(async () => {
      try {
        await this.check();
      } catch (error) {
        console.error('[ClusterHealthWatcher] Check failed:', error);
      }
    }, this.config.checkIntervalSeconds * 1000);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.running = false;
    console.log('[ClusterHealthWatcher] Stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getActiveIssues(): { pods: PodHealthIssue[]; nodes: NodeHealthIssue[] } {
    return {
      pods: Array.from(this.activePodIssues.values()),
      nodes: Array.from(this.activeNodeIssues.values()),
    };
  }

  getSnapshots(limit = 120): ClusterHealthSnapshot[] {
    return this.snapshots.slice(-limit);
  }

  getLatestSnapshot(): ClusterHealthSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  // --- Core check loop ---

  private async check(): Promise<void> {
    const client = getK8sClient();
    if (!client) return;

    const [nodes, pods] = await Promise.all([
      client.getNodes().catch(() => [] as K8sNode[]),
      client.getAllPods().catch(() => [] as K8sPod[]),
    ]);

    const nodeIssues = this.evaluateNodes(nodes);
    const podIssues = this.evaluatePods(pods);

    // Resolve issues that are no longer present
    this.resolveCleared('pod', podIssues);
    this.resolveCleared('node', nodeIssues);

    // Process new issues (dedup + notify)
    for (const issue of nodeIssues) {
      await this.processNodeIssue(issue);
    }
    for (const issue of podIssues) {
      await this.processPodIssue(issue);
    }

    // Store snapshot
    const snapshot: ClusterHealthSnapshot = {
      timestamp: new Date(),
      nodes: {
        total: nodes.length,
        ready: nodes.filter(n => this.isNodeReady(n)).length,
        issues: Array.from(this.activeNodeIssues.values()),
      },
      pods: {
        total: pods.length,
        running: pods.filter(p => p.status.phase === 'Running' && this.isPodReady(p)).length,
        issues: Array.from(this.activePodIssues.values()),
      },
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    this.emit('snapshot', snapshot);
  }

  // --- Node evaluation ---

  private evaluateNodes(nodes: K8sNode[]): NodeHealthIssue[] {
    const issues: NodeHealthIssue[] = [];

    for (const node of nodes) {
      const name = node.metadata.name;
      const conditions = node.status?.conditions || [];

      const ready = conditions.find(c => c.type === 'Ready');
      if (!ready || ready.status !== 'True') {
        issues.push({
          id: `node-${name}-not-ready`,
          nodeName: name,
          type: ready?.status === 'Unknown' ? 'unreachable' : 'not-ready',
          severity: 'critical',
          message: ready?.status === 'Unknown'
            ? `Node ${name} is unreachable (kubelet stopped posting status)`
            : `Node ${name} is not ready`,
          timestamp: new Date(),
          resolved: false,
        });
      }

      for (const cond of conditions) {
        if (cond.type === 'MemoryPressure' && cond.status === 'True') {
          issues.push({
            id: `node-${name}-memory-pressure`,
            nodeName: name,
            type: 'memory-pressure',
            severity: 'critical',
            message: `Node ${name} has memory pressure`,
            timestamp: new Date(),
            resolved: false,
          });
        }
        if (cond.type === 'DiskPressure' && cond.status === 'True') {
          issues.push({
            id: `node-${name}-disk-pressure`,
            nodeName: name,
            type: 'disk-pressure',
            severity: 'critical',
            message: `Node ${name} has disk pressure`,
            timestamp: new Date(),
            resolved: false,
          });
        }
        if (cond.type === 'PIDPressure' && cond.status === 'True') {
          issues.push({
            id: `node-${name}-pid-pressure`,
            nodeName: name,
            type: 'pid-pressure',
            severity: 'critical',
            message: `Node ${name} has PID pressure`,
            timestamp: new Date(),
            resolved: false,
          });
        }
      }
    }

    return issues;
  }

  // --- Pod evaluation ---

  private evaluatePods(pods: K8sPod[]): PodHealthIssue[] {
    const issues: PodHealthIssue[] = [];

    for (const pod of pods) {
      const ns = pod.metadata.namespace;
      const name = pod.metadata.name;
      const node = pod.spec.nodeName || 'unscheduled';

      // Skip completed pods (Jobs, etc)
      if (pod.status.phase === 'Succeeded') continue;

      // Check container statuses
      for (const cs of pod.status.containerStatuses || []) {
        // CrashLoopBackOff
        if (cs.state?.waiting?.reason === 'CrashLoopBackOff') {
          issues.push({
            id: `pod-${ns}-${name}-${cs.name}-crashloop`,
            namespace: ns,
            podName: name,
            nodeName: node,
            type: 'crash-loop',
            severity: 'critical',
            message: `Pod ${ns}/${name} container ${cs.name} is in CrashLoopBackOff (${cs.restartCount} restarts)`,
            containerName: cs.name,
            restartCount: cs.restartCount,
            timestamp: new Date(),
            resolved: false,
          });
        }

        // Excessive restarts (not yet in CrashLoopBackOff but high restart count)
        else if (cs.restartCount >= this.config.thresholds.podRestartCount && cs.state?.waiting?.reason !== 'CrashLoopBackOff') {
          issues.push({
            id: `pod-${ns}-${name}-${cs.name}-restarts`,
            namespace: ns,
            podName: name,
            nodeName: node,
            type: 'excessive-restarts',
            severity: 'warning',
            message: `Pod ${ns}/${name} container ${cs.name} has ${cs.restartCount} restarts`,
            containerName: cs.name,
            restartCount: cs.restartCount,
            timestamp: new Date(),
            resolved: false,
          });
        }
      }

      // ContainerStatusUnknown
      if (pod.status.phase === 'Unknown' || pod.status.containerStatuses?.some(
        cs => cs.state?.waiting?.reason === 'ContainerStatusUnknown' ||
              cs.state?.terminated?.reason === 'ContainerStatusUnknown'
      )) {
        issues.push({
          id: `pod-${ns}-${name}-unknown`,
          namespace: ns,
          podName: name,
          nodeName: node,
          type: 'stuck-unknown',
          severity: 'warning',
          message: `Pod ${ns}/${name} has unknown container status`,
          timestamp: new Date(),
          resolved: false,
        });
      }

      // Stuck Pending
      if (pod.status.phase === 'Pending' && pod.status.startTime) {
        const pendingSince = new Date(pod.status.startTime).getTime();
        const pendingDuration = (Date.now() - pendingSince) / 1000;
        if (pendingDuration > this.config.thresholds.pendingTimeout) {
          issues.push({
            id: `pod-${ns}-${name}-pending`,
            namespace: ns,
            podName: name,
            nodeName: node,
            type: 'stuck-pending',
            severity: 'warning',
            message: `Pod ${ns}/${name} has been Pending for ${Math.round(pendingDuration / 60)}m`,
            timestamp: new Date(),
            resolved: false,
          });
        }
      }

      // Error phase
      if (pod.status.phase === 'Failed') {
        issues.push({
          id: `pod-${ns}-${name}-failed`,
          namespace: ns,
          podName: name,
          nodeName: node,
          type: 'error',
          severity: 'warning',
          message: `Pod ${ns}/${name} is in Failed state`,
          timestamp: new Date(),
          resolved: false,
        });
      }
    }

    return issues;
  }

  // --- Issue processing (dedup + notify) ---

  private async processNodeIssue(issue: NodeHealthIssue): Promise<void> {
    if (this.activeNodeIssues.has(issue.id)) return; // Already tracking

    this.activeNodeIssues.set(issue.id, issue);
    this.emit('nodeIssue', issue);

    await this.notify({
      source: 'cluster-health-watcher',
      category: 'infrastructure',
      severity: issue.severity === 'critical' ? 'critical' : 'warning',
      title: issue.message,
      message: `Node health issue detected: ${issue.type} on ${issue.nodeName}`,
      environment: 'production',
      groupKey: issue.id,
      metadata: { issueType: issue.type, nodeName: issue.nodeName },
      links: [{ label: 'Cluster Dashboard', url: '/cluster' }],
    });
  }

  private async processPodIssue(issue: PodHealthIssue): Promise<void> {
    if (this.activePodIssues.has(issue.id)) return; // Already tracking

    this.activePodIssues.set(issue.id, issue);
    this.emit('podIssue', issue);

    await this.notify({
      source: 'cluster-health-watcher',
      category: 'infrastructure',
      severity: issue.severity === 'critical' ? 'critical' : 'warning',
      title: issue.message,
      message: `Pod health issue in namespace ${issue.namespace}: ${issue.type}`,
      appName: issue.namespace,
      environment: 'production',
      groupKey: issue.id,
      metadata: {
        issueType: issue.type,
        namespace: issue.namespace,
        podName: issue.podName,
        nodeName: issue.nodeName,
        restartCount: issue.restartCount,
      },
      links: [{ label: 'Cluster Dashboard', url: '/cluster' }],
    });
  }

  private resolveCleared(type: 'pod' | 'node', currentIssues: Array<{ id: string }>): void {
    const currentIds = new Set(currentIssues.map(i => i.id));
    const activeMap = type === 'pod' ? this.activePodIssues : this.activeNodeIssues;

    for (const [id, issue] of activeMap) {
      if (!currentIds.has(id)) {
        issue.resolved = true;
        issue.resolvedAt = new Date();
        activeMap.delete(id);
        this.emit(type === 'pod' ? 'podIssueResolved' : 'nodeIssueResolved', issue);

        // Send resolution notification
        this.notify({
          source: 'cluster-health-watcher',
          category: 'infrastructure',
          severity: 'info',
          title: `Resolved: ${issue.message}`,
          message: `Issue has been resolved`,
          environment: 'production',
          groupKey: issue.id,
        }).catch(console.error);
      }
    }
  }

  private async notify(input: CreateNotification): Promise<void> {
    try {
      await rulesEngine.process(input);
    } catch (error) {
      console.error('[ClusterHealthWatcher] Failed to send notification:', error);
    }
  }

  // --- Helpers ---

  private isNodeReady(node: K8sNode): boolean {
    const ready = node.status?.conditions?.find(c => c.type === 'Ready');
    return ready?.status === 'True';
  }

  private isPodReady(pod: K8sPod): boolean {
    return pod.status.containerStatuses?.every(cs => cs.ready) ?? false;
  }
}

// --- Singleton ---

let instance: ClusterHealthWatcher | null = null;

export function getClusterHealthWatcher(): ClusterHealthWatcher {
  if (!instance) {
    instance = new ClusterHealthWatcher();
  }
  return instance;
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/monitoring/cluster-health-watcher.ts
git commit -m "feat: add ClusterHealthWatcher for pod and node health detection"
```

---

## Task 2: K8sApiClient - Add Missing Node Condition Fields

The existing `K8sNode` interface is missing the `conditions` field on `status` which we need. We also need a `getNodes()` method if missing.

**Files:**
- Modify: `apps/web/src/lib/cluster/k8s-api-client.ts`

**Step 1: Check and extend K8sNode interface**

Add `conditions` to the `K8sNode.status` interface if not already present:

```typescript
export interface K8sNode {
  metadata: {
    name: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    creationTimestamp: string;
  };
  spec: {
    podCIDR?: string;
    taints?: Array<{
      key: string;
      value?: string;
      effect: string;
    }>;
  };
  status: {
    conditions: Array<{
      type: string;
      status: string;
      lastHeartbeatTime?: string;
      lastTransitionTime?: string;
      reason?: string;
      message?: string;
    }>;
    addresses?: Array<{
      type: string;
      address: string;
    }>;
    capacity?: Record<string, string>;
    allocatable?: Record<string, string>;
    nodeInfo?: {
      kernelVersion: string;
      osImage: string;
      containerRuntimeVersion: string;
      kubeletVersion: string;
      architecture: string;
    };
  };
}
```

Also extend `K8sPod` to ensure `containerStatuses` has the `lastState` field:

```typescript
// In K8sPod.status.containerStatuses:
containerStatuses?: Array<{
  name: string;
  ready: boolean;
  restartCount: number;
  state: {
    running?: { startedAt: string };
    waiting?: { reason: string; message?: string };
    terminated?: { exitCode: number; reason: string; message?: string };
  };
  lastState?: {
    terminated?: { exitCode: number; reason: string; finishedAt?: string };
  };
  image: string;
}>;
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/cluster/k8s-api-client.ts
git commit -m "feat: extend K8sNode and K8sPod interfaces for health monitoring"
```

---

## Task 3: Auto-Start via Next.js Instrumentation

Create the instrumentation hook to auto-start the health watcher when the Next.js server boots.

**Files:**
- Create: `apps/web/src/instrumentation.ts`

**Step 1: Create instrumentation.ts**

```typescript
export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getClusterHealthWatcher } = await import('@/lib/monitoring/cluster-health-watcher');

    const watcher = getClusterHealthWatcher();

    // Delay start slightly to let the app fully initialize
    setTimeout(async () => {
      try {
        await watcher.start();
        console.log('[instrumentation] ClusterHealthWatcher started');
      } catch (error) {
        console.error('[instrumentation] Failed to start ClusterHealthWatcher:', error);
      }
    }, 5000);
  }
}
```

**Step 2: Verify `next.config` has instrumentation enabled**

Next.js 14+ has instrumentation enabled by default with the `instrumentation.ts` file in the `src/` directory. Check `next.config.js` or `next.config.mjs` and add `experimental.instrumentationHook: true` if on Next.js < 15.

**Step 3: Commit**

```bash
git add apps/web/src/instrumentation.ts
git commit -m "feat: auto-start ClusterHealthWatcher on app boot"
```

---

## Task 4: Cluster Health API Endpoint

Add an API route for the dashboard to query current cluster health and active issues.

**Files:**
- Create: `apps/web/src/app/api/cluster/health/issues/route.ts`

**Step 1: Create the API route**

```typescript
import { NextResponse } from 'next/server';
import { getClusterHealthWatcher } from '@/lib/monitoring/cluster-health-watcher';

export async function GET() {
  const watcher = getClusterHealthWatcher();
  const issues = watcher.getActiveIssues();
  const snapshot = watcher.getLatestSnapshot();

  return NextResponse.json({
    running: watcher.isRunning(),
    timestamp: snapshot?.timestamp ?? null,
    summary: snapshot ? {
      nodes: { total: snapshot.nodes.total, ready: snapshot.nodes.ready },
      pods: { total: snapshot.pods.total, running: snapshot.pods.running },
    } : null,
    issues: {
      nodes: issues.nodes,
      pods: issues.pods,
      total: issues.nodes.length + issues.pods.length,
    },
  });
}
```

**Step 2: Add SSE stream for real-time issue updates**

Create: `apps/web/src/app/api/cluster/health/issues/stream/route.ts`

```typescript
import { getClusterHealthWatcher } from '@/lib/monitoring/cluster-health-watcher';

export async function GET() {
  const watcher = getClusterHealthWatcher();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Send current state
      send('snapshot', watcher.getLatestSnapshot());

      // Listen for new events
      const onSnapshot = (snapshot: unknown) => send('snapshot', snapshot);
      const onPodIssue = (issue: unknown) => send('podIssue', issue);
      const onNodeIssue = (issue: unknown) => send('nodeIssue', issue);
      const onPodResolved = (issue: unknown) => send('podIssueResolved', issue);
      const onNodeResolved = (issue: unknown) => send('nodeIssueResolved', issue);

      watcher.on('snapshot', onSnapshot);
      watcher.on('podIssue', onPodIssue);
      watcher.on('nodeIssue', onNodeIssue);
      watcher.on('podIssueResolved', onPodResolved);
      watcher.on('nodeIssueResolved', onNodeResolved);

      // Keepalive
      const keepalive = setInterval(() => {
        send('keepalive', { timestamp: new Date().toISOString() });
      }, 30000);

      // Cleanup on close
      const cleanup = () => {
        clearInterval(keepalive);
        watcher.off('snapshot', onSnapshot);
        watcher.off('podIssue', onPodIssue);
        watcher.off('nodeIssue', onNodeIssue);
        watcher.off('podIssueResolved', onPodResolved);
        watcher.off('nodeIssueResolved', onNodeResolved);
      };

      // Handle client disconnect
      controller.close = new Proxy(controller.close, {
        apply(target, thisArg, args) {
          cleanup();
          return Reflect.apply(target, thisArg, args);
        },
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/api/cluster/health/issues/
git commit -m "feat: add cluster health issues API and SSE stream"
```

---

## Task 5: Default Notification Rules for Cluster Health

Seed notification rules so alerts actually get delivered. Without rules, the rules engine won't route to any channels.

**Files:**
- Create: `apps/web/src/lib/monitoring/seed-health-rules.ts`

**Step 1: Create the seeding function**

```typescript
import { notificationService } from '@/lib/notifications/notification-service';

/**
 * Seeds default notification rules for cluster health alerts.
 * Idempotent - checks if rules already exist before creating.
 */
export async function seedClusterHealthRules(): Promise<void> {
  const existingRules = await notificationService.getRules();
  const hasHealthRule = existingRules.some(r => r.name === 'Cluster Health - Critical');

  if (hasHealthRule) {
    console.log('[seedClusterHealthRules] Rules already exist, skipping');
    return;
  }

  console.log('[seedClusterHealthRules] Seeding default cluster health notification rules');

  // Critical alerts: all channels
  await notificationService.createRule({
    name: 'Cluster Health - Critical',
    description: 'Critical cluster issues: node unreachable, CrashLoopBackOff',
    enabled: true,
    priority: 10,
    conditions: {
      sources: ['cluster-health-watcher'],
      severities: ['critical'],
    },
    channels: [
      { type: 'in-app', enabled: true },
      { type: 'slack', enabled: true, config: {} },
      { type: 'push', enabled: true, config: {} },
      { type: 'email', enabled: true, config: {} },
    ],
    dedupe: {
      enabled: true,
      windowMinutes: 15,
      groupBy: ['source', 'title'],
    },
  });

  // Warning alerts: Slack + in-app
  await notificationService.createRule({
    name: 'Cluster Health - Warning',
    description: 'Warning cluster issues: excessive restarts, stuck pods',
    enabled: true,
    priority: 20,
    conditions: {
      sources: ['cluster-health-watcher'],
      severities: ['warning'],
    },
    channels: [
      { type: 'in-app', enabled: true },
      { type: 'slack', enabled: true, config: {} },
    ],
    dedupe: {
      enabled: true,
      windowMinutes: 30,
      groupBy: ['source', 'title'],
    },
  });

  // Resolution notifications: in-app only
  await notificationService.createRule({
    name: 'Cluster Health - Resolved',
    description: 'Cluster issue resolution notifications',
    enabled: true,
    priority: 30,
    conditions: {
      sources: ['cluster-health-watcher'],
      severities: ['info'],
    },
    channels: [
      { type: 'in-app', enabled: true },
      { type: 'slack', enabled: true, config: {} },
    ],
    dedupe: {
      enabled: true,
      windowMinutes: 5,
      groupBy: ['source', 'title'],
    },
  });

  console.log('[seedClusterHealthRules] Default rules created');
}
```

**Step 2: Call from instrumentation.ts**

Update `apps/web/src/instrumentation.ts` to also seed rules:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getClusterHealthWatcher } = await import('@/lib/monitoring/cluster-health-watcher');
    const { seedClusterHealthRules } = await import('@/lib/monitoring/seed-health-rules');

    setTimeout(async () => {
      try {
        await seedClusterHealthRules();
        const watcher = getClusterHealthWatcher();
        await watcher.start();
        console.log('[instrumentation] ClusterHealthWatcher started');
      } catch (error) {
        console.error('[instrumentation] Failed to start ClusterHealthWatcher:', error);
      }
    }, 5000);
  }
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/monitoring/seed-health-rules.ts apps/web/src/instrumentation.ts
git commit -m "feat: seed default notification rules for cluster health alerts"
```

---

## Task 6: Prometheus Rule Management API

CRUD for PrometheusRule CRDs in the monitoring namespace.

**Files:**
- Create: `apps/web/src/app/api/prometheus/rules/route.ts`
- Create: `apps/web/src/app/api/prometheus/rules/[name]/route.ts`
- Create: `apps/web/src/lib/prometheus/prometheus-client.ts`

**Step 1: Create the Prometheus client**

Uses K8sApiClient to manage PrometheusRule custom resources.

```typescript
import { getK8sClient } from '@/lib/cluster/k8s-api-client';

export interface PrometheusRuleGroup {
  name: string;
  interval?: string;
  rules: PrometheusAlertRule[];
}

export interface PrometheusAlertRule {
  alert: string;
  expr: string;
  for?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PrometheusRuleResource {
  apiVersion: 'monitoring.coreos.com/v1';
  kind: 'PrometheusRule';
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: {
    groups: PrometheusRuleGroup[];
  };
}

export class PrometheusClient {
  private namespace: string;

  constructor(namespace = 'monitoring') {
    this.namespace = namespace;
  }

  async listRules(): Promise<PrometheusRuleResource[]> {
    const client = getK8sClient();
    if (!client) throw new Error('K8s client not available');
    // Use the raw request method to query CRDs
    return client.request<{ items: PrometheusRuleResource[] }>(
      `/apis/monitoring.coreos.com/v1/namespaces/${this.namespace}/prometheusrules`
    ).then(r => r.items);
  }

  async getRule(name: string): Promise<PrometheusRuleResource> {
    const client = getK8sClient();
    if (!client) throw new Error('K8s client not available');
    return client.request<PrometheusRuleResource>(
      `/apis/monitoring.coreos.com/v1/namespaces/${this.namespace}/prometheusrules/${name}`
    );
  }

  async createRule(rule: PrometheusRuleResource): Promise<PrometheusRuleResource> {
    const client = getK8sClient();
    if (!client) throw new Error('K8s client not available');
    return client.request<PrometheusRuleResource>(
      `/apis/monitoring.coreos.com/v1/namespaces/${this.namespace}/prometheusrules`,
      { method: 'POST', body: JSON.stringify(rule) }
    );
  }

  async updateRule(name: string, rule: PrometheusRuleResource): Promise<PrometheusRuleResource> {
    const client = getK8sClient();
    if (!client) throw new Error('K8s client not available');
    return client.request<PrometheusRuleResource>(
      `/apis/monitoring.coreos.com/v1/namespaces/${this.namespace}/prometheusrules/${name}`,
      { method: 'PUT', body: JSON.stringify(rule) }
    );
  }

  async deleteRule(name: string): Promise<void> {
    const client = getK8sClient();
    if (!client) throw new Error('K8s client not available');
    await client.request(
      `/apis/monitoring.coreos.com/v1/namespaces/${this.namespace}/prometheusrules/${name}`,
      { method: 'DELETE' }
    );
  }
}

export const prometheusClient = new PrometheusClient();
```

**Note:** The K8sApiClient will need a generic `request()` method added for CRD access. Add to `k8s-api-client.ts`:

```typescript
async request<T = unknown>(path: string, options?: { method?: string; body?: string }): Promise<T> {
  // Uses the same HTTP logic as existing methods but with arbitrary paths
}
```

**Step 2: Create the API routes**

`apps/web/src/app/api/prometheus/rules/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prometheusClient } from '@/lib/prometheus/prometheus-client';

export async function GET() {
  try {
    const rules = await prometheusClient.listRules();
    return NextResponse.json({ rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rule = await prometheusClient.createRule(body);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

`apps/web/src/app/api/prometheus/rules/[name]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prometheusClient } from '@/lib/prometheus/prometheus-client';

export async function GET(_: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const rule = await prometheusClient.getRule(name);
    return NextResponse.json({ rule });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const body = await request.json();
    const rule = await prometheusClient.updateRule(name, body);
    return NextResponse.json({ rule });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    await prometheusClient.deleteRule(name);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/prometheus/ apps/web/src/app/api/prometheus/
git commit -m "feat: add Prometheus rule management API (CRD CRUD)"
```

---

## Task 7: AlertManager Config Management API

Read and update AlertManager configuration (receivers, routes) via the K8s API.

**Files:**
- Create: `apps/web/src/lib/prometheus/alertmanager-client.ts`
- Create: `apps/web/src/app/api/alertmanager/config/route.ts`
- Create: `apps/web/src/app/api/alertmanager/reload/route.ts`

**Step 1: Create the AlertManager config client**

```typescript
import { getK8sClient } from '@/lib/cluster/k8s-api-client';
import * as yaml from 'yaml';

export interface AlertManagerConfig {
  global?: Record<string, unknown>;
  route: {
    receiver: string;
    group_by?: string[];
    group_wait?: string;
    group_interval?: string;
    repeat_interval?: string;
    routes?: AlertManagerRoute[];
  };
  receivers: AlertManagerReceiver[];
  inhibit_rules?: Array<Record<string, unknown>>;
}

export interface AlertManagerRoute {
  receiver: string;
  match?: Record<string, string>;
  match_re?: Record<string, string>;
  group_by?: string[];
  continue?: boolean;
  routes?: AlertManagerRoute[];
}

export interface AlertManagerReceiver {
  name: string;
  slack_configs?: Array<{
    api_url?: string;
    channel?: string;
    send_resolved?: boolean;
    title?: string;
    text?: string;
  }>;
  email_configs?: Array<{
    to: string;
    send_resolved?: boolean;
  }>;
  webhook_configs?: Array<{
    url: string;
    send_resolved?: boolean;
  }>;
  pagerduty_configs?: Array<{
    service_key?: string;
    routing_key?: string;
  }>;
}

export class AlertManagerClient {
  private namespace: string;
  private secretName: string;

  constructor(namespace = 'monitoring', secretName = 'alertmanager-kube-prometheus-stack-alertmanager') {
    this.namespace = namespace;
    this.secretName = secretName;
  }

  async getConfig(): Promise<AlertManagerConfig> {
    const client = getK8sClient();
    if (!client) throw new Error('K8s client not available');

    const secret = await client.getSecret(this.namespace, this.secretName);
    const configB64 = secret.data?.['alertmanager.yaml'];
    if (!configB64) throw new Error('alertmanager.yaml not found in secret');

    const configYaml = Buffer.from(configB64, 'base64').toString('utf-8');
    return yaml.parse(configYaml) as AlertManagerConfig;
  }

  async updateConfig(config: AlertManagerConfig): Promise<void> {
    const client = getK8sClient();
    if (!client) throw new Error('K8s client not available');

    const configYaml = yaml.stringify(config);
    const configB64 = Buffer.from(configYaml).toString('base64');

    await client.request(
      `/api/v1/namespaces/${this.namespace}/secrets/${this.secretName}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          data: { 'alertmanager.yaml': configB64 },
        }),
        headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
      }
    );
  }

  async reload(): Promise<boolean> {
    // AlertManager supports reload via POST to /-/reload
    // We need to port-forward or use the in-cluster service URL
    try {
      const response = await fetch(
        `http://alertmanager-kube-prometheus-stack-alertmanager.${this.namespace}.svc.cluster.local:9093/-/reload`,
        { method: 'POST' }
      );
      return response.ok;
    } catch (error) {
      console.error('[AlertManagerClient] Reload failed:', error);
      return false;
    }
  }
}

export const alertManagerClient = new AlertManagerClient();
```

**Step 2: Create API routes**

`apps/web/src/app/api/alertmanager/config/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { alertManagerClient } from '@/lib/prometheus/alertmanager-client';

export async function GET() {
  try {
    const config = await alertManagerClient.getConfig();
    return NextResponse.json({ config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { config } = await request.json();
    await alertManagerClient.updateConfig(config);
    // Auto-reload after config change
    const reloaded = await alertManagerClient.reload();
    return NextResponse.json({ success: true, reloaded });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

`apps/web/src/app/api/alertmanager/reload/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { alertManagerClient } from '@/lib/prometheus/alertmanager-client';

export async function POST() {
  try {
    const success = await alertManagerClient.reload();
    return NextResponse.json({ success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/prometheus/alertmanager-client.ts apps/web/src/app/api/alertmanager/
git commit -m "feat: add AlertManager config management API"
```

---

## Task 8: Add `request()` method to K8sApiClient

The PrometheusClient and AlertManagerClient need a generic request method for CRD access and patch operations.

**Files:**
- Modify: `apps/web/src/lib/cluster/k8s-api-client.ts`

**Step 1: Add the generic request method**

Add to the `K8sApiClient` class:

```typescript
async request<T = unknown>(
  path: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {}
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  const url = new URL(path, this.config.apiUrl);

  const defaultHeaders: Record<string, string> = {
    'Authorization': `Bearer ${this.config.token}`,
    'Content-Type': 'application/json',
    ...headers,
  };

  const response = await this.httpRequest(url.toString(), {
    method,
    headers: defaultHeaders,
    body,
  });

  if (!response.ok) {
    throw new Error(`K8s API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as T;
}
```

This should use the same TLS/HTTP handling as the existing methods in the class. Adapt to match the existing private HTTP method pattern.

**Step 2: Commit**

```bash
git add apps/web/src/lib/cluster/k8s-api-client.ts
git commit -m "feat: add generic request() method to K8sApiClient for CRD access"
```

---

## Task 9: Cluster Health Dashboard Component

Create the dashboard component that shows live cluster health status.

**Files:**
- Create: `apps/web/src/components/cluster/ClusterHealthBanner.tsx`
- Create: `apps/web/src/components/cluster/PodHealthTable.tsx`

**Step 1: Create ClusterHealthBanner**

A banner that sits at the top of the dashboard showing overall cluster status (green/yellow/red).

```typescript
'use client';

import { useEffect, useState } from 'react';
import type { ClusterHealthSnapshot, PodHealthIssue, NodeHealthIssue } from '@/lib/monitoring/cluster-health-watcher';

interface HealthData {
  running: boolean;
  summary: { nodes: { total: number; ready: number }; pods: { total: number; running: number } } | null;
  issues: { nodes: NodeHealthIssue[]; pods: PodHealthIssue[]; total: number };
}

export function ClusterHealthBanner() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    // Initial fetch
    fetch('/api/cluster/health/issues')
      .then(r => r.json())
      .then(setHealth)
      .catch(console.error);

    // SSE subscription
    const es = new EventSource('/api/cluster/health/issues/stream');

    es.addEventListener('snapshot', (e) => {
      const snapshot = JSON.parse(e.data);
      if (snapshot) {
        setHealth(prev => prev ? {
          ...prev,
          summary: { nodes: snapshot.nodes, pods: snapshot.pods },
          issues: {
            nodes: snapshot.nodes.issues,
            pods: snapshot.pods.issues,
            total: snapshot.nodes.issues.length + snapshot.pods.issues.length,
          },
        } : prev);
      }
    });

    es.addEventListener('podIssue', (e) => {
      const issue = JSON.parse(e.data);
      setHealth(prev => {
        if (!prev) return prev;
        const pods = [...prev.issues.pods.filter(p => p.id !== issue.id), issue];
        return { ...prev, issues: { ...prev.issues, pods, total: prev.issues.nodes.length + pods.length } };
      });
    });

    es.addEventListener('nodeIssue', (e) => {
      const issue = JSON.parse(e.data);
      setHealth(prev => {
        if (!prev) return prev;
        const nodes = [...prev.issues.nodes.filter(n => n.id !== issue.id), issue];
        return { ...prev, issues: { ...prev.issues, nodes, total: nodes.length + prev.issues.pods.length } };
      });
    });

    es.addEventListener('podIssueResolved', (e) => {
      const issue = JSON.parse(e.data);
      setHealth(prev => {
        if (!prev) return prev;
        const pods = prev.issues.pods.filter(p => p.id !== issue.id);
        return { ...prev, issues: { ...prev.issues, pods, total: prev.issues.nodes.length + pods.length } };
      });
    });

    es.addEventListener('nodeIssueResolved', (e) => {
      const issue = JSON.parse(e.data);
      setHealth(prev => {
        if (!prev) return prev;
        const nodes = prev.issues.nodes.filter(n => n.id !== issue.id);
        return { ...prev, issues: { ...prev.issues, nodes, total: nodes.length + prev.issues.pods.length } };
      });
    });

    return () => es.close();
  }, []);

  if (!health || !health.running) return null;

  const hasCritical = health.issues.nodes.some(i => i.severity === 'critical') ||
                      health.issues.pods.some(i => i.severity === 'critical');
  const hasWarning = health.issues.total > 0;

  const status = hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy';
  const colors = {
    healthy: 'bg-green-500/10 border-green-500/20 text-green-400',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    critical: 'bg-red-500/10 border-red-500/20 text-red-400',
  };

  return (
    <div className={`rounded-lg border p-3 mb-4 ${colors[status]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'healthy' ? 'bg-green-400' :
            status === 'warning' ? 'bg-yellow-400 animate-pulse' :
            'bg-red-400 animate-pulse'
          }`} />
          <span className="font-medium text-sm">
            {status === 'healthy'
              ? `Cluster healthy — ${health.summary?.nodes.ready}/${health.summary?.nodes.total} nodes, ${health.summary?.pods.running}/${health.summary?.pods.total} pods`
              : `${health.issues.total} issue${health.issues.total !== 1 ? 's' : ''} detected`}
          </span>
        </div>
        {health.issues.total > 0 && (
          <div className="text-xs opacity-75">
            {health.issues.nodes.length > 0 && `${health.issues.nodes.length} node`}
            {health.issues.nodes.length > 0 && health.issues.pods.length > 0 && ' · '}
            {health.issues.pods.length > 0 && `${health.issues.pods.length} pod`}
          </div>
        )}
      </div>
      {health.issues.total > 0 && (
        <div className="mt-2 space-y-1">
          {[...health.issues.nodes, ...health.issues.pods]
            .sort((a, b) => (a.severity === 'critical' ? -1 : 1))
            .slice(0, 5)
            .map(issue => (
              <div key={issue.id} className="text-xs opacity-90 flex items-center gap-1.5">
                <span className={issue.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}>
                  {issue.severity === 'critical' ? '●' : '○'}
                </span>
                {issue.message}
              </div>
            ))}
          {health.issues.total > 5 && (
            <div className="text-xs opacity-60">and {health.issues.total - 5} more...</div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create PodHealthTable**

A table showing pods with health issues, sortable by namespace/restarts/severity.

```typescript
'use client';

import { useEffect, useState } from 'react';
import type { PodHealthIssue } from '@/lib/monitoring/cluster-health-watcher';

export function PodHealthTable() {
  const [issues, setIssues] = useState<PodHealthIssue[]>([]);
  const [sortBy, setSortBy] = useState<'severity' | 'restarts' | 'namespace'>('severity');

  useEffect(() => {
    fetch('/api/cluster/health/issues')
      .then(r => r.json())
      .then(data => setIssues(data.issues?.pods || []))
      .catch(console.error);

    const interval = setInterval(() => {
      fetch('/api/cluster/health/issues')
        .then(r => r.json())
        .then(data => setIssues(data.issues?.pods || []))
        .catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const sorted = [...issues].sort((a, b) => {
    if (sortBy === 'severity') return a.severity === 'critical' ? -1 : 1;
    if (sortBy === 'restarts') return (b.restartCount || 0) - (a.restartCount || 0);
    return a.namespace.localeCompare(b.namespace);
  });

  if (sorted.length === 0) return null;

  const typeLabels: Record<string, string> = {
    'crash-loop': 'CrashLoopBackOff',
    'excessive-restarts': 'High Restarts',
    'stuck-unknown': 'Unknown Status',
    'stuck-pending': 'Stuck Pending',
    'error': 'Error',
  };

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-medium">Pod Health Issues ({sorted.length})</h3>
        <div className="flex gap-1">
          {(['severity', 'restarts', 'namespace'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-xs px-2 py-0.5 rounded ${sortBy === s ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500">
            <th className="text-left p-2">Namespace / Pod</th>
            <th className="text-left p-2">Type</th>
            <th className="text-left p-2">Node</th>
            <th className="text-right p-2">Restarts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(issue => (
            <tr key={issue.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="p-2">
                <div className="flex items-center gap-1.5">
                  <span className={issue.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}>●</span>
                  <div>
                    <div className="text-zinc-300">{issue.namespace}</div>
                    <div className="text-zinc-500 truncate max-w-[200px]">{issue.podName}</div>
                  </div>
                </div>
              </td>
              <td className="p-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  issue.type === 'crash-loop' ? 'bg-red-500/20 text-red-400' :
                  issue.type === 'excessive-restarts' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {typeLabels[issue.type] || issue.type}
                </span>
              </td>
              <td className="p-2 text-zinc-500">{issue.nodeName}</td>
              <td className="p-2 text-right font-mono">{issue.restartCount ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/cluster/ClusterHealthBanner.tsx apps/web/src/components/cluster/PodHealthTable.tsx
git commit -m "feat: add ClusterHealthBanner and PodHealthTable dashboard components"
```

---

## Task 10: Wire AlertManager Webhook to Control Panel

Configure AlertManager to POST alerts to the control panel webhook. This ensures Prometheus-sourced alerts also flow through our notification pipeline.

**Files:**
- Create: `apps/web/src/app/api/alertmanager/setup/route.ts`

**Step 1: Create a setup endpoint**

This endpoint configures AlertManager to include a webhook receiver pointing back to the control panel.

```typescript
import { NextResponse } from 'next/server';
import { alertManagerClient } from '@/lib/prometheus/alertmanager-client';

/**
 * POST /api/alertmanager/setup
 *
 * Adds a webhook receiver to AlertManager config that points to
 * the control panel's existing /api/webhooks/prometheus/alerts endpoint.
 * Idempotent - won't duplicate if already configured.
 */
export async function POST() {
  try {
    const config = await alertManagerClient.getConfig();

    const controlPanelUrl = process.env.NEXTAUTH_URL || 'https://control.gmac.io';
    const webhookUrl = `${controlPanelUrl}/api/webhooks/prometheus/alerts`;
    const receiverName = 'control-panel-webhook';

    // Check if receiver already exists
    const existing = config.receivers.find(r => r.name === receiverName);
    if (existing) {
      return NextResponse.json({ success: true, message: 'Already configured' });
    }

    // Add receiver
    config.receivers.push({
      name: receiverName,
      webhook_configs: [{
        url: webhookUrl,
        send_resolved: true,
      }],
    });

    // Add route to send all alerts to control panel (continue: true so other receivers still fire)
    if (!config.route.routes) config.route.routes = [];
    config.route.routes.unshift({
      receiver: receiverName,
      continue: true,
    });

    await alertManagerClient.updateConfig(config);
    const reloaded = await alertManagerClient.reload();

    return NextResponse.json({ success: true, reloaded, webhookUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/api/alertmanager/setup/route.ts
git commit -m "feat: add AlertManager setup endpoint for control panel webhook"
```

---

## Task 11: Integration - Add Banner to Main Layout

Wire the ClusterHealthBanner into the main dashboard layout so it's always visible.

**Files:**
- Modify: the main layout or dashboard page that wraps all views (find the actual file)

**Step 1: Find and modify the main layout**

Look for the root dashboard layout (likely `apps/web/src/app/layout.tsx` or `apps/web/src/app/(dashboard)/layout.tsx`). Import and add `<ClusterHealthBanner />` near the top of the page content area.

```typescript
import { ClusterHealthBanner } from '@/components/cluster/ClusterHealthBanner';

// Inside the layout's main content area, before children:
<ClusterHealthBanner />
{children}
```

**Step 2: Add PodHealthTable to the cluster page**

Find the cluster dashboard page and add `<PodHealthTable />`.

**Step 3: Commit**

```bash
git add apps/web/src/app/
git commit -m "feat: wire ClusterHealthBanner and PodHealthTable into dashboard"
```

---

## Task 12: Install yaml dependency

The AlertManager client needs the `yaml` package for parsing/stringifying YAML config.

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install**

```bash
cd apps/web && npm install yaml
```

**Step 2: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore: add yaml package for AlertManager config parsing"
```

---

## Summary of deliverables

| # | What | Files |
|---|------|-------|
| 1 | ClusterHealthWatcher service | `lib/monitoring/cluster-health-watcher.ts` |
| 2 | K8sNode/K8sPod interface extensions | `lib/cluster/k8s-api-client.ts` |
| 3 | Auto-start instrumentation | `instrumentation.ts` |
| 4 | Health issues API + SSE | `api/cluster/health/issues/` |
| 5 | Default notification rules | `lib/monitoring/seed-health-rules.ts` |
| 6 | Prometheus rule CRUD API | `lib/prometheus/prometheus-client.ts`, `api/prometheus/rules/` |
| 7 | AlertManager config API | `lib/prometheus/alertmanager-client.ts`, `api/alertmanager/` |
| 8 | K8sApiClient `request()` method | `lib/cluster/k8s-api-client.ts` |
| 9 | Dashboard components | `components/cluster/ClusterHealthBanner.tsx`, `PodHealthTable.tsx` |
| 10 | AlertManager webhook setup | `api/alertmanager/setup/` |
| 11 | Layout integration | main layout file |
| 12 | yaml dependency | `package.json` |

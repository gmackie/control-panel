/**
 * Cluster Health Watcher
 *
 * Polls Kubernetes node and pod health every 30 seconds via K8sApiClient.
 * Detects unhealthy conditions (CrashLoopBackOff, excessive restarts, stuck
 * pending, node pressure, etc.) and sends notifications through the rules engine.
 * Extends EventEmitter for real-time SSE streaming.
 */

import { EventEmitter } from "events";
import { getK8sClient, K8sPod, K8sNode } from "@/lib/cluster/k8s-api-client";
import { rulesEngine } from "@/lib/notifications/rules-engine";
import type { CreateNotification } from "@/lib/notifications/types";

// ===================================
// Exported interfaces
// ===================================

export interface PodHealthIssue {
  id: string;
  namespace: string;
  podName: string;
  nodeName: string;
  type: "crash-loop" | "excessive-restarts" | "stuck-unknown" | "stuck-pending" | "error";
  severity: "critical" | "warning";
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
  type: "unreachable" | "not-ready" | "cpu-pressure" | "memory-pressure" | "disk-pressure" | "pid-pressure";
  severity: "critical" | "warning";
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface ClusterHealthSnapshot {
  timestamp: Date;
  nodes: { total: number; ready: number; issues: NodeHealthIssue[] };
  pods: { total: number; running: number; issues: PodHealthIssue[] };
}

// ===================================
// Constants
// ===================================

const POLL_INTERVAL_MS = 30_000;
const STUCK_PENDING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const EXCESSIVE_RESTART_THRESHOLD = 5;
const MAX_SNAPSHOTS = 2880; // 24 hours at 30s intervals

// ===================================
// ClusterHealthWatcher
// ===================================

export class ClusterHealthWatcher extends EventEmitter {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private activePodIssues = new Map<string, PodHealthIssue>();
  private activeNodeIssues = new Map<string, NodeHealthIssue>();
  private snapshots: ClusterHealthSnapshot[] = [];

  constructor() {
    super();
    // Support up to 50 concurrent SSE connections (5 listeners each)
    this.setMaxListeners(50);
  }

  // ------ Public API ------

  async start(): Promise<void> {
    if (this.running) return;

    const client = getK8sClient();
    if (!client) {
      console.warn("[ClusterHealthWatcher] K8s client unavailable, cannot start");
      return;
    }

    this.running = true;

    // Run an initial poll immediately
    await this.poll();

    // Schedule recurring polls
    this.pollTimer = setInterval(() => {
      this.poll().catch((err) => {
        console.error("[ClusterHealthWatcher] poll error:", err);
      });
    }, POLL_INTERVAL_MS);

    console.log("[ClusterHealthWatcher] started (interval: 30s)");
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.running = false;
    console.log("[ClusterHealthWatcher] stopped");
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

  getSnapshots(limit?: number): ClusterHealthSnapshot[] {
    if (limit && limit > 0) {
      return this.snapshots.slice(-limit);
    }
    return [...this.snapshots];
  }

  getLatestSnapshot(): ClusterHealthSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  // ------ Core polling logic ------

  private async poll(): Promise<void> {
    const client = getK8sClient();
    if (!client) {
      console.warn("[ClusterHealthWatcher] K8s client unavailable, skipping poll");
      return;
    }

    let nodes: K8sNode[] = [];
    let pods: K8sPod[] = [];

    try {
      [nodes, pods] = await Promise.all([client.getNodes(), client.getAllPods()]);
    } catch (err) {
      console.error("[ClusterHealthWatcher] failed to fetch cluster data:", err);
      return;
    }

    const now = new Date();
    const currentPodIssueIds = new Set<string>();
    const currentNodeIssueIds = new Set<string>();

    // ---- Detect pod issues ----
    for (const pod of pods) {
      // Skip completed jobs
      if (pod.status.phase === "Succeeded") continue;

      const ns = pod.metadata.namespace;
      const podName = pod.metadata.name;
      const nodeName = pod.spec.nodeName || "unassigned";

      // Check Failed phase
      if (pod.status.phase === "Failed") {
        const id = `pod-${ns}-${podName}-failed`;
        currentPodIssueIds.add(id);
        this.upsertPodIssue({
          id,
          namespace: ns,
          podName,
          nodeName,
          type: "error",
          severity: "warning",
          message: `Pod ${ns}/${podName} is in Failed state`,
          timestamp: now,
          resolved: false,
        });
      }

      // Check Unknown phase
      if (pod.status.phase === "Unknown") {
        const id = `pod-${ns}-${podName}-unknown`;
        currentPodIssueIds.add(id);
        this.upsertPodIssue({
          id,
          namespace: ns,
          podName,
          nodeName,
          type: "stuck-unknown",
          severity: "warning",
          message: `Pod ${ns}/${podName} is in Unknown state`,
          timestamp: now,
          resolved: false,
        });
      }

      // Check Stuck Pending
      if (pod.status.phase === "Pending" && pod.status.startTime) {
        const startTime = new Date(pod.status.startTime).getTime();
        if (now.getTime() - startTime > STUCK_PENDING_THRESHOLD_MS) {
          const id = `pod-${ns}-${podName}-stuck-pending`;
          currentPodIssueIds.add(id);
          this.upsertPodIssue({
            id,
            namespace: ns,
            podName,
            nodeName,
            type: "stuck-pending",
            severity: "warning",
            message: `Pod ${ns}/${podName} has been Pending for over 5 minutes`,
            timestamp: now,
            resolved: false,
          });
        }
      }

      // Check container statuses
      if (pod.status.containerStatuses) {
        for (const cs of pod.status.containerStatuses) {
          // CrashLoopBackOff
          if (cs.state.waiting?.reason === "CrashLoopBackOff") {
            const id = `pod-${ns}-${podName}-${cs.name}-crashloop`;
            currentPodIssueIds.add(id);
            this.upsertPodIssue({
              id,
              namespace: ns,
              podName,
              nodeName,
              type: "crash-loop",
              severity: "critical",
              message: `Container ${cs.name} in ${ns}/${podName} is in CrashLoopBackOff (restarts: ${cs.restartCount})`,
              containerName: cs.name,
              restartCount: cs.restartCount,
              timestamp: now,
              resolved: false,
            });
            continue; // Don't also flag excessive restarts for CrashLoopBackOff
          }

          // ContainerStatusUnknown (waiting or terminated reason)
          const waitingReason = cs.state.waiting?.reason || "";
          const terminatedReason = cs.state.terminated?.reason || "";
          if (
            waitingReason.includes("ContainerStatusUnknown") ||
            terminatedReason.includes("ContainerStatusUnknown")
          ) {
            const id = `pod-${ns}-${podName}-${cs.name}-statusunknown`;
            currentPodIssueIds.add(id);
            this.upsertPodIssue({
              id,
              namespace: ns,
              podName,
              nodeName,
              type: "stuck-unknown",
              severity: "warning",
              message: `Container ${cs.name} in ${ns}/${podName} has ContainerStatusUnknown`,
              containerName: cs.name,
              timestamp: now,
              resolved: false,
            });
          }

          // Excessive restarts (and not already CrashLoopBackOff)
          if (cs.restartCount >= EXCESSIVE_RESTART_THRESHOLD) {
            const id = `pod-${ns}-${podName}-${cs.name}-excessive-restarts`;
            currentPodIssueIds.add(id);
            this.upsertPodIssue({
              id,
              namespace: ns,
              podName,
              nodeName,
              type: "excessive-restarts",
              severity: "warning",
              message: `Container ${cs.name} in ${ns}/${podName} has restarted ${cs.restartCount} times`,
              containerName: cs.name,
              restartCount: cs.restartCount,
              timestamp: now,
              resolved: false,
            });
          }
        }
      }
    }

    // ---- Detect node issues ----
    for (const node of nodes) {
      const nodeName = node.metadata.name;
      const conditions = node.status.conditions || [];

      // Find Ready condition
      const readyCondition = conditions.find((c) => c.type === "Ready");
      if (readyCondition) {
        if (readyCondition.status === "Unknown") {
          const id = `node-${nodeName}-unreachable`;
          currentNodeIssueIds.add(id);
          this.upsertNodeIssue({
            id,
            nodeName,
            type: "unreachable",
            severity: "critical",
            message: `Node ${nodeName} is unreachable (Ready status Unknown)${readyCondition.message ? `: ${readyCondition.message}` : ""}`,
            timestamp: now,
            resolved: false,
          });
        } else if (readyCondition.status !== "True") {
          const id = `node-${nodeName}-not-ready`;
          currentNodeIssueIds.add(id);
          this.upsertNodeIssue({
            id,
            nodeName,
            type: "not-ready",
            severity: "critical",
            message: `Node ${nodeName} is NotReady${readyCondition.reason ? ` (${readyCondition.reason})` : ""}`,
            timestamp: now,
            resolved: false,
          });
        }
      }

      // Pressure conditions
      const pressureChecks: Array<{
        conditionType: string;
        issueType: NodeHealthIssue["type"];
        label: string;
      }> = [
        { conditionType: "MemoryPressure", issueType: "memory-pressure", label: "memory pressure" },
        { conditionType: "DiskPressure", issueType: "disk-pressure", label: "disk pressure" },
        { conditionType: "PIDPressure", issueType: "pid-pressure", label: "PID pressure" },
      ];

      for (const check of pressureChecks) {
        const cond = conditions.find((c) => c.type === check.conditionType);
        if (cond && cond.status === "True") {
          const id = `node-${nodeName}-${check.issueType}`;
          currentNodeIssueIds.add(id);
          this.upsertNodeIssue({
            id,
            nodeName,
            type: check.issueType,
            severity: "critical",
            message: `Node ${nodeName} has ${check.label}${cond.message ? `: ${cond.message}` : ""}`,
            timestamp: now,
            resolved: false,
          });
        }
      }
    }

    // ---- Resolve cleared issues ----
    for (const [id, issue] of this.activePodIssues) {
      if (!currentPodIssueIds.has(id)) {
        issue.resolved = true;
        issue.resolvedAt = now;
        this.activePodIssues.delete(id);
        this.emit("podIssueResolved", issue);
        this.sendResolutionNotification(issue).catch((err) => {
          console.error("[ClusterHealthWatcher] resolution notification error:", err);
        });
      }
    }

    for (const [id, issue] of this.activeNodeIssues) {
      if (!currentNodeIssueIds.has(id)) {
        issue.resolved = true;
        issue.resolvedAt = now;
        this.activeNodeIssues.delete(id);
        this.emit("nodeIssueResolved", issue);
        this.sendResolutionNotification(issue).catch((err) => {
          console.error("[ClusterHealthWatcher] resolution notification error:", err);
        });
      }
    }

    // ---- Build and store snapshot ----
    const readyNodes = nodes.filter((n) => {
      const ready = (n.status.conditions || []).find((c) => c.type === "Ready");
      return ready?.status === "True";
    });

    const runningPods = pods.filter(
      (p) => p.status.phase === "Running" || p.status.phase === "Succeeded"
    );

    const snapshot: ClusterHealthSnapshot = {
      timestamp: now,
      nodes: {
        total: nodes.length,
        ready: readyNodes.length,
        issues: Array.from(this.activeNodeIssues.values()),
      },
      pods: {
        total: pods.length,
        running: runningPods.length,
        issues: Array.from(this.activePodIssues.values()),
      },
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
    }

    this.emit("snapshot", snapshot);
  }

  // ------ Issue upsert helpers ------

  private upsertPodIssue(issue: PodHealthIssue): void {
    const existing = this.activePodIssues.has(issue.id);
    if (!existing) {
      // New issue - store and notify
      this.activePodIssues.set(issue.id, issue);
      this.emit("podIssue", issue);
      this.sendIssueNotification(issue).catch((err) => {
        console.error("[ClusterHealthWatcher] notification error:", err);
      });
    }
    // If already tracked, do nothing (deduplication)
  }

  private upsertNodeIssue(issue: NodeHealthIssue): void {
    const existing = this.activeNodeIssues.has(issue.id);
    if (!existing) {
      this.activeNodeIssues.set(issue.id, issue);
      this.emit("nodeIssue", issue);
      this.sendIssueNotification(issue).catch((err) => {
        console.error("[ClusterHealthWatcher] notification error:", err);
      });
    }
  }

  // ------ Notification helpers ------

  private async sendIssueNotification(issue: PodHealthIssue | NodeHealthIssue): Promise<void> {
    const isPod = "podName" in issue;
    const notification: CreateNotification = {
      source: "cluster-health-watcher",
      category: "infrastructure",
      severity: issue.severity,
      title: isPod
        ? `Pod Issue: ${(issue as PodHealthIssue).type} in ${(issue as PodHealthIssue).namespace}/${(issue as PodHealthIssue).podName}`
        : `Node Issue: ${(issue as NodeHealthIssue).type} on ${(issue as NodeHealthIssue).nodeName}`,
      message: issue.message,
      groupKey: issue.id,
      metadata: {
        issueId: issue.id,
        issueType: issue.type,
        ...(isPod
          ? {
              namespace: (issue as PodHealthIssue).namespace,
              podName: (issue as PodHealthIssue).podName,
              nodeName: (issue as PodHealthIssue).nodeName,
              containerName: (issue as PodHealthIssue).containerName,
              restartCount: (issue as PodHealthIssue).restartCount,
            }
          : {
              nodeName: (issue as NodeHealthIssue).nodeName,
            }),
      },
    };

    try {
      await rulesEngine.process(notification);
    } catch (err) {
      console.error("[ClusterHealthWatcher] rulesEngine.process failed:", err);
    }
  }

  private async sendResolutionNotification(issue: PodHealthIssue | NodeHealthIssue): Promise<void> {
    const isPod = "podName" in issue;
    const notification: CreateNotification = {
      source: "cluster-health-watcher",
      category: "infrastructure",
      severity: "info",
      title: isPod
        ? `Resolved: ${(issue as PodHealthIssue).type} in ${(issue as PodHealthIssue).namespace}/${(issue as PodHealthIssue).podName}`
        : `Resolved: ${(issue as NodeHealthIssue).type} on ${(issue as NodeHealthIssue).nodeName}`,
      message: `Issue resolved: ${issue.message}`,
      groupKey: `${issue.id}-resolved`,
      metadata: {
        issueId: issue.id,
        issueType: issue.type,
        resolved: true,
        resolvedAt: issue.resolvedAt?.toISOString(),
      },
    };

    try {
      await rulesEngine.process(notification);
    } catch (err) {
      console.error("[ClusterHealthWatcher] rulesEngine.process (resolution) failed:", err);
    }
  }
}

// ===================================
// Singleton
// ===================================

let instance: ClusterHealthWatcher | null = null;

export function getClusterHealthWatcher(): ClusterHealthWatcher {
  if (!instance) {
    instance = new ClusterHealthWatcher();
  }
  return instance;
}

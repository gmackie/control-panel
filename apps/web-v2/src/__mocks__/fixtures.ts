import type { AppSummary } from "@/types/app";
import type {
  MultiClusterNode,
  MultiClusterPod,
  MultiClusterDeployment,
  ClusterHealthSummary,
} from "@/types/k8s";
import type { DeploymentJourney, PipelineStep } from "@/types/pipeline";
import type { TimelineEvent } from "@/components/pipeline/deploy-timeline";
import type { ActiveRelease, ReleaseQueueItem } from "@/types/release";
import type { HealthMetric } from "@/components/monitoring/health-overview-strip";
import type { AlertEvent } from "@/components/monitoring/alert-timeline";
import type { AppHealthItem } from "@/components/monitoring/app-health-grid";

// ── App Fixtures ──────────────────────────────────────────────

export const healthyApp: AppSummary = {
  id: "app-1",
  name: "control-panel",
  slug: "control-panel",
  gitProvider: "gitea",
  deployProviders: ["k8s"],
  branch: "main",
  latestCommit: {
    sha: "f57fb6f3a2b1c4d5e6f7890abcdef1234567890",
    message: "fix: update deploy script for podman",
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  environments: [
    {
      name: "production",
      provider: "k8s",
      status: "healthy",
      podCount: { ready: 2, total: 2 },
      version: "v1.4.2",
    },
    {
      name: "staging",
      provider: "k8s",
      status: "healthy",
      podCount: { ready: 1, total: 1 },
      version: "v1.5.0-rc.1",
    },
  ],
  metrics: {
    cpuPercent: 23,
    memPercent: 45,
    errorRate: 0.1,
    p95Latency: 142,
  },
  status: "healthy",
};

export const degradedApp: AppSummary = {
  id: "app-2",
  name: "gmac-web",
  slug: "gmac-web",
  gitProvider: "gitea",
  deployProviders: ["k8s", "vercel"],
  branch: "main",
  latestCommit: {
    sha: "a1b2c3d4e5f6789012345678abcdef1234567890",
    message: "feat: add billing dashboard",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  environments: [
    {
      name: "production",
      provider: "k8s",
      status: "degraded",
      podCount: { ready: 1, total: 2 },
      version: "v2.1.0",
    },
    {
      name: "preview",
      provider: "vercel",
      status: "healthy",
      vercelStatus: "Ready",
    },
  ],
  metrics: {
    cpuPercent: 67,
    memPercent: 78,
    errorRate: 2.3,
    p95Latency: 340,
  },
  status: "degraded",
};

export const unhealthyApp: AppSummary = {
  id: "app-3",
  name: "api-gateway",
  slug: "api-gateway",
  gitProvider: "github",
  deployProviders: ["k8s"],
  branch: "main",
  latestCommit: {
    sha: "deadbeef1234567890abcdef1234567890abcdef",
    message: "hotfix: fix OOM on large payloads",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  environments: [
    {
      name: "production",
      provider: "k8s",
      status: "unhealthy",
      podCount: { ready: 0, total: 3 },
      version: "v3.0.1",
    },
  ],
  metrics: {
    cpuPercent: 95,
    memPercent: 92,
    errorRate: 12.5,
    p95Latency: 2400,
  },
  status: "unhealthy",
};

export const minimalApp: AppSummary = {
  id: "app-4",
  name: "docs-site",
  slug: "docs-site",
  gitProvider: "github",
  deployProviders: ["vercel"],
  branch: "main",
  environments: [
    {
      name: "production",
      provider: "vercel",
      status: "healthy",
      vercelStatus: "Ready",
    },
  ],
  status: "healthy",
};

export const allApps: AppSummary[] = [
  healthyApp,
  degradedApp,
  unhealthyApp,
  minimalApp,
];

// ── K8s Fixtures ──────────────────────────────────────────────

export const mockNodes: MultiClusterNode[] = [
  {
    clusterId: "production",
    clusterName: "Production",
    name: "k3s-master-1",
    status: "Ready",
    roles: ["control-plane", "master"],
    internalIP: "10.0.0.1",
    kubeletVersion: "v1.28.4+k3s1",
    os: "linux",
    arch: "amd64",
    containerRuntime: "containerd://1.7.11",
    cpu: { capacityMillis: 4000, allocatableMillis: 3800, usageMillis: 1200 },
    memory: {
      capacityBytes: 8_589_934_592,
      allocatableBytes: 7_516_192_768,
      usageBytes: 3_221_225_472,
    },
    pods: { capacity: 110, running: 24 },
    conditions: [],
  },
  {
    clusterId: "production",
    clusterName: "Production",
    name: "k3s-worker-1",
    status: "Ready",
    roles: ["worker"],
    internalIP: "10.0.0.2",
    kubeletVersion: "v1.28.4+k3s1",
    os: "linux",
    arch: "amd64",
    containerRuntime: "containerd://1.7.11",
    cpu: { capacityMillis: 4000, allocatableMillis: 3800, usageMillis: 2800 },
    memory: {
      capacityBytes: 8_589_934_592,
      allocatableBytes: 7_516_192_768,
      usageBytes: 5_905_580_032,
    },
    pods: { capacity: 110, running: 38 },
    conditions: [],
  },
  {
    clusterId: "staging",
    clusterName: "Staging",
    name: "labnuc",
    status: "Ready",
    roles: ["control-plane", "master"],
    internalIP: "192.168.0.204",
    kubeletVersion: "v1.28.2+k3s1",
    os: "linux",
    arch: "amd64",
    containerRuntime: "containerd://1.7.7",
    cpu: { capacityMillis: 8000, allocatableMillis: 7600, usageMillis: 900 },
    memory: {
      capacityBytes: 16_106_127_360,
      allocatableBytes: 15_032_385_536,
      usageBytes: 4_294_967_296,
    },
    pods: { capacity: 110, running: 12 },
    conditions: [],
  },
];

export const mockPods: MultiClusterPod[] = [
  {
    clusterId: "production",
    clusterName: "Production",
    namespace: "default",
    name: "control-panel-7f8b9c4d5-xk2j9",
    status: "Running",
    ready: "1/1",
    restarts: 0,
    nodeName: "k3s-worker-1",
    ip: "10.42.1.45",
    containers: [
      {
        name: "control-panel",
        image: "harbor.gmac.io/library/control-panel:latest",
        ready: true,
        restartCount: 0,
        state: "running",
      },
    ],
  },
  {
    clusterId: "production",
    clusterName: "Production",
    namespace: "default",
    name: "control-panel-7f8b9c4d5-m3n7p",
    status: "Running",
    ready: "1/1",
    restarts: 1,
    nodeName: "k3s-worker-1",
    ip: "10.42.1.46",
    containers: [
      {
        name: "control-panel",
        image: "harbor.gmac.io/library/control-panel:latest",
        ready: true,
        restartCount: 1,
        state: "running",
      },
    ],
  },
  {
    clusterId: "production",
    clusterName: "Production",
    namespace: "default",
    name: "api-gateway-6a5b4c3d2-q8r7s",
    status: "Failed",
    ready: "0/1",
    restarts: 5,
    nodeName: "k3s-worker-1",
    ip: "10.42.1.50",
    containers: [
      {
        name: "api-gateway",
        image: "harbor.gmac.io/library/api-gateway:v3.0.1",
        ready: false,
        restartCount: 5,
        state: "waiting",
      },
    ],
  },
  {
    clusterId: "staging",
    clusterName: "Staging",
    namespace: "default",
    name: "control-panel-5e4d3c2b1-a9b8c",
    status: "Running",
    ready: "1/1",
    restarts: 0,
    nodeName: "labnuc",
    ip: "10.42.0.22",
    containers: [
      {
        name: "control-panel",
        image: "harbor.gmac.io/library/control-panel:v1.5.0-rc.1",
        ready: true,
        restartCount: 0,
        state: "running",
      },
    ],
  },
  {
    clusterId: "staging",
    clusterName: "Staging",
    namespace: "default",
    name: "gmac-web-8f7e6d5c4-p2q1r",
    status: "Pending",
    ready: "0/1",
    restarts: 0,
    nodeName: "labnuc",
    ip: "10.42.0.23",
    containers: [
      {
        name: "gmac-web",
        image: "harbor.gmac.io/library/gmac-web:latest",
        ready: false,
        restartCount: 0,
        state: "waiting",
      },
    ],
  },
];

export const mockDeployments: MultiClusterDeployment[] = [
  {
    clusterId: "production",
    clusterName: "Production",
    namespace: "default",
    name: "control-panel",
    replicas: 2,
    readyReplicas: 2,
    updatedReplicas: 2,
    availableReplicas: 2,
    strategy: "RollingUpdate",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    clusterId: "production",
    clusterName: "Production",
    namespace: "default",
    name: "api-gateway",
    replicas: 3,
    readyReplicas: 0,
    updatedReplicas: 3,
    availableReplicas: 0,
    strategy: "RollingUpdate",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
  {
    clusterId: "staging",
    clusterName: "Staging",
    namespace: "default",
    name: "control-panel",
    replicas: 1,
    readyReplicas: 1,
    updatedReplicas: 1,
    availableReplicas: 1,
    strategy: "RollingUpdate",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
  },
];

export const mockClusterHealth: ClusterHealthSummary = {
  clusters: [
    {
      id: "production",
      name: "Production",
      endpoint: "https://5.78.106.236:6443",
      reachable: true,
      totalNodes: 2,
      readyNodes: 2,
    },
    {
      id: "staging",
      name: "Staging",
      endpoint: "https://192.168.0.204:6443",
      reachable: true,
      totalNodes: 1,
      readyNodes: 1,
    },
  ],
  totalClusters: 2,
  healthyClusters: 2,
  totalNodes: 3,
  readyNodes: 3,
};

export const mockClusterHealthDegraded: ClusterHealthSummary = {
  ...mockClusterHealth,
  clusters: [
    {
      ...mockClusterHealth.clusters[0],
      readyNodes: 1,
    },
    mockClusterHealth.clusters[1],
  ],
  healthyClusters: 1,
  readyNodes: 2,
};

// ── Pipeline Fixtures ─────────────────────────────────────────

const now = Date.now();

export const successfulSteps: PipelineStep[] = [
  { stage: "commit", status: "success", startedAt: new Date(now - 300000).toISOString(), completedAt: new Date(now - 300000).toISOString() },
  { stage: "build", status: "success", startedAt: new Date(now - 299000).toISOString(), completedAt: new Date(now - 172000).toISOString(), durationMs: 127000 },
  { stage: "test", status: "success", startedAt: new Date(now - 172000).toISOString(), completedAt: new Date(now - 127000).toISOString(), durationMs: 45000 },
  { stage: "deploy", status: "success", startedAt: new Date(now - 127000).toISOString(), completedAt: new Date(now - 102000).toISOString(), durationMs: 25000 },
  { stage: "verify", status: "success", startedAt: new Date(now - 102000).toISOString(), completedAt: new Date(now - 87000).toISOString(), durationMs: 15000 },
];

export const deployingSteps: PipelineStep[] = [
  { stage: "commit", status: "success" },
  { stage: "build", status: "success", durationMs: 127000 },
  { stage: "test", status: "success", durationMs: 45000 },
  { stage: "deploy", status: "running", startedAt: new Date(now - 25000).toISOString() },
  { stage: "verify", status: "pending" },
];

export const failedSteps: PipelineStep[] = [
  { stage: "commit", status: "success" },
  { stage: "build", status: "success", durationMs: 130000 },
  { stage: "test", status: "failed", durationMs: 12000, message: "3 tests failed: auth.test.ts, billing.test.ts, api.test.ts" },
  { stage: "deploy", status: "skipped" },
  { stage: "verify", status: "skipped" },
];

export const buildingSteps: PipelineStep[] = [
  { stage: "commit", status: "success" },
  { stage: "build", status: "running", startedAt: new Date(now - 45000).toISOString() },
  { stage: "test", status: "pending" },
  { stage: "deploy", status: "pending" },
  { stage: "verify", status: "pending" },
];

export const pendingSteps: PipelineStep[] = [
  { stage: "commit", status: "success" },
  { stage: "build", status: "pending" },
  { stage: "test", status: "pending" },
  { stage: "deploy", status: "pending" },
  { stage: "verify", status: "pending" },
];

export const mockJourneyHealthy: DeploymentJourney = {
  id: "deploy-1",
  appId: "app-1",
  appName: "control-panel",
  appSlug: "control-panel",
  environment: "production",
  commitSha: "f57fb6f3a2b1c4d5e6f7890abcdef1234567890",
  commitMessage: "fix: update deploy script for podman",
  branch: "main",
  triggeredBy: "ci/gitea",
  startedAt: new Date(now - 300000).toISOString(),
  completedAt: new Date(now - 87000).toISOString(),
  status: "healthy",
  currentStage: "verify",
  steps: successfulSteps,
};

export const mockJourneyDeploying: DeploymentJourney = {
  id: "deploy-2",
  appId: "app-2",
  appName: "gmac-web",
  appSlug: "gmac-web",
  environment: "production",
  commitSha: "a1b2c3d4e5f6789012345678abcdef1234567890",
  commitMessage: "feat: add billing dashboard",
  branch: "main",
  triggeredBy: "ci/gitea",
  startedAt: new Date(now - 200000).toISOString(),
  status: "deploying",
  currentStage: "deploy",
  steps: deployingSteps,
};

export const mockJourneyFailed: DeploymentJourney = {
  id: "deploy-3",
  appId: "app-3",
  appName: "api-gateway",
  appSlug: "api-gateway",
  environment: "staging",
  commitSha: "deadbeef1234567890abcdef1234567890abcdef",
  commitMessage: "hotfix: fix OOM on large payloads",
  branch: "main",
  triggeredBy: "manual",
  startedAt: new Date(now - 180000).toISOString(),
  status: "failed",
  currentStage: "test",
  steps: failedSteps,
};

export const mockJourneyStaging: DeploymentJourney = {
  id: "deploy-4",
  appId: "app-1",
  appName: "control-panel",
  appSlug: "control-panel",
  environment: "staging",
  commitSha: "abc1234567890abcdef1234567890abcdef123456",
  commitMessage: "feat: add release control room",
  branch: "feature/releases",
  triggeredBy: "ci/gitea",
  startedAt: new Date(now - 60000).toISOString(),
  status: "building",
  currentStage: "build",
  steps: buildingSteps,
};

export const mockTimelineEvents: TimelineEvent[] = [
  { id: "1", timestamp: new Date(now - 300000).toISOString(), status: "success", title: "Commit pushed", detail: 'f57fb6f "fix: update deploy script for podman"' },
  { id: "2", timestamp: new Date(now - 299000).toISOString(), status: "success", title: "Build started", detail: "Gitea Actions #142" },
  { id: "3", timestamp: new Date(now - 172000).toISOString(), status: "success", title: "Build succeeded", duration: "2m 7s" },
  { id: "4", timestamp: new Date(now - 172000).toISOString(), status: "success", title: "Tests started", detail: "12 suites" },
  { id: "5", timestamp: new Date(now - 127000).toISOString(), status: "success", title: "Tests passed", duration: "45s", detail: "47/47 passed" },
  { id: "6", timestamp: new Date(now - 127000).toISOString(), status: "success", title: "Deploy started", detail: "production, 2 replicas" },
  { id: "7", timestamp: new Date(now - 102000).toISOString(), status: "success", title: "Deploy succeeded", duration: "25s" },
  { id: "8", timestamp: new Date(now - 102000).toISOString(), status: "success", title: "Verification started", detail: "health checks" },
  { id: "9", timestamp: new Date(now - 87000).toISOString(), status: "success", title: "Verification passed", duration: "15s", detail: "all endpoints healthy" },
];

export const mockTimelineWithFailure: TimelineEvent[] = [
  { id: "1", timestamp: new Date(now - 180000).toISOString(), status: "success", title: "Commit pushed", detail: 'deadbeef "hotfix: fix OOM on large payloads"' },
  { id: "2", timestamp: new Date(now - 179000).toISOString(), status: "success", title: "Build started", detail: "Gitea Actions #143" },
  { id: "3", timestamp: new Date(now - 49000).toISOString(), status: "success", title: "Build succeeded", duration: "2m 10s" },
  { id: "4", timestamp: new Date(now - 49000).toISOString(), status: "success", title: "Tests started", detail: "12 suites" },
  { id: "5", timestamp: new Date(now - 37000).toISOString(), status: "failed", title: "Tests failed", duration: "12s", detail: "3 tests failed", expandable: true, expandedContent: "FAIL auth.test.ts\n  ✕ should validate JWT token (12ms)\n  ✕ should refresh expired token (8ms)\n\nFAIL billing.test.ts\n  ✕ should calculate pro-rated amount (3ms)" },
];

export const mockSparklineData = [12, 15, 14, 18, 22, 19, 16, 20, 25, 23, 21, 18, 15, 17, 20, 22, 24, 21, 19, 23, 26, 24, 22, 20];

// ── Release Fixtures ──────────────────────────────────────────

export const mockActiveReleases: ActiveRelease[] = [
  {
    id: "rel-1",
    type: "release",
    appName: "control-panel",
    appSlug: "control-panel",
    version: "v1.4.2",
    environment: "production",
    status: "deploying",
    steps: deployingSteps,
    currentStage: "deploy",
    startedAt: new Date(now - 120000).toISOString(),
    elapsedMs: 120000,
    triggeredBy: "ci/gitea",
    requiresApproval: false,
    commitSha: "f57fb6f",
  },
  {
    id: "rel-2",
    type: "candidate",
    appName: "gmac-web",
    appSlug: "gmac-web",
    version: "v2.1.0",
    environment: "production",
    status: "pending_approval",
    steps: [
      { stage: "commit", status: "success" },
      { stage: "build", status: "success", durationMs: 95000 },
      { stage: "test", status: "success", durationMs: 38000 },
      { stage: "deploy", status: "pending" },
      { stage: "verify", status: "pending" },
    ],
    currentStage: "test",
    startedAt: new Date(now - 300000).toISOString(),
    elapsedMs: 300000,
    triggeredBy: "ci/gitea",
    requiresApproval: true,
    commitSha: "a1b2c3d",
  },
  {
    id: "rel-3",
    type: "candidate",
    appName: "api-gateway",
    appSlug: "api-gateway",
    version: "abc1234",
    environment: "staging",
    status: "building",
    steps: buildingSteps,
    currentStage: "build",
    startedAt: new Date(now - 45000).toISOString(),
    elapsedMs: 45000,
    triggeredBy: "ci/gitea",
    requiresApproval: false,
    commitSha: "abc1234",
  },
];

export const mockReleaseQueue: ReleaseQueueItem[] = [
  {
    id: "rq-1",
    type: "release",
    appName: "control-panel",
    appSlug: "control-panel",
    version: "v1.4.2",
    environment: "production",
    status: "deploying",
    steps: deployingSteps,
    triggeredBy: "ci/gitea",
    startedAt: new Date(now - 120000).toISOString(),
  },
  {
    id: "rq-2",
    type: "release",
    appName: "gmac-web",
    appSlug: "gmac-web",
    version: "v2.1.0",
    environment: "staging",
    status: "healthy",
    steps: successfulSteps,
    triggeredBy: "ci/gitea",
    startedAt: new Date(now - 600000).toISOString(),
    completedAt: new Date(now - 390000).toISOString(),
    durationMs: 210000,
  },
  {
    id: "rq-3",
    type: "deploy",
    appName: "api-gateway",
    appSlug: "api-gateway",
    version: "abc1234",
    environment: "staging",
    status: "building",
    steps: buildingSteps,
    triggeredBy: "ci/gitea",
    startedAt: new Date(now - 45000).toISOString(),
  },
  {
    id: "rq-4",
    type: "deploy",
    appName: "docs-site",
    appSlug: "docs-site",
    version: "d5e6f7a",
    environment: "production",
    status: "healthy",
    steps: successfulSteps,
    triggeredBy: "ci/gitea",
    startedAt: new Date(now - 3600000).toISOString(),
    completedAt: new Date(now - 3420000).toISOString(),
    durationMs: 180000,
  },
];

export const mockReleaseHistory: ReleaseQueueItem[] = [
  {
    id: "rh-1",
    type: "release",
    appName: "control-panel",
    appSlug: "control-panel",
    version: "v1.4.1",
    environment: "production",
    status: "healthy",
    steps: successfulSteps,
    triggeredBy: "ci/gitea",
    startedAt: new Date(now - 86400000).toISOString(),
    completedAt: new Date(now - 86200000).toISOString(),
    durationMs: 200000,
    impact: {
      errorRate: { current: 0.1, previous: 0.3 },
      latency: { current: 135, previous: 148 },
    },
  },
  {
    id: "rh-2",
    type: "release",
    appName: "gmac-web",
    appSlug: "gmac-web",
    version: "v2.0.0",
    environment: "production",
    status: "rolled_back",
    steps: failedSteps,
    triggeredBy: "ci/gitea",
    startedAt: new Date(now - 172800000).toISOString(),
    completedAt: new Date(now - 172600000).toISOString(),
    durationMs: 200000,
    impact: {
      errorRate: { current: 8.5, previous: 0.2 },
      latency: { current: 1200, previous: 142 },
    },
  },
  {
    id: "rh-3",
    type: "release",
    appName: "api-gateway",
    appSlug: "api-gateway",
    version: "v3.0.0",
    environment: "production",
    status: "healthy",
    steps: successfulSteps,
    triggeredBy: "manual",
    startedAt: new Date(now - 259200000).toISOString(),
    completedAt: new Date(now - 259000000).toISOString(),
    durationMs: 200000,
    impact: {
      errorRate: { current: 0.05, previous: 0.08 },
      latency: { current: 98, previous: 105 },
    },
  },
  {
    id: "rh-4",
    type: "deploy",
    appName: "control-panel",
    appSlug: "control-panel",
    version: "v1.4.0",
    environment: "production",
    status: "healthy",
    steps: successfulSteps,
    triggeredBy: "ci/gitea",
    startedAt: new Date(now - 604800000).toISOString(),
    completedAt: new Date(now - 604600000).toISOString(),
    durationMs: 200000,
    impact: {
      errorRate: { current: 0.2, previous: 0.2 },
      latency: { current: 140, previous: 142 },
    },
  },
];

// ── Monitoring Fixtures ───────────────────────────────────────

export const mockHealthMetrics: HealthMetric[] = [
  { label: "Error Rate", value: "0.3%", delta: { change: -12 }, data: [0.5, 0.4, 0.6, 0.3, 0.5, 0.2, 0.4, 0.3, 0.5, 0.4, 0.3, 0.2, 0.3, 0.4, 0.3, 0.2, 0.3, 0.4, 0.3, 0.2, 0.3, 0.4, 0.3, 0.3] },
  { label: "P95 Latency", value: "142ms", delta: { change: -8 }, data: [150, 145, 148, 155, 142, 138, 145, 142, 140, 135, 142, 148, 145, 140, 142, 138, 140, 142, 145, 140, 138, 142, 140, 142] },
  { label: "Active Alerts", value: "2 firing", data: [1, 1, 2, 1, 0, 1, 2, 3, 2, 1, 1, 2] },
  { label: "Deploy Rate", value: "3 today", data: [2, 1, 3, 0, 2, 4, 3] },
  { label: "Uptime", value: "99.97%", delta: { change: 0.02 }, data: [99.9, 99.95, 99.97, 99.95, 99.99, 99.97, 99.98, 99.97] },
];

export const mockAlertEvents: AlertEvent[] = [
  { id: "a1", timestamp: new Date(now - 300000).toISOString(), severity: "critical", status: "firing", message: "Pod CrashLoopBackOff: api-gateway-6a5b4c3d2-q8r7s", source: "kubernetes", app: "api-gateway", environment: "production" },
  { id: "a2", timestamp: new Date(now - 600000).toISOString(), severity: "warning", status: "firing", message: "Memory usage 78% on k3s-worker-1", source: "prometheus", environment: "production" },
  { id: "a3", timestamp: new Date(now - 900000).toISOString(), severity: "info", status: "firing", message: "12 new errors since deploy", source: "sentry", app: "gmac-web", deployCorrelation: "v2.1.0", externalUrl: "https://sentry.io" },
  { id: "a4", timestamp: new Date(now - 1800000).toISOString(), severity: "warning", status: "acknowledged", message: "SSL certificate expires in 14 days", source: "certmanager" },
  { id: "a5", timestamp: new Date(now - 3600000).toISOString(), severity: "info", status: "resolved", message: "High latency on /api/checkout (resolved)", source: "prometheus", app: "gmac-web", environment: "production" },
  { id: "a6", timestamp: new Date(now - 7200000).toISOString(), severity: "critical", status: "resolved", message: "Node k3s-worker-1 NotReady (resolved)", source: "kubernetes", environment: "production" },
];

export const mockAppHealth: AppHealthItem[] = [
  { id: "app-1", name: "control-panel", slug: "control-panel", status: "healthy", errorRate: 0.1, latencyMs: 135, activeAlerts: 0, lastDeploy: { version: "v1.4.2", time: "12 min ago" } },
  { id: "app-2", name: "gmac-web", slug: "gmac-web", status: "degraded", errorRate: 2.3, latencyMs: 340, activeAlerts: 1, lastDeploy: { version: "v2.1.0", time: "45 min ago" } },
  { id: "app-3", name: "api-gateway", slug: "api-gateway", status: "unhealthy", errorRate: 12.5, latencyMs: 2400, activeAlerts: 2, lastDeploy: { version: "v3.0.1", time: "5 min ago" } },
  { id: "app-4", name: "docs-site", slug: "docs-site", status: "healthy", errorRate: 0, latencyMs: 45, activeAlerts: 0, lastDeploy: { version: "d5e6f7a", time: "1 hr ago" } },
  { id: "app-5", name: "billing-service", slug: "billing-service", status: "healthy", errorRate: 0.05, latencyMs: 98, activeAlerts: 0, lastDeploy: { version: "v1.2.0", time: "3 days ago" } },
  { id: "app-6", name: "auth-proxy", slug: "auth-proxy", status: "unknown", activeAlerts: 0 },
];

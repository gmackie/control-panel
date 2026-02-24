export type ClusterId = "production" | "staging";

export interface MultiClusterNode {
  clusterId: ClusterId;
  clusterName: string;
  name: string;
  status: "Ready" | "NotReady" | "Unknown";
  roles: string[];
  internalIP: string;
  externalIP?: string;
  kubeletVersion: string;
  os: string;
  arch: string;
  containerRuntime: string;
  cpu: {
    capacityMillis: number;
    allocatableMillis: number;
    usageMillis?: number;
  };
  memory: {
    capacityBytes: number;
    allocatableBytes: number;
    usageBytes?: number;
  };
  pods: {
    capacity: number;
    running?: number;
  };
  conditions: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
    lastTransitionTime?: string;
  }>;
  createdAt?: string;
}

export interface MultiClusterPod {
  clusterId: ClusterId;
  clusterName: string;
  namespace: string;
  name: string;
  status: "Running" | "Pending" | "Succeeded" | "Failed" | "Unknown";
  ready: string; // e.g. "1/1"
  restarts: number;
  nodeName?: string;
  ip?: string;
  startTime?: string;
  containers: Array<{
    name: string;
    image: string;
    ready: boolean;
    restartCount: number;
    state: "running" | "waiting" | "terminated";
  }>;
  labels?: Record<string, string>;
}

export interface MultiClusterDeployment {
  clusterId: ClusterId;
  clusterName: string;
  namespace: string;
  name: string;
  replicas: number;
  readyReplicas: number;
  updatedReplicas: number;
  availableReplicas: number;
  strategy: string;
  labels?: Record<string, string>;
  createdAt?: string;
}

export interface ClusterHealthSummary {
  clusters: Array<{
    id: ClusterId;
    name: string;
    endpoint: string;
    reachable: boolean;
    totalNodes: number;
    readyNodes: number;
    error?: string;
  }>;
  totalClusters: number;
  healthyClusters: number;
  totalNodes: number;
  readyNodes: number;
}

export interface AppK8sStatus {
  appName: string;
  environments: Array<{
    clusterId: ClusterId;
    clusterName: string;
    namespace: string;
    deploymentName: string;
    replicas: number;
    readyReplicas: number;
    pods: MultiClusterPod[];
  }>;
}

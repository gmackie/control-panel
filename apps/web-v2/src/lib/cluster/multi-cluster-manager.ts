import * as k8s from "@kubernetes/client-node";
import { parseCpuMillis, parseMemoryBytes } from "./k8s-resource-utils";
import type {
  ClusterId,
  ClusterHealthSummary,
  MultiClusterNode,
  MultiClusterPod,
  MultiClusterDeployment,
} from "@/types/k8s";

interface ClusterEntry {
  id: ClusterId;
  name: string;
  endpoint: string;
  kubeconfigPath: string;
  kc: k8s.KubeConfig;
  coreApi: k8s.CoreV1Api;
  appsApi: k8s.AppsV1Api;
}

const CLUSTER_CONFIGS: Array<{
  id: ClusterId;
  name: string;
  endpoint: string;
  envVar: string;
  defaultPath: string;
}> = [
  {
    id: "production",
    name: "Production (Hetzner)",
    endpoint: process.env.PRODUCTION_K8S_ENDPOINT || "https://5.78.106.236:6443",
    envVar: "KUBECONFIG_PRODUCTION",
    defaultPath: `${process.env.HOME}/.kube/config-hetzner`,
  },
  {
    id: "staging",
    name: "Staging (Homelab)",
    endpoint: process.env.STAGING_K8S_ENDPOINT || "https://100.64.115.45:6443",
    envVar: "KUBECONFIG_STAGING",
    defaultPath: `${process.env.HOME}/.kube/config-remote`,
  },
];

class MultiClusterManager {
  private clusters: ClusterEntry[] = [];
  private initialized = false;

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    for (const cfg of CLUSTER_CONFIGS) {
      try {
        const kubeconfigPath = process.env[cfg.envVar] || cfg.defaultPath;
        const kc = new k8s.KubeConfig();
        kc.loadFromFile(kubeconfigPath);

        this.clusters.push({
          id: cfg.id,
          name: cfg.name,
          endpoint: cfg.endpoint,
          kubeconfigPath,
          kc,
          coreApi: kc.makeApiClient(k8s.CoreV1Api),
          appsApi: kc.makeApiClient(k8s.AppsV1Api),
        });
      } catch (err) {
        console.error(`[MultiCluster] Failed to load kubeconfig for ${cfg.id}:`, err);
      }
    }
  }

  private getCluster(id?: ClusterId): ClusterEntry[] {
    this.init();
    if (id) {
      const entry = this.clusters.find((c) => c.id === id);
      return entry ? [entry] : [];
    }
    return this.clusters;
  }

  getKubeConfig(clusterId: ClusterId): k8s.KubeConfig | null {
    this.init();
    const entry = this.clusters.find((c) => c.id === clusterId);
    return entry?.kc ?? null;
  }

  async healthCheck(): Promise<ClusterHealthSummary> {
    this.init();

    const results = await Promise.allSettled(
      this.clusters.map(async (cluster) => {
        const { body } = await cluster.coreApi.listNode();
        const nodes = body.items;
        const readyNodes = nodes.filter((n: k8s.V1Node) =>
          n.status?.conditions?.some(
            (c: k8s.V1NodeCondition) => c.type === "Ready" && c.status === "True"
          )
        ).length;
        return {
          id: cluster.id,
          name: cluster.name,
          endpoint: cluster.endpoint,
          reachable: true,
          totalNodes: nodes.length,
          readyNodes,
        };
      })
    );

    const clusters = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        id: this.clusters[i].id,
        name: this.clusters[i].name,
        endpoint: this.clusters[i].endpoint,
        reachable: false,
        totalNodes: 0,
        readyNodes: 0,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    });

    const totalNodes = clusters.reduce((s, c) => s + c.totalNodes, 0);
    const readyNodes = clusters.reduce((s, c) => s + c.readyNodes, 0);
    const healthyClusters = clusters.filter(
      (c) => c.reachable && c.readyNodes === c.totalNodes && c.totalNodes > 0
    ).length;

    return {
      clusters,
      totalClusters: clusters.length,
      healthyClusters,
      totalNodes,
      readyNodes,
    };
  }

  async getNodes(clusterId?: ClusterId): Promise<MultiClusterNode[]> {
    const targets = this.getCluster(clusterId);

    const results = await Promise.allSettled(
      targets.map(async (cluster) => {
        const { body } = await cluster.coreApi.listNode();

        // Try to get metrics (may not be available)
        const metricsMap = new Map<string, { cpu: string; memory: string }>();
        try {
          const metricsApi = new k8s.Metrics(cluster.kc);
          const nodeMetrics = await metricsApi.getNodeMetrics();
          for (const m of nodeMetrics.items) {
            metricsMap.set(m.metadata.name, {
              cpu: m.usage.cpu,
              memory: m.usage.memory,
            });
          }
        } catch {
          // Metrics server may not be available
        }

        return body.items.map((node: k8s.V1Node): MultiClusterNode => {
          const status = node.status;
          const labels = node.metadata?.labels ?? {};
          const metrics = metricsMap.get(node.metadata?.name ?? "");

          const readyCondition = status?.conditions?.find(
            (c: k8s.V1NodeCondition) => c.type === "Ready"
          );
          const nodeStatus =
            readyCondition?.status === "True"
              ? "Ready"
              : readyCondition?.status === "False"
                ? "NotReady"
                : "Unknown";

          const roles = Object.keys(labels)
            .filter((l) => l.startsWith("node-role.kubernetes.io/"))
            .map((l) => l.replace("node-role.kubernetes.io/", ""));
          if (roles.length === 0) roles.push("worker");

          const addresses = status?.addresses ?? [];
          const internalIP =
            addresses.find((a: k8s.V1NodeAddress) => a.type === "InternalIP")?.address ?? "";
          const externalIP =
            addresses.find((a: k8s.V1NodeAddress) => a.type === "ExternalIP")?.address;

          return {
            clusterId: cluster.id,
            clusterName: cluster.name,
            name: node.metadata?.name ?? "unknown",
            status: nodeStatus,
            roles,
            internalIP,
            externalIP,
            kubeletVersion: status?.nodeInfo?.kubeletVersion ?? "",
            os: `${status?.nodeInfo?.osImage ?? ""} (${status?.nodeInfo?.operatingSystem ?? ""}/${status?.nodeInfo?.architecture ?? ""})`,
            arch: status?.nodeInfo?.architecture ?? "",
            containerRuntime: status?.nodeInfo?.containerRuntimeVersion ?? "",
            cpu: {
              capacityMillis: parseCpuMillis(status?.capacity?.["cpu"]),
              allocatableMillis: parseCpuMillis(status?.allocatable?.["cpu"]),
              usageMillis: metrics ? parseCpuMillis(metrics.cpu) : undefined,
            },
            memory: {
              capacityBytes: parseMemoryBytes(status?.capacity?.["memory"]),
              allocatableBytes: parseMemoryBytes(status?.allocatable?.["memory"]),
              usageBytes: metrics
                ? parseMemoryBytes(metrics.memory)
                : undefined,
            },
            pods: {
              capacity: parseInt(status?.capacity?.["pods"] ?? "110", 10),
            },
            conditions: (status?.conditions ?? []).map((c: k8s.V1NodeCondition) => ({
              type: c.type,
              status: c.status,
              reason: c.reason ?? undefined,
              message: c.message ?? undefined,
              lastTransitionTime: c.lastTransitionTime
                ? new Date(c.lastTransitionTime).toISOString()
                : undefined,
            })),
            createdAt: node.metadata?.creationTimestamp
              ? new Date(node.metadata.creationTimestamp).toISOString()
              : undefined,
          };
        });
      })
    );

    return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }

  async getPods(
    clusterId?: ClusterId,
    namespace?: string
  ): Promise<MultiClusterPod[]> {
    const targets = this.getCluster(clusterId);

    const results = await Promise.allSettled(
      targets.map(async (cluster) => {
        const { body } = namespace
          ? await cluster.coreApi.listNamespacedPod(namespace)
          : await cluster.coreApi.listPodForAllNamespaces();

        return body.items.map((pod: k8s.V1Pod): MultiClusterPod => {
          const containerStatuses = pod.status?.containerStatuses ?? [];
          const readyCount = containerStatuses.filter((c: k8s.V1ContainerStatus) => c.ready).length;
          const totalCount = containerStatuses.length;
          const restarts = containerStatuses.reduce(
            (s: number, c: k8s.V1ContainerStatus) => s + c.restartCount,
            0
          );

          let phase = pod.status?.phase ?? "Unknown";
          if (!["Running", "Pending", "Succeeded", "Failed"].includes(phase)) {
            phase = "Unknown";
          }

          return {
            clusterId: cluster.id,
            clusterName: cluster.name,
            namespace: pod.metadata?.namespace ?? "default",
            name: pod.metadata?.name ?? "unknown",
            status: phase as MultiClusterPod["status"],
            ready: `${readyCount}/${totalCount}`,
            restarts,
            nodeName: pod.spec?.nodeName ?? undefined,
            ip: pod.status?.podIP ?? undefined,
            startTime: pod.status?.startTime
              ? new Date(pod.status.startTime).toISOString()
              : undefined,
            containers: containerStatuses.map((c: k8s.V1ContainerStatus) => ({
              name: c.name,
              image: c.image,
              ready: c.ready,
              restartCount: c.restartCount,
              state: c.state?.running
                ? ("running" as const)
                : c.state?.waiting
                  ? ("waiting" as const)
                  : ("terminated" as const),
            })),
            labels: pod.metadata?.labels ?? undefined,
          };
        });
      })
    );

    return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }

  async getDeployments(
    clusterId?: ClusterId,
    namespace?: string
  ): Promise<MultiClusterDeployment[]> {
    const targets = this.getCluster(clusterId);

    const results = await Promise.allSettled(
      targets.map(async (cluster) => {
        const { body } = namespace
          ? await cluster.appsApi.listNamespacedDeployment(namespace)
          : await cluster.appsApi.listDeploymentForAllNamespaces();

        return body.items.map((dep: k8s.V1Deployment): MultiClusterDeployment => ({
          clusterId: cluster.id,
          clusterName: cluster.name,
          namespace: dep.metadata?.namespace ?? "default",
          name: dep.metadata?.name ?? "unknown",
          replicas: dep.spec?.replicas ?? 0,
          readyReplicas: dep.status?.readyReplicas ?? 0,
          updatedReplicas: dep.status?.updatedReplicas ?? 0,
          availableReplicas: dep.status?.availableReplicas ?? 0,
          strategy: dep.spec?.strategy?.type ?? "RollingUpdate",
          labels: dep.metadata?.labels ?? undefined,
          createdAt: dep.metadata?.creationTimestamp
            ? new Date(dep.metadata.creationTimestamp).toISOString()
            : undefined,
        }));
      })
    );

    return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }
}

// Module-level singleton
let instance: MultiClusterManager | null = null;

export function getMultiClusterManager(): MultiClusterManager {
  if (!instance) {
    instance = new MultiClusterManager();
  }
  return instance;
}

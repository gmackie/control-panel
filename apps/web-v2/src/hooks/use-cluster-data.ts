"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  ClusterId,
  ClusterHealthSummary,
  MultiClusterNode,
  MultiClusterPod,
  MultiClusterDeployment,
} from "@/types/k8s";

const POLL_INTERVAL = 30_000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`K8s API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function useClusterHealth() {
  return useQuery<ClusterHealthSummary>({
    queryKey: ["k8s", "health"],
    queryFn: () => fetchJson("/api/k8s/health"),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useClusterNodes(clusterId?: ClusterId) {
  const params = clusterId ? `?clusterId=${clusterId}` : "";
  return useQuery<MultiClusterNode[]>({
    queryKey: ["k8s", "nodes", clusterId ?? "all"],
    queryFn: () => fetchJson(`/api/k8s/nodes${params}`),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useClusterPods(clusterId?: ClusterId, namespace?: string) {
  const params = new URLSearchParams();
  if (clusterId) params.set("clusterId", clusterId);
  if (namespace) params.set("namespace", namespace);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return useQuery<MultiClusterPod[]>({
    queryKey: ["k8s", "pods", clusterId ?? "all", namespace ?? "all"],
    queryFn: () => fetchJson(`/api/k8s/pods${qs}`),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useClusterDeployments(clusterId?: ClusterId, namespace?: string) {
  const params = new URLSearchParams();
  if (clusterId) params.set("clusterId", clusterId);
  if (namespace) params.set("namespace", namespace);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return useQuery<MultiClusterDeployment[]>({
    queryKey: ["k8s", "deployments", clusterId ?? "all", namespace ?? "all"],
    queryFn: () => fetchJson(`/api/k8s/deployments${qs}`),
    refetchInterval: POLL_INTERVAL,
  });
}

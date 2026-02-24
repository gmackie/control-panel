"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import type { ClusterId, MultiClusterPod, MultiClusterDeployment } from "@/types/k8s";
import type { ArtifactInfo } from "@/lib/harbor/service";

const POLL_INTERVAL = 30_000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Pods belonging to a specific app (filtered by name prefix) */
export function useAppPods(
  namespace?: string,
  appName?: string,
  clusterId?: ClusterId
) {
  const params = new URLSearchParams();
  if (clusterId) params.set("clusterId", clusterId);
  if (namespace) params.set("namespace", namespace);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery<MultiClusterPod[]>({
    queryKey: ["app-pods", clusterId ?? "all", namespace ?? "all", appName],
    queryFn: async () => {
      const pods = await fetchJson<MultiClusterPod[]>(`/api/k8s/pods${qs}`);
      if (!appName) return pods;
      return pods.filter(
        (p) =>
          p.name.startsWith(appName) ||
          p.labels?.app === appName ||
          p.labels?.["app.kubernetes.io/name"] === appName
      );
    },
    enabled: !!namespace,
    refetchInterval: POLL_INTERVAL,
  });
}

/** Deployments belonging to a specific app */
export function useAppDeployments(
  namespace?: string,
  appName?: string,
  clusterId?: ClusterId
) {
  const params = new URLSearchParams();
  if (clusterId) params.set("clusterId", clusterId);
  if (namespace) params.set("namespace", namespace);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery<MultiClusterDeployment[]>({
    queryKey: ["app-deployments", clusterId ?? "all", namespace ?? "all", appName],
    queryFn: async () => {
      const deps = await fetchJson<MultiClusterDeployment[]>(`/api/k8s/deployments${qs}`);
      if (!appName) return deps;
      return deps.filter(
        (d) =>
          d.name === appName ||
          d.name.startsWith(appName) ||
          d.labels?.app === appName ||
          d.labels?.["app.kubernetes.io/name"] === appName
      );
    },
    enabled: !!namespace,
    refetchInterval: POLL_INTERVAL,
  });
}

/** Prometheus application metrics (CPU, memory, requests, errors, latency) */
export interface AppMetrics {
  cpu: number;
  memory: number;
  requests: number;
  errors: number;
  latency: number;
}

export function useAppMetrics(namespace?: string, appName?: string) {
  return useQuery<AppMetrics>({
    queryKey: ["app-metrics", namespace, appName],
    queryFn: () =>
      fetchJson<AppMetrics>(
        `/api/prometheus/app-metrics?namespace=${namespace}&app=${appName}`
      ),
    enabled: !!namespace && !!appName,
    refetchInterval: POLL_INTERVAL,
    retry: 1,
  });
}

/** Harbor container images for an app */
export function useAppImages(project?: string, repository?: string) {
  return useQuery<ArtifactInfo[]>({
    queryKey: ["app-images", project, repository],
    queryFn: () =>
      fetchJson<ArtifactInfo[]>(
        `/api/harbor/images?project=${project}&repository=${repository}`
      ),
    enabled: !!project && !!repository,
    refetchInterval: POLL_INTERVAL,
    retry: 1,
  });
}

/** SSE pod log streaming hook */
export interface PodLogOptions {
  clusterId: ClusterId;
  namespace: string;
  pod: string;
  container?: string;
  tail?: number;
  follow?: boolean;
}

export function usePodLogs(options: PodLogOptions | null) {
  const [lines, setLines] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const clear = useCallback(() => setLines([]), []);

  useEffect(() => {
    // Cleanup previous connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (!options) {
      setIsStreaming(false);
      return;
    }

    const { clusterId, namespace, pod, container, tail = 100, follow = false } = options;

    if (!follow) {
      // Non-streaming: fetch as JSON
      setIsStreaming(false);
      setError(null);
      const params = new URLSearchParams({
        clusterId,
        namespace,
        pod,
        tail: String(tail),
        follow: "false",
      });
      if (container) params.set("container", container);

      fetch(`/api/k8s/logs?${params}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: { lines: string[] }) => {
          setLines(data.lines);
        })
        .catch((err: Error) => {
          setError(err.message);
        });
      return;
    }

    // SSE streaming
    setIsStreaming(true);
    setError(null);
    setLines([]);

    const params = new URLSearchParams({
      clusterId,
      namespace,
      pod,
      tail: String(tail),
      follow: "true",
    });
    if (container) params.set("container", container);

    const es = new EventSource(`/api/k8s/logs?${params}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const line = JSON.parse(event.data) as string;
        setLines((prev) => [...prev, line]);
      } catch {
        setLines((prev) => [...prev, event.data]);
      }
    };

    es.addEventListener("done", () => {
      setIsStreaming(false);
      es.close();
    });

    es.addEventListener("error", (event) => {
      if (es.readyState === EventSource.CLOSED) {
        setIsStreaming(false);
      } else {
        // EventSource error events don't carry data easily; check for custom event
        const customEvent = event as MessageEvent;
        if (customEvent.data) {
          setError(customEvent.data);
        }
        setIsStreaming(false);
        es.close();
      }
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [
    options?.clusterId,
    options?.namespace,
    options?.pod,
    options?.container,
    options?.tail,
    options?.follow,
  ]);

  return { lines, isStreaming, error, clear };
}

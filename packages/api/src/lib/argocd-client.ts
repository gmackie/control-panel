export interface ArgoCDApplication {
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp?: string;
  };
  spec: {
    source: {
      repoURL: string;
      path?: string;
      targetRevision?: string;
    };
    destination: {
      server?: string;
      namespace?: string;
    };
    project?: string;
  };
  status: {
    sync: {
      status: "Synced" | "OutOfSync" | "Unknown";
      revision?: string;
      comparedTo?: {
        source: { repoURL: string; path?: string; targetRevision?: string };
        destination: { server?: string; namespace?: string };
      };
    };
    health: {
      status:
        | "Healthy"
        | "Progressing"
        | "Degraded"
        | "Suspended"
        | "Missing"
        | "Unknown";
      message?: string;
    };
    operationState?: {
      phase:
        | "Running"
        | "Succeeded"
        | "Failed"
        | "Error"
        | "Terminating";
      message?: string;
      startedAt?: string;
      finishedAt?: string;
    };
    summary?: {
      images?: string[];
    };
    resources?: Array<{
      group?: string;
      version: string;
      kind: string;
      namespace?: string;
      name: string;
      status?: string;
      health?: { status: string; message?: string };
    }>;
  };
}

export class ArgoCDClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    // ArgoCD uses self-signed certs for cluster-internal HTTPS
    const options: RequestInit & { dispatcher?: unknown } = {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    };

    // Node.js undici (used by fetch) supports rejectUnauthorized via env var
    // For cluster-internal ArgoCD calls, we set this at the process level
    const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (this.baseUrl.includes(".svc.cluster.local") || this.baseUrl.includes("argocd")) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } finally {
      if (originalTls !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }

    if (!response.ok) {
      throw new Error(
        `ArgoCD API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async listApplications(): Promise<ArgoCDApplication[]> {
    const result = await this.request<{ items: ArgoCDApplication[] }>(
      "/api/v1/applications",
    );
    return result.items || [];
  }

  async getApplication(name: string): Promise<ArgoCDApplication> {
    return this.request<ArgoCDApplication>(
      `/api/v1/applications/${encodeURIComponent(name)}`,
    );
  }

  async getApplicationSyncHistory(
    name: string,
  ): Promise<Array<{ revision: string; deployedAt: string; id: number }>> {
    const app = await this.getApplication(name);
    return app.status.operationState
      ? [
          {
            revision: app.status.sync.revision || "unknown",
            deployedAt:
              app.status.operationState.finishedAt ||
              app.status.operationState.startedAt ||
              new Date().toISOString(),
            id: 0,
          },
        ]
      : [];
  }
}

export function getArgoCDClient(): ArgoCDClient | null {
  const server = (process.env.ARGOCD_SERVER || "").trim();
  const token = (process.env.ARGOCD_TOKEN || "").trim();

  if (!server || !token) {
    return null;
  }

  return new ArgoCDClient(server, token);
}

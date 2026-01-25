import { createProviderError } from '../../types';
import type { EnvVar, Environment } from '../../types';
import type { DeploymentProvider } from '../index';
import type {
  Deployment,
  DeploymentProject,
  DeployOptions,
  RollbackOptions,
  CreateProjectOptions,
  LinkGitRepoOptions,
  ListDeploymentsOptions,
  ListDeploymentsResponse,
  LogEntry,
  LogStreamOptions,
  DeploymentStatus,
} from '../types';

interface KubernetesConfig {
  apiUrl: string;
  token: string;
  namespace?: string;
  skipTlsVerify?: boolean;
}

export class KubernetesProvider implements DeploymentProvider {
  readonly type = 'kubernetes' as const;
  private apiUrl: string;
  private token: string;
  private defaultNamespace: string;
  private skipTlsVerify: boolean;

  constructor(config: KubernetesConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.token = config.token;
    this.defaultNamespace = config.namespace ?? 'default';
    this.skipTlsVerify = config.skipTlsVerify ?? false;
  }

  private async request<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
    if (this.skipTlsVerify) {
      return this.requestWithNodeHttps<T>(path, options);
    }

    const response = await fetch(`${this.apiUrl}${path}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => response.statusText);
      throw this.createApiError(response.status, error, path);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private requestWithNodeHttps<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const { URL } = require('url');

      const url = `${this.apiUrl}${path}`;
      const parsedUrl = new URL(url);
      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options?.method || 'GET',
        rejectUnauthorized: false,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(reqOptions, (res: NodeResponse) => {
        let data = '';
        res.on('data', (chunk?: string) => {
          if (chunk) data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Invalid JSON response: ${data.substring(0, 100)}`));
            }
          } else {
            reject(new Error(`K8s API error ${res.statusCode}: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', reject);

      if (options?.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async listProjects(): Promise<DeploymentProject[]> {
    const result = await this.request<{ items: K8sNamespace[] }>('/api/v1/namespaces');
    const namespaces = result.items.filter(
      (ns) => !ns.metadata.name.startsWith('kube-') && ns.metadata.name !== 'default'
    );

    const projects: DeploymentProject[] = [];
    for (const ns of namespaces) {
      const project = await this.namespaceToProject(ns);
      projects.push(project);
    }

    return projects;
  }

  async getProject(projectId: string): Promise<DeploymentProject> {
    const namespace = await this.request<K8sNamespace>(`/api/v1/namespaces/${projectId}`);
    return this.namespaceToProject(namespace);
  }

  async getProjectByName(name: string): Promise<DeploymentProject | null> {
    try {
      return await this.getProject(name);
    } catch {
      return null;
    }
  }

  async createProject(options: CreateProjectOptions): Promise<DeploymentProject> {
    const namespace: K8sNamespace = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: options.name,
        labels: {
          'app.kubernetes.io/managed-by': 'control-panel',
        },
      },
    };

    const created = await this.request<K8sNamespace>('/api/v1/namespaces', {
      method: 'POST',
      body: namespace,
    });

    return this.namespaceToProject(created);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.request(`/api/v1/namespaces/${projectId}`, { method: 'DELETE' });
  }

  async linkGitRepo(_projectId: string, _options: LinkGitRepoOptions): Promise<void> {
    throw createProviderError(
      'kubernetes',
      'NOT_SUPPORTED',
      'Kubernetes does not support direct git repo linking. Use CI/CD pipelines instead.'
    );
  }

  async unlinkGitRepo(_projectId: string): Promise<void> {
    throw createProviderError(
      'kubernetes',
      'NOT_SUPPORTED',
      'Kubernetes does not support direct git repo linking.'
    );
  }

  async deploy(projectId: string, options?: DeployOptions): Promise<Deployment> {
    const namespace = projectId;
    const deploymentName = namespace;

    const deployment = await this.request<K8sDeployment>(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`
    );

    if (options?.commitSha) {
      await this.request(`/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`, {
        method: 'PATCH',
        body: {
          spec: {
            template: {
              metadata: {
                annotations: {
                  'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
                  'deployment.kubernetes.io/revision': options.commitSha,
                },
              },
            },
          },
        },
      });
    } else {
      await this.request(`/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`, {
        method: 'PATCH',
        body: {
          spec: {
            template: {
              metadata: {
                annotations: {
                  'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
                },
              },
            },
          },
        },
      });
    }

    return this.mapDeployment(deployment, namespace);
  }

  async getDeployment(deploymentId: string): Promise<Deployment> {
    const [namespace, name] = this.parseDeploymentId(deploymentId);
    const deployment = await this.request<K8sDeployment>(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`
    );
    return this.mapDeployment(deployment, namespace);
  }

  async listDeployments(
    projectId: string,
    options?: ListDeploymentsOptions
  ): Promise<ListDeploymentsResponse> {
    const namespace = projectId;
    const result = await this.request<{ items: K8sDeployment[] }>(
      `/apis/apps/v1/namespaces/${namespace}/deployments`
    );

    const deployments = result.items.map((d) => this.mapDeployment(d, namespace));

    const page = options?.page ?? 1;
    const perPage = options?.perPage ?? 20;

    return {
      data: deployments,
      pagination: {
        page,
        perPage,
        total: deployments.length,
        totalPages: Math.ceil(deployments.length / perPage),
        hasNextPage: false,
        hasPrevPage: page > 1,
      },
    };
  }

  async cancelDeployment(_deploymentId: string): Promise<void> {
    throw createProviderError(
      'kubernetes',
      'NOT_SUPPORTED',
      'Kubernetes deployments cannot be cancelled. Use rollback instead.'
    );
  }

  async rollback(projectId: string, options: RollbackOptions): Promise<Deployment> {
    const namespace = projectId;
    const [, deploymentName] = this.parseDeploymentId(options.targetDeploymentId);

    await this.request(`/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`, {
      method: 'PATCH',
      body: {
        spec: {
          template: {
            metadata: {
              annotations: {
                'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
              },
            },
          },
        },
      },
    });

    const deployment = await this.request<K8sDeployment>(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`
    );

    return this.mapDeployment(deployment, namespace);
  }

  async *getLogs(deploymentId: string, options?: LogStreamOptions): AsyncIterable<LogEntry> {
    const [namespace, name] = this.parseDeploymentId(deploymentId);

    const podsResult = await this.request<{ items: K8sPod[] }>(
      `/api/v1/namespaces/${namespace}/pods?labelSelector=app=${name}`
    );

    const pod = podsResult.items[0];
    if (!pod) {
      return;
    }

    const params = new URLSearchParams();
    if (options?.tail) params.append('tailLines', options.tail.toString());

    const logs = await this.request<string>(
      `/api/v1/namespaces/${namespace}/pods/${pod.metadata.name}/log?${params}`
    );

    const lines = logs.split('\n').filter((line) => line.trim());
    for (const line of lines) {
      yield {
        timestamp: new Date(),
        level: 'info',
        message: line,
        source: pod.metadata.name,
      };
    }
  }

  async getBuildLogs(deploymentId: string): Promise<LogEntry[]> {
    const logs: LogEntry[] = [];
    for await (const log of this.getLogs(deploymentId, { tail: 100 })) {
      logs.push(log);
    }
    return logs;
  }

  async getEnvVars(projectId: string, environment?: Environment): Promise<EnvVar[]> {
    const namespace = environment === 'staging' ? `${projectId}-staging` : projectId;

    try {
      const secret = await this.request<K8sSecret>(
        `/api/v1/namespaces/${namespace}/secrets/${projectId}-env`
      );

      if (!secret.data) return [];

      return Object.entries(secret.data).map(([key, value]) => ({
        key,
        value: Buffer.from(value, 'base64').toString('utf-8'),
        target: environment ? [environment] : undefined,
        isSecret: true,
      }));
    } catch {
      return [];
    }
  }

  async setEnvVars(projectId: string, envVars: EnvVar[], environment?: Environment): Promise<void> {
    const namespace = environment === 'staging' ? `${projectId}-staging` : projectId;
    const secretName = `${projectId}-env`;

    const data: Record<string, string> = {};
    for (const env of envVars) {
      data[env.key] = Buffer.from(env.value).toString('base64');
    }

    try {
      await this.request(`/api/v1/namespaces/${namespace}/secrets/${secretName}`, {
        method: 'PUT',
        body: {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: { name: secretName, namespace },
          type: 'Opaque',
          data,
        },
      });
    } catch {
      await this.request(`/api/v1/namespaces/${namespace}/secrets`, {
        method: 'POST',
        body: {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: { name: secretName, namespace },
          type: 'Opaque',
          data,
        },
      });
    }
  }

  async deleteEnvVar(projectId: string, key: string, environment?: Environment): Promise<void> {
    const envVars = await this.getEnvVars(projectId, environment);
    const filtered = envVars.filter((env) => env.key !== key);
    await this.setEnvVars(projectId, filtered, environment);
  }

  async getDomains(projectId: string): Promise<string[]> {
    try {
      const result = await this.request<{ items: K8sIngress[] }>(
        `/apis/networking.k8s.io/v1/namespaces/${projectId}/ingresses`
      );

      const domains: string[] = [];
      for (const ingress of result.items) {
        for (const rule of ingress.spec.rules ?? []) {
          if (rule.host) domains.push(rule.host);
        }
      }
      return domains;
    } catch {
      return [];
    }
  }

  async addDomain(_projectId: string, _domain: string): Promise<void> {
    throw createProviderError(
      'kubernetes',
      'NOT_SUPPORTED',
      'Domain management requires creating Ingress resources. Use kubectl or the cluster orchestrator.'
    );
  }

  async removeDomain(_projectId: string, _domain: string): Promise<void> {
    throw createProviderError(
      'kubernetes',
      'NOT_SUPPORTED',
      'Domain management requires modifying Ingress resources. Use kubectl or the cluster orchestrator.'
    );
  }

  private async namespaceToProject(ns: K8sNamespace): Promise<DeploymentProject> {
    const deploymentsResult = await this.request<{ items: K8sDeployment[] }>(
      `/apis/apps/v1/namespaces/${ns.metadata.name}/deployments`
    ).catch(() => ({ items: [] }));

    const domains = await this.getDomains(ns.metadata.name);

    return {
      id: ns.metadata.name,
      name: ns.metadata.name,
      slug: ns.metadata.name,
      framework: null,
      gitRepo: null,
      domains,
      createdAt: ns.metadata.creationTimestamp
        ? new Date(ns.metadata.creationTimestamp)
        : new Date(),
      updatedAt: new Date(),
    };
  }

  private mapDeployment(k8sDeploy: K8sDeployment, namespace: string): Deployment {
    const ready = k8sDeploy.status?.readyReplicas ?? 0;
    const desired = k8sDeploy.spec?.replicas ?? 1;

    let status: DeploymentStatus = 'queued';
    if (ready === desired && ready > 0) {
      status = 'ready';
    } else if (ready > 0) {
      status = 'deploying';
    } else if (k8sDeploy.status?.replicas && k8sDeploy.status.replicas > 0) {
      status = 'building';
    }

    const image = k8sDeploy.spec?.template?.spec?.containers?.[0]?.image ?? '';
    const imageTag = image.includes(':') ? image.split(':').pop() : 'latest';

    return {
      id: `${namespace}/${k8sDeploy.metadata.name}`,
      name: k8sDeploy.metadata.name,
      status,
      environment: namespace.endsWith('-staging') ? 'staging' : 'production',
      url: null,
      commitSha: imageTag ?? null,
      commitMessage: null,
      branch: null,
      triggeredBy: null,
      startedAt: k8sDeploy.metadata.creationTimestamp
        ? new Date(k8sDeploy.metadata.creationTimestamp)
        : null,
      completedAt: null,
      errorMessage: null,
      createdAt: new Date(k8sDeploy.metadata.creationTimestamp),
      updatedAt: new Date(),
    };
  }

  private parseDeploymentId(deploymentId: string): [string, string] {
    const parts = deploymentId.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      return [parts[0], parts[1]];
    }
    return [this.defaultNamespace, deploymentId];
  }

  private createApiError(status: number, message: string, path: string): never {
    if (status === 401) {
      throw createProviderError('kubernetes', 'UNAUTHORIZED', 'Invalid or expired K8s token', {
        statusCode: 401,
      });
    }
    if (status === 403) {
      throw createProviderError('kubernetes', 'FORBIDDEN', `Access denied: ${message}`, {
        statusCode: 403,
      });
    }
    if (status === 404) {
      throw createProviderError('kubernetes', 'NOT_FOUND', `Resource not found: ${message}`, {
        statusCode: 404,
      });
    }
    throw createProviderError('kubernetes', 'API_ERROR', `K8s API error (${path}): ${message}`, {
      statusCode: status,
      retryable: status >= 500,
    });
  }
}

interface NodeResponse {
  statusCode?: number;
  on(event: 'data' | 'end', callback: (data?: string) => void): void;
}

interface K8sNamespace {
  apiVersion?: string;
  kind?: string;
  metadata: {
    name: string;
    labels?: Record<string, string>;
    creationTimestamp?: string;
  };
}

interface K8sDeployment {
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    creationTimestamp: string;
  };
  spec?: {
    replicas?: number;
    template?: {
      spec?: {
        containers?: Array<{
          name: string;
          image: string;
        }>;
      };
    };
  };
  status?: {
    replicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
  };
}

interface K8sIngress {
  metadata: { name: string; namespace: string };
  spec: {
    rules?: Array<{ host?: string }>;
  };
}

interface K8sPod {
  metadata: { name: string; namespace: string };
  status?: { phase: string };
}

interface K8sSecret {
  metadata: { name: string; namespace: string };
  type: string;
  data?: Record<string, string>;
}

export function createKubernetesProvider(config: KubernetesConfig): KubernetesProvider {
  return new KubernetesProvider(config);
}

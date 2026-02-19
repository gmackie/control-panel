/**
 * Kubernetes API Client
 * 
 * Direct HTTP client for Kubernetes API - no kubectl CLI dependency.
 * Uses service account token for authentication.
 */

export interface K8sClientConfig {
  apiUrl: string;
  token: string;
  skipTlsVerify?: boolean;
}

export interface K8sDeployment {
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    creationTimestamp: string;
  };
  spec: {
    replicas: number;
    template: {
      spec: {
        containers: Array<{
          name: string;
          image: string;
          ports?: Array<{ containerPort: number; name?: string }>;
          resources?: {
            requests?: { cpu?: string; memory?: string };
            limits?: { cpu?: string; memory?: string };
          };
        }>;
      };
    };
  };
  status: {
    replicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
  };
}

export interface K8sIngress {
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    tls?: Array<{ hosts: string[]; secretName: string }>;
    rules?: Array<{
      host: string;
      http?: {
        paths: Array<{
          path: string;
          backend: {
            service: { name: string; port: { number: number } };
          };
        }>;
      };
    }>;
  };
}

export interface K8sNamespace {
  metadata: {
    name: string;
    labels?: Record<string, string>;
  };
}

export interface K8sNode {
  metadata: {
    name: string;
    labels?: Record<string, string>;
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
    conditions?: Array<{
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

export interface K8sSecret {
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    creationTimestamp: string;
  };
  type: string;
  data?: Record<string, string>; // base64 encoded
}

export interface K8sService {
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: {
    selector?: Record<string, string>;
    ports?: Array<{
      port: number;
      targetPort: number | string;
      protocol: string;
      name?: string;
    }>;
    type: string;
  };
}

export interface K8sPod {
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    creationTimestamp: string;
  };
  spec: {
    nodeName?: string;
    containers: Array<{
      name: string;
      image: string;
      ports?: Array<{ containerPort: number; name?: string }>;
      resources?: {
        requests?: { cpu?: string; memory?: string };
        limits?: { cpu?: string; memory?: string };
      };
    }>;
    restartPolicy?: string;
  };
  status: {
    phase: string;
    podIP?: string;
    hostIP?: string;
    startTime?: string;
    conditions?: Array<{
      type: string;
      status: string;
      lastTransitionTime?: string;
    }>;
    containerStatuses?: Array<{
      name: string;
      ready: boolean;
      restartCount: number;
      state: {
        running?: { startedAt: string };
        waiting?: { reason: string; message?: string };
        terminated?: { exitCode: number; reason: string };
      };
      lastState?: {
        terminated?: { exitCode: number; reason: string; finishedAt?: string };
      };
      image: string;
    }>;
  };
}

export class K8sApiClient {
  private config: K8sClientConfig;

  constructor(config: K8sClientConfig) {
    this.config = config;
  }

  /**
   * Create client from environment variables
   */
  static fromEnv(): K8sApiClient | null {
    const token = process.env.K3S_SA_TOKEN;
    const apiUrl = process.env.K8S_API_URL || 'https://5.78.106.236:6443';

    if (!token) {
      console.warn('K3S_SA_TOKEN not set, cannot create K8s client');
      return null;
    }

    return new K8sApiClient({
      apiUrl,
      token,
      skipTlsVerify: true, // Self-signed certs on K3s
    });
  }

  private async apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.apiUrl}${path}`;
    
    if (this.config.skipTlsVerify) {
      return this.requestWithNodeHttps<T>(url, options);
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`K8s API error ${response.status}: ${text}`);
    }

    return response.json();
  }

  private requestWithNodeHttps<T>(url: string, options: RequestInit = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const { URL } = require('url');
      
      const parsedUrl = new URL(url);
      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        rejectUnauthorized: false,
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers as Record<string, string>,
        },
      };

      const req = https.request(reqOptions, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
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

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }

      req.end();
    });
  }

  /**
   * Generic public request method for accessing arbitrary K8s API paths.
   * Used by PrometheusClient and AlertManagerClient for CRD access.
   */
  async request<T = unknown>(
    path: string,
    options?: { method?: string; body?: string; headers?: Record<string, string> }
  ): Promise<T> {
    const requestInit: RequestInit = {};
    if (options?.method) {
      requestInit.method = options.method;
    }
    if (options?.body) {
      requestInit.body = options.body;
    }
    if (options?.headers) {
      requestInit.headers = options.headers;
    }
    return this.apiRequest<T>(path, requestInit);
  }

  /**
   * Get all namespaces
   */
  async getNamespaces(): Promise<K8sNamespace[]> {
    const result = await this.apiRequest<{ items: K8sNamespace[] }>('/api/v1/namespaces');
    return result.items;
  }

  /**
   * Get all deployments across all namespaces
   */
  async getAllDeployments(): Promise<K8sDeployment[]> {
    const result = await this.apiRequest<{ items: K8sDeployment[] }>('/apis/apps/v1/deployments');
    return result.items;
  }

  /**
   * Get deployments in a specific namespace
   */
  async getDeployments(namespace: string): Promise<K8sDeployment[]> {
    const result = await this.apiRequest<{ items: K8sDeployment[] }>(
      `/apis/apps/v1/namespaces/${namespace}/deployments`
    );
    return result.items;
  }

  /**
   * Get all ingresses across all namespaces
   */
  async getAllIngresses(): Promise<K8sIngress[]> {
    const result = await this.apiRequest<{ items: K8sIngress[] }>('/apis/networking.k8s.io/v1/ingresses');
    return result.items;
  }

  /**
   * Get ingresses in a specific namespace
   */
  async getIngresses(namespace: string): Promise<K8sIngress[]> {
    const result = await this.apiRequest<{ items: K8sIngress[] }>(
      `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses`
    );
    return result.items;
  }

  /**
   * Get all nodes in the cluster
   */
  async getNodes(): Promise<K8sNode[]> {
    const result = await this.apiRequest<{ items: K8sNode[] }>('/api/v1/nodes');
    return result.items;
  }

  /**
   * Label a deployment
   */
  async labelDeployment(
    namespace: string,
    name: string,
    labels: Record<string, string>
  ): Promise<void> {
    await this.apiRequest(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/strategic-merge-patch+json',
        },
        body: JSON.stringify({
          metadata: { labels },
        }),
      }
    );
  }

  /**
   * Annotate a deployment
   */
  async annotateDeployment(
    namespace: string,
    name: string,
    annotations: Record<string, string>
  ): Promise<void> {
    await this.apiRequest(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/strategic-merge-patch+json',
        },
        body: JSON.stringify({
          metadata: { annotations },
        }),
      }
    );
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.apiRequest('/api/v1/namespaces/default');
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getDeployment(namespace: string, name: string): Promise<K8sDeployment> {
    return this.apiRequest<K8sDeployment>(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`
    );
  }

  async getSecrets(namespace: string): Promise<K8sSecret[]> {
    const result = await this.apiRequest<{ items: K8sSecret[] }>(
      `/api/v1/namespaces/${namespace}/secrets`
    );
    return result.items;
  }

  async getSecret(namespace: string, name: string): Promise<K8sSecret> {
    return this.apiRequest<K8sSecret>(
      `/api/v1/namespaces/${namespace}/secrets/${name}`
    );
  }

  async getSecretNames(namespace: string): Promise<string[]> {
    const secrets = await this.getSecrets(namespace);
    return secrets.map(s => s.metadata.name);
  }

  async getServices(namespace: string): Promise<K8sService[]> {
    const result = await this.apiRequest<{ items: K8sService[] }>(
      `/api/v1/namespaces/${namespace}/services`
    );
    return result.items;
  }

  async getService(namespace: string, name: string): Promise<K8sService> {
    return this.apiRequest<K8sService>(
      `/api/v1/namespaces/${namespace}/services/${name}`
    );
  }

  async getAllPods(): Promise<K8sPod[]> {
    const result = await this.apiRequest<{ items: K8sPod[] }>('/api/v1/pods');
    return result.items;
  }

  async getPods(namespace: string): Promise<K8sPod[]> {
    const result = await this.apiRequest<{ items: K8sPod[] }>(
      `/api/v1/namespaces/${namespace}/pods`
    );
    return result.items;
  }

  async getPod(namespace: string, name: string): Promise<K8sPod> {
    return this.apiRequest<K8sPod>(
      `/api/v1/namespaces/${namespace}/pods/${name}`
    );
  }

  async getAllServices(): Promise<K8sService[]> {
    const result = await this.apiRequest<{ items: K8sService[] }>('/api/v1/services');
    return result.items;
  }
}

// Singleton instance
let k8sClient: K8sApiClient | null = null;

export function getK8sClient(): K8sApiClient | null {
  if (!k8sClient) {
    k8sClient = K8sApiClient.fromEnv();
  }
  return k8sClient;
}

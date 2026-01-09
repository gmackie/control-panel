import { K3sDeployment, ClusterInfo } from '@/types/deployments';
import * as https from 'https';

export interface K3sConfig {
  apiUrl: string;
  token: string;
}

export interface DeploymentFilter {
  environment?: string;
  applicationId?: string;
  namespace?: string;
  labels?: Record<string, string>;
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export class K3sService {
  private config: K3sConfig;

  constructor() {
    this.config = {
      apiUrl: process.env.K8S_API_URL || process.env.K3S_API_URL || 'https://5.78.106.236:6443',
      token: process.env.K3S_SA_TOKEN || process.env.K8S_TOKEN || '',
    };
  }

  private async fetchFromK8sAPI<T = unknown>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        // @ts-expect-error - Node.js fetch accepts agent option
        agent: httpsAgent,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`K8s API error: ${response.status} ${response.statusText} - ${text}`);
      }

      return response.json();
    } catch (error) {
      console.error('K8s API fetch error:', error);
      throw error;
    }
  }

  async getNodes(): Promise<Array<{
    name: string;
    status: string;
    roles: string[];
    version: string;
    internalIP: string;
    externalIP?: string;
    capacity: { cpu: string; memory: string; pods: string };
    allocatable: { cpu: string; memory: string; pods: string };
    conditions: Array<{ type: string; status: string; reason?: string; message?: string }>;
    createdAt: string;
  }>> {
    try {
      const data = await this.fetchFromK8sAPI<{ items: any[] }>('/api/v1/nodes');
      
      return data.items.map((node: any) => {
        const conditions = node.status?.conditions || [];
        const readyCondition = conditions.find((c: any) => c.type === 'Ready');
        const addresses = node.status?.addresses || [];
        
        const labels = node.metadata?.labels || {};
        const roles: string[] = [];
        if (labels['node-role.kubernetes.io/control-plane'] !== undefined || 
            labels['node-role.kubernetes.io/master'] !== undefined) {
          roles.push('control-plane', 'master');
        }
        if (labels['node-role.kubernetes.io/worker'] !== undefined || roles.length === 0) {
          roles.push('worker');
        }

        return {
          name: node.metadata?.name,
          status: readyCondition?.status === 'True' ? 'Ready' : 'NotReady',
          roles,
          version: node.status?.nodeInfo?.kubeletVersion || 'unknown',
          internalIP: addresses.find((a: any) => a.type === 'InternalIP')?.address || '',
          externalIP: addresses.find((a: any) => a.type === 'ExternalIP')?.address,
          capacity: {
            cpu: node.status?.capacity?.cpu || '0',
            memory: node.status?.capacity?.memory || '0',
            pods: node.status?.capacity?.pods || '0',
          },
          allocatable: {
            cpu: node.status?.allocatable?.cpu || '0',
            memory: node.status?.allocatable?.memory || '0',
            pods: node.status?.allocatable?.pods || '0',
          },
          conditions: conditions.map((c: any) => ({
            type: c.type,
            status: c.status,
            reason: c.reason,
            message: c.message,
          })),
          createdAt: node.metadata?.creationTimestamp,
        };
      });
    } catch (error) {
      console.error('Error fetching nodes:', error);
      return [];
    }
  }

  async getDeployments(filter: DeploymentFilter = {}): Promise<K3sDeployment[]> {
    try {
      const endpoint = filter.namespace 
        ? `/apis/apps/v1/namespaces/${filter.namespace}/deployments`
        : '/apis/apps/v1/deployments';
      
      const data = await this.fetchFromK8sAPI<{ items: any[] }>(endpoint);
      
      let deployments: K3sDeployment[] = data.items.map((dep: any) => ({
        name: dep.metadata?.name,
        namespace: dep.metadata?.namespace,
        replicas: dep.spec?.replicas || 0,
        readyReplicas: dep.status?.readyReplicas || 0,
        availableReplicas: dep.status?.availableReplicas || 0,
        image: dep.spec?.template?.spec?.containers?.[0]?.image || '',
        labels: dep.metadata?.labels || {},
        creationTimestamp: dep.metadata?.creationTimestamp,
        conditions: (dep.status?.conditions || []).map((c: any) => ({
          type: c.type,
          status: c.status,
          reason: c.reason,
          message: c.message,
          lastTransitionTime: c.lastTransitionTime,
        })),
      }));

      if (filter.environment) {
        deployments = deployments.filter(d => 
          d.labels.environment === filter.environment ||
          d.namespace === filter.environment
        );
      }

      if (filter.labels) {
        deployments = deployments.filter(deployment => {
          return Object.entries(filter.labels!).every(([key, value]) =>
            deployment.labels[key] === value
          );
        });
      }

      return deployments;
    } catch (error) {
      console.error('Error fetching K3s deployments:', error);
      return [];
    }
  }

  async getPods(namespace?: string): Promise<Array<{
    name: string;
    namespace: string;
    status: string;
    ready: string;
    restarts: number;
    age: string;
    node: string;
    ip: string;
  }>> {
    try {
      const endpoint = namespace 
        ? `/api/v1/namespaces/${namespace}/pods`
        : '/api/v1/pods';
      
      const data = await this.fetchFromK8sAPI<{ items: any[] }>(endpoint);
      
      return data.items.map((pod: any) => {
        const containerStatuses = pod.status?.containerStatuses || [];
        const readyCount = containerStatuses.filter((c: any) => c.ready).length;
        const totalCount = containerStatuses.length || pod.spec?.containers?.length || 0;
        const restarts = containerStatuses.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);
        
        const createdAt = new Date(pod.metadata?.creationTimestamp);
        const ageMs = Date.now() - createdAt.getTime();
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const age = ageDays > 0 ? `${ageDays}d${ageHours}h` : `${ageHours}h`;

        return {
          name: pod.metadata?.name,
          namespace: pod.metadata?.namespace,
          status: pod.status?.phase,
          ready: `${readyCount}/${totalCount}`,
          restarts,
          age,
          node: pod.spec?.nodeName || '',
          ip: pod.status?.podIP || '',
        };
      });
    } catch (error) {
      console.error('Error fetching pods:', error);
      return [];
    }
  }

  async getServices(namespace?: string): Promise<Array<{
    name: string;
    namespace: string;
    type: string;
    clusterIP: string;
    externalIP?: string;
    ports: string;
  }>> {
    try {
      const endpoint = namespace 
        ? `/api/v1/namespaces/${namespace}/services`
        : '/api/v1/services';
      
      const data = await this.fetchFromK8sAPI<{ items: any[] }>(endpoint);
      
      return data.items.map((svc: any) => {
        const ports = (svc.spec?.ports || [])
          .map((p: any) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ''}/${p.protocol}`)
          .join(', ');

        return {
          name: svc.metadata?.name,
          namespace: svc.metadata?.namespace,
          type: svc.spec?.type,
          clusterIP: svc.spec?.clusterIP,
          externalIP: svc.status?.loadBalancer?.ingress?.[0]?.ip,
          ports,
        };
      });
    } catch (error) {
      console.error('Error fetching services:', error);
      return [];
    }
  }

  async getNamespaces(): Promise<string[]> {
    try {
      const data = await this.fetchFromK8sAPI<{ items: any[] }>('/api/v1/namespaces');
      return data.items.map((ns: any) => ns.metadata?.name).filter(Boolean);
    } catch (error) {
      console.error('Error fetching namespaces:', error);
      return [];
    }
  }

  async getIngresses(namespace?: string): Promise<Array<{
    name: string;
    namespace: string;
    hosts: string[];
    address: string;
    ports: string;
    age: string;
    className?: string;
  }>> {
    try {
      const endpoint = namespace 
        ? `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses`
        : '/apis/networking.k8s.io/v1/ingresses';
      
      const data = await this.fetchFromK8sAPI<{ items: any[] }>(endpoint);
      
      return data.items.map((ing: any) => {
        const rules = ing.spec?.rules || [];
        const hosts = rules.map((r: any) => r.host).filter(Boolean);
        const lbIngress = ing.status?.loadBalancer?.ingress || [];
        const address = lbIngress.map((lb: any) => lb.ip || lb.hostname).join(', ') || '';
        
        const ports: string[] = [];
        if (ing.spec?.tls) {
          ports.push('443');
        }
        if (!ports.includes('80')) {
          ports.push('80');
        }

        const createdAt = new Date(ing.metadata?.creationTimestamp);
        const ageMs = Date.now() - createdAt.getTime();
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const age = ageDays > 0 ? `${ageDays}d${ageHours}h` : `${ageHours}h`;

        return {
          name: ing.metadata?.name,
          namespace: ing.metadata?.namespace,
          hosts,
          address,
          ports: ports.join(', '),
          age,
          className: ing.spec?.ingressClassName,
        };
      });
    } catch (error) {
      console.error('Error fetching ingresses:', error);
      return [];
    }
  }

  async getClusterInfo(): Promise<ClusterInfo[]> {
    try {
      const nodes = await this.getNodes();
      const readyNodes = nodes.filter(n => n.status === 'Ready').length;

      // Calculate resource usage (simplified - in production would use metrics-server)
      let totalCpu = 0;
      let totalMemoryMi = 0;
      
      nodes.forEach(node => {
        // Parse CPU (e.g., "4" cores)
        totalCpu += parseInt(node.capacity.cpu) || 0;
        // Parse memory (e.g., "8Gi" -> 8192 Mi)
        const memMatch = node.capacity.memory.match(/(\d+)(Ki|Mi|Gi)/);
        if (memMatch) {
          const value = parseInt(memMatch[1]);
          const unit = memMatch[2];
          if (unit === 'Gi') totalMemoryMi += value * 1024;
          else if (unit === 'Mi') totalMemoryMi += value;
          else if (unit === 'Ki') totalMemoryMi += value / 1024;
        }
      });

      return [{
        name: 'k3s-hetzner',
        provider: 'k3s',
        region: 'eu-central (Hetzner)',
        endpoint: this.config.apiUrl,
        status: readyNodes === nodes.length ? 'healthy' : (readyNodes > 0 ? 'degraded' : 'unhealthy'),
        nodes: {
          total: nodes.length,
          ready: readyNodes,
        },
        resources: {
          cpu: {
            total: totalCpu,
            used: 0, // Would need metrics-server for actual usage
            percentage: 0,
          },
          memory: {
            total: totalMemoryMi,
            used: 0,
            percentage: 0,
          },
        },
      }];
    } catch (error) {
      console.error('Error fetching K3s cluster info:', error);
      return [];
    }
  }

  async deployApplication(config: {
    namespace: string;
    appName: string;
    image: string;
    replicas: number;
    environment?: string;
    labels?: Record<string, string>;
    envVars?: Record<string, string>;
    port?: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: config.appName,
          namespace: config.namespace,
          labels: {
            app: config.appName,
            ...config.labels,
          },
        },
        spec: {
          replicas: config.replicas,
          selector: {
            matchLabels: { app: config.appName },
          },
          template: {
            metadata: {
              labels: { app: config.appName, ...config.labels },
            },
            spec: {
              containers: [{
                name: config.appName,
                image: config.image,
                ports: config.port ? [{ containerPort: config.port }] : [],
                env: config.envVars 
                  ? Object.entries(config.envVars).map(([name, value]) => ({ name, value }))
                  : [],
              }],
            },
          },
        },
      };

      await this.fetchFromK8sAPI(
        `/apis/apps/v1/namespaces/${config.namespace}/deployments`,
        {
          method: 'POST',
          body: JSON.stringify(deployment),
        }
      );
      return { success: true };
    } catch (error) {
      console.error('Error deploying to K3s:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async scaleDeployment(
    namespace: string,
    deploymentName: string,
    replicas: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.fetchFromK8sAPI(
        `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}/scale`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
          body: JSON.stringify({ spec: { replicas } }),
        }
      );
      return { success: true };
    } catch (error) {
      console.error('Error scaling K3s deployment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteDeployment(
    namespace: string,
    deploymentName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.fetchFromK8sAPI(
        `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`,
        { method: 'DELETE' }
      );
      return { success: true };
    } catch (error) {
      console.error('Error deleting K3s deployment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getDeploymentLogs(
    namespace: string,
    deploymentName: string,
    lines: number = 100
  ): Promise<string[]> {
    try {
      const pods = await this.getPods(namespace);
      const pod = pods.find(p => p.name.startsWith(deploymentName));
      if (!pod) return [];

      const response = await fetch(
        `${this.config.apiUrl}/api/v1/namespaces/${namespace}/pods/${pod.name}/log?tailLines=${lines}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
          },
          // @ts-expect-error - Node.js fetch accepts agent option
          agent: httpsAgent,
        }
      );

      if (!response.ok) return [];
      const text = await response.text();
      return text.split('\n').filter(Boolean);
    } catch (error) {
      console.error('Error fetching K3s deployment logs:', error);
      return [];
    }
  }

  async getDeploymentEvents(
    namespace: string,
    deploymentName: string
  ): Promise<Array<{
    type: 'Normal' | 'Warning';
    reason: string;
    message: string;
    count: number;
    firstTime: string;
    lastTime: string;
  }>> {
    try {
      const data = await this.fetchFromK8sAPI<{ items: any[] }>(
        `/api/v1/namespaces/${namespace}/events?fieldSelector=involvedObject.name=${deploymentName}`
      );
      
      return data.items.map((event: any) => ({
        type: event.type as 'Normal' | 'Warning',
        reason: event.reason,
        message: event.message,
        count: event.count || 1,
        firstTime: event.firstTimestamp,
        lastTime: event.lastTimestamp,
      }));
    } catch (error) {
      console.error('Error fetching K3s deployment events:', error);
      return [];
    }
  }

  async cordonNode(nodeName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.fetchFromK8sAPI(
        `/api/v1/nodes/${nodeName}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
          body: JSON.stringify({ spec: { unschedulable: true } }),
        }
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async uncordonNode(nodeName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.fetchFromK8sAPI(
        `/api/v1/nodes/${nodeName}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
          body: JSON.stringify({ spec: { unschedulable: false } }),
        }
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async drainNode(nodeName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.cordonNode(nodeName);
      
      const pods = await this.getPods();
      const nodePods = pods.filter(p => p.node === nodeName && !p.namespace.startsWith('kube-'));
      
      for (const pod of nodePods) {
        try {
          await this.fetchFromK8sAPI(
            `/api/v1/namespaces/${pod.namespace}/pods/${pod.name}/eviction`,
            {
              method: 'POST',
              body: JSON.stringify({
                apiVersion: 'policy/v1',
                kind: 'Eviction',
                metadata: { name: pod.name, namespace: pod.namespace },
              }),
            }
          );
        } catch {
          await this.fetchFromK8sAPI(
            `/api/v1/namespaces/${pod.namespace}/pods/${pod.name}`,
            { method: 'DELETE' }
          );
        }
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.fetchFromK8sAPI('/api/v1/namespaces');
      return true;
    } catch {
      return false;
    }
  }
}

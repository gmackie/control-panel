import { BaseClusterModule } from './base';
import { KubeconfigManager } from './kubeconfig-manager';
import * as yaml from 'js-yaml';

interface DeploymentConfig {
  name: string;
  namespace: string;
  image: string;
  replicas: number;
  ports?: Array<{ name: string; port: number; targetPort: number }>;
  env?: Record<string, string>;
  secrets?: string[];
  configMaps?: string[];
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  ingress?: {
    enabled: boolean;
    host: string;
    tls?: boolean;
    certIssuer?: string;
  };
}

interface DeploymentStatus {
  name: string;
  namespace: string;
  replicas: {
    desired: number;
    ready: number;
    available: number;
  };
  conditions: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
  }>;
  pods: Array<{
    name: string;
    status: string;
    ready: boolean;
    restarts: number;
    age: string;
  }>;
}

export class DeploymentManager extends BaseClusterModule {
  name = 'deployment-manager';
  version = '1.0.0';
  description = 'Manages application deployments on the cluster';

  private kubeconfigManager: KubeconfigManager;
  private clusterName: string;
  private registryUrl?: string;

  constructor(
    kubeconfigManager: KubeconfigManager,
    clusterName: string,
    registryUrl?: string
  ) {
    super();
    this.kubeconfigManager = kubeconfigManager;
    this.clusterName = clusterName;
    this.registryUrl = registryUrl;
  }

  async initialize(): Promise<void> {
    // Verify kubectl access
    const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);
    await kubectl('version --client --short');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);
      await kubectl('get nodes --no-headers');
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: `Cannot access cluster: ${error}`,
      };
    }
  }

  async deploy(config: DeploymentConfig): Promise<void> {
    const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);

    // Create namespace if it doesn't exist
    await kubectl(
      `create namespace ${config.namespace} --dry-run=client -o yaml | kubectl apply -f -`
    );

    // Generate deployment manifest
    const deploymentManifest = this.generateDeploymentManifest(config);
    
    // Apply deployment
    await kubectl(`apply -f - <<EOF
${yaml.dump(deploymentManifest)}
EOF`);

    // Create service if ports are defined
    if (config.ports && config.ports.length > 0) {
      const serviceManifest = this.generateServiceManifest(config);
      await kubectl(`apply -f - <<EOF
${yaml.dump(serviceManifest)}
EOF`);
    }

    // Create ingress if configured
    if (config.ingress?.enabled) {
      const ingressManifest = this.generateIngressManifest(config);
      await kubectl(`apply -f - <<EOF
${yaml.dump(ingressManifest)}
EOF`);
    }

    // Wait for deployment to be ready
    await this.waitForDeploymentReady(config.name, config.namespace);
  }

  async getDeploymentStatus(name: string, namespace: string): Promise<DeploymentStatus> {
    const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);

    // Get deployment info
    const deploymentJson = await kubectl(
      `get deployment ${name} -n ${namespace} -o json`
    );
    const deployment = JSON.parse(deploymentJson);

    // Get pods
    const podsJson = await kubectl(
      `get pods -n ${namespace} -l app=${name} -o json`
    );
    const pods = JSON.parse(podsJson);

    return {
      name,
      namespace,
      replicas: {
        desired: deployment.spec.replicas,
        ready: deployment.status.readyReplicas || 0,
        available: deployment.status.availableReplicas || 0,
      },
      conditions: deployment.status.conditions || [],
      pods: pods.items.map((pod: any) => ({
        name: pod.metadata.name,
        status: pod.status.phase,
        ready: pod.status.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True',
        restarts: pod.status.containerStatuses?.[0]?.restartCount || 0,
        age: this.calculateAge(pod.metadata.creationTimestamp),
      })),
    };
  }

  async scale(name: string, namespace: string, replicas: number): Promise<void> {
    const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);
    await kubectl(`scale deployment ${name} -n ${namespace} --replicas=${replicas}`);
  }

  async restart(name: string, namespace: string): Promise<void> {
    const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);
    await kubectl(`rollout restart deployment ${name} -n ${namespace}`);
  }

  async delete(name: string, namespace: string): Promise<void> {
    const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);
    
    // Delete ingress if exists
    try {
      await kubectl(`delete ingress ${name} -n ${namespace}`);
    } catch {
      // Ingress might not exist
    }

    // Delete service if exists
    try {
      await kubectl(`delete service ${name} -n ${namespace}`);
    } catch {
      // Service might not exist
    }

    // Delete deployment
    await kubectl(`delete deployment ${name} -n ${namespace}`);
  }

  async getLogs(
    name: string,
    namespace: string,
    options?: {
      container?: string;
      tail?: number;
      follow?: boolean;
      previous?: boolean;
    }
  ): Promise<string> {
    const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);
    
    let command = `logs deployment/${name} -n ${namespace}`;
    
    if (options?.container) {
      command += ` -c ${options.container}`;
    }
    if (options?.tail) {
      command += ` --tail=${options.tail}`;
    }
    if (options?.previous) {
      command += ' --previous';
    }
    
    return await kubectl(command);
  }

  async exec(
    podName: string,
    namespace: string,
    command: string,
    container?: string
  ): Promise<string> {
    const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);
    
    let execCommand = `exec ${podName} -n ${namespace}`;
    if (container) {
      execCommand += ` -c ${container}`;
    }
    execCommand += ` -- ${command}`;
    
    return await kubectl(execCommand);
  }

  async updateImage(
    name: string,
    namespace: string,
    image: string,
    container?: string
  ): Promise<void> {
    const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);
    
    let command = `set image deployment/${name}`;
    if (container) {
      command += ` ${container}=${image}`;
    } else {
      command += ` ${name}=${image}`;
    }
    command += ` -n ${namespace}`;
    
    await kubectl(command);
    await this.waitForDeploymentReady(name, namespace);
  }

  private generateDeploymentManifest(config: DeploymentConfig): any {
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: config.name,
        namespace: config.namespace,
        labels: {
          app: config.name,
          'managed-by': 'gmac-control-panel',
        },
      },
      spec: {
        replicas: config.replicas,
        selector: {
          matchLabels: {
            app: config.name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: config.name,
            },
          },
          spec: {
            containers: [{
              name: config.name,
              image: this.getFullImageUrl(config.image),
              ports: config.ports?.map(p => ({
                name: p.name,
                containerPort: p.targetPort || p.port,
              })),
              env: config.env ? Object.entries(config.env).map(([name, value]) => ({
                name,
                value,
              })) : undefined,
              envFrom: [
                ...(config.configMaps?.map(name => ({
                  configMapRef: { name },
                })) || []),
                ...(config.secrets?.map(name => ({
                  secretRef: { name },
                })) || []),
              ].filter(Boolean),
              resources: config.resources,
            }],
          },
        },
      },
    };

    return deployment;
  }

  private generateServiceManifest(config: DeploymentConfig): any {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: config.name,
        namespace: config.namespace,
        labels: {
          app: config.name,
          'managed-by': 'gmac-control-panel',
        },
      },
      spec: {
        selector: {
          app: config.name,
        },
        ports: config.ports?.map(p => ({
          name: p.name,
          port: p.port,
          targetPort: p.targetPort || p.port,
        })),
      },
    };
  }

  private generateIngressManifest(config: DeploymentConfig): any {
    if (!config.ingress) return null;

    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: config.name,
        namespace: config.namespace,
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          ...(config.ingress.tls && {
            'cert-manager.io/cluster-issuer': config.ingress.certIssuer || 'letsencrypt-prod',
          }),
        },
        labels: {
          app: config.name,
          'managed-by': 'gmac-control-panel',
        },
      },
      spec: {
        ...(config.ingress.tls && {
          tls: [{
            hosts: [config.ingress.host],
            secretName: `${config.name}-tls`,
          }],
        }),
        rules: [{
          host: config.ingress.host,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: config.name,
                  port: {
                    number: config.ports?.[0]?.port || 80,
                  },
                },
              },
            }],
          },
        }],
      },
    };
  }

  private getFullImageUrl(image: string): string {
    // If image already has a registry URL, return as-is
    if (image.includes('/') || image.includes(':')) {
      return image;
    }

    // Otherwise, prepend our registry URL
    if (this.registryUrl) {
      return `${this.registryUrl}/${image}`;
    }

    return image;
  }

  private async waitForDeploymentReady(
    name: string,
    namespace: string,
    timeout = 300000
  ): Promise<void> {
    const kubectl = this.kubeconfigManager.getKubectlCommand(this.clusterName);
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await kubectl(
          `wait --for=condition=available --timeout=10s deployment/${name} -n ${namespace}`
        );
        return;
      } catch {
        // Not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Deployment ${name} failed to become ready within timeout`);
  }

  private calculateAge(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = now - then;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
}
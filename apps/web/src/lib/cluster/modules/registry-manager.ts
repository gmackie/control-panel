import { BaseClusterModule } from './base';
import { KubeconfigManager } from './kubeconfig-manager';

interface RegistryConfig {
  type: 'harbor' | 'registry' | 'distribution';
  url: string;
  auth: {
    username: string;
    password: string;
  };
  storage: {
    type: 's3' | 'filesystem' | 'azure' | 'gcs';
    config: Record<string, any>;
  };
  replicas?: number;
  cache?: {
    enabled: boolean;
    maxSize?: string;
    ttl?: string;
  };
  garbage?: {
    enabled: boolean;
    schedule?: string;
    dryRun?: boolean;
  };
}

interface RegistryRepository {
  name: string;
  tags: string[];
  size: number;
  pullCount: number;
  lastModified: Date;
}

interface RegistryStats {
  totalRepositories: number;
  totalTags: number;
  totalSize: number;
  totalPullCount: number;
}

export class RegistryManager extends BaseClusterModule {
  name = 'registry-manager';
  version = '1.0.0';
  description = 'Manages dedicated Docker registry for the cluster';

  private config: RegistryConfig;
  private kubeconfigManager: KubeconfigManager;
  private registryNamespace = 'registry';

  constructor(config: RegistryConfig, kubeconfigManager: KubeconfigManager) {
    super();
    this.config = config;
    this.kubeconfigManager = kubeconfigManager;
  }

  async initialize(): Promise<void> {
    // Deploy registry if not exists
    const registryExists = await this.checkRegistryExists();
    if (!registryExists) {
      await this.deployRegistry();
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const response = await fetch(`https://${this.config.url}/v2/`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${this.config.auth.username}:${this.config.auth.password}`
          ).toString('base64')}`,
        },
      });

      if (response.ok) {
        return { healthy: true };
      } else {
        return {
          healthy: false,
          message: `Registry returned status ${response.status}`,
        };
      }
    } catch (error) {
      return {
        healthy: false,
        message: `Failed to connect to registry: ${error}`,
      };
    }
  }

  async deployRegistry(): Promise<void> {
    const kubectl = this.kubeconfigManager.getKubectlCommand('default');

    // Create namespace
    await kubectl(`create namespace ${this.registryNamespace} --dry-run=client -o yaml | kubectl apply -f -`);

    if (this.config.type === 'harbor') {
      await this.deployHarbor();
    } else {
      await this.deployDockerRegistry();
    }
  }

  private async deployHarbor(): Promise<void> {
    const harborValues = {
      expose: {
        type: 'ingress',
        tls: {
          enabled: true,
          certSource: 'auto',
        },
        ingress: {
          hosts: {
            core: this.config.url,
          },
          className: 'nginx',
        },
      },
      harborAdminPassword: this.config.auth.password,
      persistence: {
        enabled: true,
        persistentVolumeClaim: {
          registry: {
            size: '100Gi',
          },
          database: {
            size: '10Gi',
          },
          redis: {
            size: '2Gi',
          },
        },
      },
      ...this.getStorageConfig(),
    };

    const valuesYaml = this.generateValuesYaml(harborValues);
    const kubectl = this.kubeconfigManager.getKubectlCommand('default');

    // Install Harbor using Helm
    const helmCmd = `
      helm repo add harbor https://helm.goharbor.io
      helm repo update
      echo '${valuesYaml}' | helm upgrade --install harbor harbor/harbor \\
        --namespace ${this.registryNamespace} \\
        --create-namespace \\
        --values -
    `;

    await kubectl(helmCmd);
  }

  private async deployDockerRegistry(): Promise<void> {
    const kubectl = this.kubeconfigManager.getKubectlCommand('default');

    // Create auth secret
    const authSecret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'registry-auth',
        namespace: this.registryNamespace,
      },
      type: 'Opaque',
      data: {
        'htpasswd': Buffer.from(
          await this.generateHtpasswd(
            this.config.auth.username,
            this.config.auth.password
          )
        ).toString('base64'),
      },
    };

    await kubectl(`apply -f - <<EOF
${JSON.stringify(authSecret, null, 2)}
EOF`);

    // Create registry deployment
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'docker-registry',
        namespace: this.registryNamespace,
      },
      spec: {
        replicas: this.config.replicas || 1,
        selector: {
          matchLabels: {
            app: 'docker-registry',
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'docker-registry',
            },
          },
          spec: {
            containers: [{
              name: 'registry',
              image: 'registry:2',
              ports: [{
                containerPort: 5000,
                name: 'registry',
              }],
              env: [
                {
                  name: 'REGISTRY_AUTH',
                  value: 'htpasswd',
                },
                {
                  name: 'REGISTRY_AUTH_HTPASSWD_REALM',
                  value: 'Registry Realm',
                },
                {
                  name: 'REGISTRY_AUTH_HTPASSWD_PATH',
                  value: '/auth/htpasswd',
                },
                ...this.getStorageEnvVars(),
              ],
              volumeMounts: [
                {
                  name: 'auth',
                  mountPath: '/auth',
                  readOnly: true,
                },
                {
                  name: 'data',
                  mountPath: '/var/lib/registry',
                },
              ],
              livenessProbe: {
                httpGet: {
                  path: '/v2/',
                  port: 5000,
                },
                initialDelaySeconds: 10,
                periodSeconds: 30,
              },
              readinessProbe: {
                httpGet: {
                  path: '/v2/',
                  port: 5000,
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
            }],
            volumes: [
              {
                name: 'auth',
                secret: {
                  secretName: 'registry-auth',
                },
              },
              {
                name: 'data',
                persistentVolumeClaim: {
                  claimName: 'registry-data',
                },
              },
            ],
          },
        },
      },
    };

    await kubectl(`apply -f - <<EOF
${JSON.stringify(deployment, null, 2)}
EOF`);

    // Create service
    await this.createRegistryService();

    // Create ingress
    await this.createRegistryIngress();
  }

  private async createRegistryService(): Promise<void> {
    const kubectl = this.kubeconfigManager.getKubectlCommand('default');

    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'docker-registry',
        namespace: this.registryNamespace,
      },
      spec: {
        selector: {
          app: 'docker-registry',
        },
        ports: [{
          name: 'registry',
          port: 5000,
          targetPort: 5000,
        }],
      },
    };

    await kubectl(`apply -f - <<EOF
${JSON.stringify(service, null, 2)}
EOF`);
  }

  private async createRegistryIngress(): Promise<void> {
    const kubectl = this.kubeconfigManager.getKubectlCommand('default');

    const ingress = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'docker-registry',
        namespace: this.registryNamespace,
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          'nginx.ingress.kubernetes.io/proxy-body-size': '0',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
        },
      },
      spec: {
        tls: [{
          hosts: [this.config.url],
          secretName: 'registry-tls',
        }],
        rules: [{
          host: this.config.url,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: 'docker-registry',
                  port: {
                    number: 5000,
                  },
                },
              },
            }],
          },
        }],
      },
    };

    await kubectl(`apply -f - <<EOF
${JSON.stringify(ingress, null, 2)}
EOF`);
  }

  async listRepositories(): Promise<RegistryRepository[]> {
    const response = await this.registryRequest('GET', '/v2/_catalog');
    const { repositories } = await response.json();

    const repoDetails = await Promise.all(
      repositories.map(async (repo: string) => {
        const tags = await this.listTags(repo);
        const details = await this.getRepositoryDetails(repo);
        
        return {
          name: repo,
          tags: tags,
          size: details.size,
          pullCount: details.pullCount,
          lastModified: details.lastModified,
        };
      })
    );

    return repoDetails;
  }

  async listTags(repository: string): Promise<string[]> {
    const response = await this.registryRequest(
      'GET',
      `/v2/${repository}/tags/list`
    );
    const { tags } = await response.json();
    return tags || [];
  }

  async deleteImage(repository: string, tag: string): Promise<void> {
    // Get manifest digest
    const manifestResponse = await this.registryRequest(
      'HEAD',
      `/v2/${repository}/manifests/${tag}`,
      {
        headers: {
          'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
        },
      }
    );

    const digest = manifestResponse.headers.get('Docker-Content-Digest');
    if (!digest) {
      throw new Error('Could not get image digest');
    }

    // Delete by digest
    await this.registryRequest(
      'DELETE',
      `/v2/${repository}/manifests/${digest}`
    );
  }

  async getStats(): Promise<RegistryStats> {
    const repositories = await this.listRepositories();

    return {
      totalRepositories: repositories.length,
      totalTags: repositories.reduce((sum, repo) => sum + repo.tags.length, 0),
      totalSize: repositories.reduce((sum, repo) => sum + repo.size, 0),
      totalPullCount: repositories.reduce((sum, repo) => sum + repo.pullCount, 0),
    };
  }

  async runGarbageCollection(): Promise<void> {
    if (!this.config.garbage?.enabled) {
      throw new Error('Garbage collection is not enabled');
    }

    const kubectl = this.kubeconfigManager.getKubectlCommand('default');

    // Create a job to run garbage collection
    const job = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: `registry-gc-${Date.now()}`,
        namespace: this.registryNamespace,
      },
      spec: {
        template: {
          spec: {
            restartPolicy: 'Never',
            containers: [{
              name: 'garbage-collect',
              image: 'registry:2',
              command: [
                'bin/registry',
                'garbage-collect',
                '/etc/docker/registry/config.yml',
                this.config.garbage.dryRun ? '--dry-run' : '',
              ].filter(Boolean),
              volumeMounts: [{
                name: 'data',
                mountPath: '/var/lib/registry',
              }],
            }],
            volumes: [{
              name: 'data',
              persistentVolumeClaim: {
                claimName: 'registry-data',
              },
            }],
          },
        },
      },
    };

    await kubectl(`apply -f - <<EOF
${JSON.stringify(job, null, 2)}
EOF`);
  }

  private async checkRegistryExists(): Promise<boolean> {
    try {
      const kubectl = this.kubeconfigManager.getKubectlCommand('default');
      const result = await kubectl(
        `get deployment -n ${this.registryNamespace} -o name | grep -E '(harbor|registry)'`
      );
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  private getStorageConfig(): Record<string, any> {
    switch (this.config.storage.type) {
      case 's3':
        return {
          imageChartStorage: {
            type: 's3',
            s3: {
              region: this.config.storage.config.region,
              bucket: this.config.storage.config.bucket,
              accesskey: this.config.storage.config.accessKey,
              secretkey: this.config.storage.config.secretKey,
              regionendpoint: this.config.storage.config.endpoint,
            },
          },
        };
      case 'filesystem':
      default:
        return {
          imageChartStorage: {
            type: 'filesystem',
          },
        };
    }
  }

  private getStorageEnvVars(): Array<{ name: string; value: string }> {
    const envVars: Array<{ name: string; value: string }> = [];

    switch (this.config.storage.type) {
      case 's3':
        envVars.push(
          { name: 'REGISTRY_STORAGE', value: 's3' },
          { name: 'REGISTRY_STORAGE_S3_ACCESSKEY', value: this.config.storage.config.accessKey },
          { name: 'REGISTRY_STORAGE_S3_SECRETKEY', value: this.config.storage.config.secretKey },
          { name: 'REGISTRY_STORAGE_S3_REGION', value: this.config.storage.config.region },
          { name: 'REGISTRY_STORAGE_S3_BUCKET', value: this.config.storage.config.bucket }
        );
        if (this.config.storage.config.endpoint) {
          envVars.push({
            name: 'REGISTRY_STORAGE_S3_REGIONENDPOINT',
            value: this.config.storage.config.endpoint,
          });
        }
        break;
      case 'filesystem':
      default:
        envVars.push(
          { name: 'REGISTRY_STORAGE', value: 'filesystem' },
          { name: 'REGISTRY_STORAGE_FILESYSTEM_ROOTDIRECTORY', value: '/var/lib/registry' }
        );
    }

    if (this.config.cache?.enabled) {
      envVars.push(
        { name: 'REGISTRY_STORAGE_CACHE_BLOBDESCRIPTOR', value: 'inmemory' }
      );
    }

    return envVars;
  }

  private async generateHtpasswd(username: string, password: string): Promise<string> {
    // Use bcrypt to hash password
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    return `${username}:${hash}`;
  }

  private generateValuesYaml(values: any): string {
    const yaml = require('js-yaml');
    return yaml.dump(values);
  }

  private async registryRequest(
    method: string,
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `https://${this.config.url}${path}`;
    const auth = Buffer.from(
      `${this.config.auth.username}:${this.config.auth.password}`
    ).toString('base64');

    return fetch(url, {
      ...options,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        ...options.headers,
      },
    });
  }

  private async getRepositoryDetails(repository: string): Promise<{
    size: number;
    pullCount: number;
    lastModified: Date;
  }> {
    // This would typically query registry metrics or database
    // For now, return mock data
    return {
      size: Math.floor(Math.random() * 1000000000), // Random size up to 1GB
      pullCount: Math.floor(Math.random() * 1000),
      lastModified: new Date(),
    };
  }
}
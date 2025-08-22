import { ClusterOrchestrator } from '@/lib/cluster/orchestrator';
import { GiteaManager } from './gitea-manager';
import { GiteaClient } from '@/lib/gitea/client';
import { 
  Infrastructure, 
  InfrastructureType, 
  K3sInfraConfig, 
  GiteaVPSInfraConfig,
  UnifiedApplication,
  ApplicationDeployment
} from './types';

export interface InfrastructureManagerConfig {
  hetznerApiToken: string;
  sshKeyPath: string;
  kubeconfigEncryptionKey?: string;
}

export class InfrastructureManager {
  private config: InfrastructureManagerConfig;
  private k3sOrchestrator?: ClusterOrchestrator;
  private giteaManager?: GiteaManager;
  private infrastructures: Map<string, Infrastructure> = new Map();

  constructor(config: InfrastructureManagerConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Load existing infrastructures from storage/database
    await this.loadInfrastructures();
  }

  async listInfrastructures(): Promise<Infrastructure[]> {
    return Array.from(this.infrastructures.values());
  }

  async getInfrastructure(id: string): Promise<Infrastructure | undefined> {
    return this.infrastructures.get(id);
  }

  async createK3sCluster(config: Omit<K3sInfraConfig, 'type'>): Promise<Infrastructure> {
    const id = `k3s-${Date.now()}`;
    
    // Initialize K3s orchestrator
    this.k3sOrchestrator = new ClusterOrchestrator({
      hetznerApiToken: this.config.hetznerApiToken,
      sshKeyPath: this.config.sshKeyPath,
      clusterName: config.clusterName,
      kubeconfigEncryptionKey: this.config.kubeconfigEncryptionKey,
      registry: config.features.registry ? {
        enabled: true,
        type: 'harbor',
        url: `registry.${config.clusterName}.local`,
        auth: {
          username: 'admin',
          password: 'Harbor12345', // Should be generated
        },
        storage: {
          type: 's3',
          config: {},
        },
      } : undefined,
      autoscaling: config.features.autoscaling ? {
        enabled: true,
        checkInterval: 60,
        dryRun: false,
        defaultServerType: config.serverType,
        defaultLocation: config.location,
        policies: [],
      } : undefined,
      healthMonitoring: config.features.monitoring ? {
        enabled: true,
        checkInterval: 30,
        metricsRetention: 7,
        thresholds: {
          cpu: { warning: 70, critical: 90 },
          memory: { warning: 80, critical: 95 },
          disk: { warning: 80, critical: 90 },
          heartbeat: { warning: 60, critical: 120 },
        },
      } : undefined,
    });

    await this.k3sOrchestrator.initialize();

    const infrastructure: Infrastructure = {
      id,
      name: config.clusterName,
      type: 'k3s',
      status: 'provisioning',
      endpoint: `https://${config.clusterName}.k3s.local:6443`,
      created: new Date(),
      updated: new Date(),
      config: { ...config, type: 'k3s' },
      resources: {
        nodes: config.masterNodes + config.workerNodes,
      },
    };

    this.infrastructures.set(id, infrastructure);
    await this.saveInfrastructure(infrastructure);

    // Start provisioning in background
    this.provisionK3sCluster(id, config).catch(console.error);

    return infrastructure;
  }

  async createGiteaVPS(config: Omit<GiteaVPSInfraConfig, 'type'>): Promise<Infrastructure> {
    const id = `gitea-${Date.now()}`;
    
    // Initialize Gitea manager
    this.giteaManager = new GiteaManager(this.config.hetznerApiToken, {
      serverName: config.serverName,
      serverType: config.serverType,
      location: config.location,
      sshKeyPath: this.config.sshKeyPath,
      domain: config.domain,
      email: 'admin@' + config.domain,
      useHttps: true,
      enableActions: config.features.actions,
      enableRegistry: config.features.registry,
    });

    const infrastructure: Infrastructure = {
      id,
      name: config.serverName,
      type: 'gitea-vps',
      status: 'provisioning',
      endpoint: `https://${config.domain}`,
      created: new Date(),
      updated: new Date(),
      config: { ...config, type: 'gitea-vps' },
      resources: {
        nodes: 1,
      },
    };

    this.infrastructures.set(id, infrastructure);
    await this.saveInfrastructure(infrastructure);

    // Start provisioning in background
    this.provisionGiteaVPS(id, config).catch(console.error);

    return infrastructure;
  }

  private async provisionK3sCluster(id: string, config: Omit<K3sInfraConfig, 'type'>): Promise<void> {
    try {
      const infrastructure = this.infrastructures.get(id);
      if (!infrastructure || !this.k3sOrchestrator) return;

      // Provision master nodes
      for (let i = 0; i < config.masterNodes; i++) {
        await this.k3sOrchestrator.onboardNode({
          serverType: config.serverType,
          location: config.location,
          role: 'master',
          nodeName: `${config.clusterName}-master-${i}`,
        });
      }

      // Provision worker nodes
      for (let i = 0; i < config.workerNodes; i++) {
        await this.k3sOrchestrator.onboardNode({
          serverType: config.serverType,
          location: config.location,
          role: 'worker',
          nodeName: `${config.clusterName}-worker-${i}`,
        });
      }

      // Update status
      infrastructure.status = 'active';
      infrastructure.updated = new Date();
      await this.saveInfrastructure(infrastructure);
    } catch (error) {
      console.error('Failed to provision K3s cluster:', error);
      const infrastructure = this.infrastructures.get(id);
      if (infrastructure) {
        infrastructure.status = 'error';
        infrastructure.updated = new Date();
        await this.saveInfrastructure(infrastructure);
      }
    }
  }

  private async provisionGiteaVPS(id: string, config: Omit<GiteaVPSInfraConfig, 'type'>): Promise<void> {
    try {
      const infrastructure = this.infrastructures.get(id);
      if (!infrastructure || !this.giteaManager) return;

      // Provision VPS
      const { serverId, ip } = await this.giteaManager.provisionGiteaVPS();

      // Deploy Gitea
      await this.giteaManager.deployGitea();

      // Update infrastructure with actual endpoint
      infrastructure.endpoint = `https://${config.domain}`;
      infrastructure.status = 'active';
      infrastructure.updated = new Date();
      await this.saveInfrastructure(infrastructure);
    } catch (error) {
      console.error('Failed to provision Gitea VPS:', error);
      const infrastructure = this.infrastructures.get(id);
      if (infrastructure) {
        infrastructure.status = 'error';
        infrastructure.updated = new Date();
        await this.saveInfrastructure(infrastructure);
      }
    }
  }

  async getUnifiedApplications(): Promise<UnifiedApplication[]> {
    const applications: Map<string, UnifiedApplication> = new Map();

    // Get applications from all infrastructures
    for (const infra of this.infrastructures.values()) {
      if (infra.status !== 'active') continue;

      if (infra.type === 'k3s') {
        await this.addK3sApplications(infra, applications);
      } else if (infra.type === 'gitea-vps') {
        await this.addGiteaApplications(infra, applications);
      }
    }

    return Array.from(applications.values());
  }

  private async addK3sApplications(
    infra: Infrastructure, 
    applications: Map<string, UnifiedApplication>
  ): Promise<void> {
    if (!this.k3sOrchestrator) return;

    try {
      // Get deployments from k3s
      const kubeconfig = await this.k3sOrchestrator.getKubeconfig(infra.config.clusterName);
      if (!kubeconfig) return;

      // This would use kubectl to get deployments
      // For now, return mock data
      const k8sApps = []; // await getK8sDeployments(kubeconfig);

      for (const app of k8sApps) {
        const appId = `${app.namespace}/${app.name}`;
        let unifiedApp = applications.get(appId);

        if (!unifiedApp) {
          unifiedApp = {
            id: appId,
            name: app.name,
            type: 'web',
            created: new Date(),
            updated: new Date(),
            deployments: [],
          };
          applications.set(appId, unifiedApp);
        }

        const deployment: ApplicationDeployment = {
          id: `${infra.id}-${appId}`,
          applicationId: appId,
          infrastructureId: infra.id,
          infrastructureType: 'k3s',
          environment: 'production',
          status: 'running',
          version: app.version || 'latest',
          created: new Date(),
          updated: new Date(),
          runtime: {
            replicas: app.replicas || 1,
            cpu: {
              requested: 0.1,
              limit: 0.5,
              usage: 0.05,
            },
            memory: {
              requested: 128,
              limit: 512,
              usage: 256,
            },
          },
        };

        unifiedApp.deployments.push(deployment);
      }
    } catch (error) {
      console.error('Error getting K3s applications:', error);
    }
  }

  private async addGiteaApplications(
    infra: Infrastructure, 
    applications: Map<string, UnifiedApplication>
  ): Promise<void> {
    const config = infra.config as GiteaVPSInfraConfig;
    
    try {
      const giteaClient = new GiteaClient({
        baseUrl: infra.endpoint,
        token: process.env.GITEA_API_TOKEN, // Should be stored securely
      });

      const repos = await giteaClient.listRepositories({ limit: 100 });

      for (const repo of repos) {
        const appId = repo.full_name;
        let unifiedApp = applications.get(appId);

        if (!unifiedApp) {
          unifiedApp = {
            id: appId,
            name: repo.name,
            description: repo.description,
            type: this.detectAppType(repo),
            language: repo.language,
            created: new Date(repo.created_at),
            updated: new Date(repo.updated_at),
            deployments: [],
            repository: {
              provider: 'gitea',
              url: repo.clone_url,
              private: repo.private,
              defaultBranch: repo.default_branch,
              branches: [],
              lastCommit: {
                sha: repo.default_branch,
                message: 'Latest commit',
                author: repo.owner.login,
                date: new Date(repo.updated_at),
              },
            },
          };
          applications.set(appId, unifiedApp);
        }

        // Get workflow runs for CI/CD info
        if (config.features.actions) {
          const { workflow_runs } = await giteaClient.listWorkflowRuns(
            repo.owner.login,
            repo.name,
            { limit: 1 }
          );

          if (workflow_runs.length > 0) {
            const latestRun = workflow_runs[0];
            const deployment: ApplicationDeployment = {
              id: `${infra.id}-${appId}`,
              applicationId: appId,
              infrastructureId: infra.id,
              infrastructureType: 'gitea-vps',
              environment: 'production',
              status: latestRun.status === 'completed' && latestRun.conclusion === 'success' 
                ? 'running' 
                : 'failed',
              version: latestRun.head_sha.substring(0, 7),
              created: new Date(latestRun.created_at),
              updated: new Date(latestRun.updated_at),
              git: {
                repository: repo.clone_url,
                branch: latestRun.head_branch,
                commit: latestRun.head_sha,
                author: latestRun.actor.login,
                message: latestRun.commit.message,
              },
              cicd: {
                provider: 'gitea-actions',
                workflowId: latestRun.workflow_id,
                runId: latestRun.id.toString(),
                status: latestRun.status,
                conclusion: latestRun.conclusion || undefined,
                duration: latestRun.updated_at 
                  ? new Date(latestRun.updated_at).getTime() - new Date(latestRun.created_at).getTime()
                  : undefined,
              },
            };

            unifiedApp.deployments.push(deployment);
          }
        }
      }
    } catch (error) {
      console.error('Error getting Gitea applications:', error);
    }
  }

  private detectAppType(repo: any): UnifiedApplication['type'] {
    const name = repo.name.toLowerCase();
    if (name.includes('api') || name.includes('service')) return 'api';
    if (name.includes('worker') || name.includes('job')) return 'worker';
    if (name.includes('db') || name.includes('database')) return 'database';
    return 'web';
  }

  async deleteInfrastructure(id: string): Promise<void> {
    const infrastructure = this.infrastructures.get(id);
    if (!infrastructure) return;

    // TODO: Implement actual deletion logic
    // For K3s: delete nodes
    // For Gitea: delete VPS

    this.infrastructures.delete(id);
    await this.removeInfrastructure(id);
  }

  private async loadInfrastructures(): Promise<void> {
    // TODO: Load from database/storage
    // For now, use mock data
  }

  private async saveInfrastructure(infrastructure: Infrastructure): Promise<void> {
    // TODO: Save to database/storage
  }

  private async removeInfrastructure(id: string): Promise<void> {
    // TODO: Remove from database/storage
  }
}
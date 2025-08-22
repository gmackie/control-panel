import { K3sDeployment, GiteaWorkflowRun, Application } from '@/types/deployments';
import { formatDistanceToNow } from 'date-fns';

export interface DeploymentConfig {
  applicationId: string;
  applicationName: string;
  environment: 'development' | 'staging' | 'production';
  branch: string;
  commit?: string;
  deployedBy: string;
  repository?: {
    owner: string;
    name: string;
    url: string;
  };
}

export interface CombinedDeployment {
  id: string;
  applicationId: string;
  applicationName: string;
  environment: 'development' | 'staging' | 'production';
  status: 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'rolled_back';
  version: string;
  commit: {
    sha: string;
    message: string;
    author: string;
    timestamp: Date;
    branch: string;
  };
  pipeline: {
    id: string;
    url: string;
    stages: PipelineStage[];
  };
  cluster: {
    name: string;
    region: string;
    provider: 'k3s' | 'k8s';
  };
  deployment: {
    replicas: number;
    readyReplicas: number;
    image: string;
    namespace: string;
  };
  metrics?: {
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
    latency: number;
  };
  startedAt: Date;
  completedAt?: Date;
  deployedBy: string;
  rollbackTo?: string;
}

export interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  logs?: string[];
}

export interface DeploymentHistory {
  id: string;
  deployment: CombinedDeployment;
  action: 'deployed' | 'rolled_back' | 'scaled' | 'updated';
  timestamp: Date;
  user: string;
  details?: string;
}

export class DeploymentService {
  private deployments: Map<string, CombinedDeployment> = new Map();
  private history: DeploymentHistory[] = [];

  async combineDeploymentData(
    k3sDeployments: K3sDeployment[],
    giteaRuns: GiteaWorkflowRun[]
  ): Promise<CombinedDeployment[]> {
    const combined: CombinedDeployment[] = [];
    
    // Mock data for now - replace with real integration
    const mockDeployments: CombinedDeployment[] = [
      {
        id: 'dep-1',
        applicationId: 'app-1',
        applicationName: 'E-commerce API',
        environment: 'production',
        status: 'running',
        version: '1.2.3',
        commit: {
          sha: 'a7b3c9d',
          message: 'Add payment validation and error handling',
          author: 'john.doe',
          timestamp: new Date('2024-01-20T10:30:00Z'),
          branch: 'main',
        },
        pipeline: {
          id: 'pipeline-1',
          url: 'https://gitea.example.com/repo/actions/runs/123',
          stages: [
            {
              name: 'Build',
              status: 'success',
              startedAt: new Date('2024-01-20T10:25:00Z'),
              completedAt: new Date('2024-01-20T10:27:00Z'),
              duration: 120000,
            },
            {
              name: 'Test',
              status: 'success',
              startedAt: new Date('2024-01-20T10:27:00Z'),
              completedAt: new Date('2024-01-20T10:29:00Z'),
              duration: 90000,
            },
            {
              name: 'Deploy',
              status: 'success',
              startedAt: new Date('2024-01-20T10:29:00Z'),
              completedAt: new Date('2024-01-20T10:30:00Z'),
              duration: 60000,
            },
          ],
        },
        cluster: {
          name: 'hetzner-k3s-prod',
          region: 'eu-central',
          provider: 'k3s',
        },
        deployment: {
          replicas: 3,
          readyReplicas: 3,
          image: 'registry.example.com/ecommerce-api:1.2.3',
          namespace: 'production',
        },
        metrics: {
          cpu: 45,
          memory: 512,
          requests: 150,
          errors: 0.2,
          latency: 85,
        },
        startedAt: new Date('2024-01-20T10:25:00Z'),
        completedAt: new Date('2024-01-20T10:30:00Z'),
        deployedBy: 'john.doe',
        rollbackTo: '1.2.2',
      },
      {
        id: 'dep-2',
        applicationId: 'app-2',
        applicationName: 'Frontend App',
        environment: 'staging',
        status: 'building',
        version: '2.1.0-rc.1',
        commit: {
          sha: 'f4e8a2b',
          message: 'Update UI components and fix responsive layout',
          author: 'jane.smith',
          timestamp: new Date('2024-01-20T11:45:00Z'),
          branch: 'develop',
        },
        pipeline: {
          id: 'pipeline-2',
          url: 'https://gitea.example.com/frontend/actions/runs/124',
          stages: [
            {
              name: 'Install Dependencies',
              status: 'success',
              startedAt: new Date('2024-01-20T11:45:00Z'),
              completedAt: new Date('2024-01-20T11:46:30Z'),
              duration: 90000,
            },
            {
              name: 'Build',
              status: 'running',
              startedAt: new Date('2024-01-20T11:46:30Z'),
              logs: [
                '> next build',
                'Creating an optimized production build...',
                '✓ Compiled successfully',
                'Collecting page data...',
              ],
            },
            {
              name: 'Test',
              status: 'pending',
            },
            {
              name: 'Deploy',
              status: 'pending',
            },
          ],
        },
        cluster: {
          name: 'hetzner-k3s-staging',
          region: 'eu-central',
          provider: 'k3s',
        },
        deployment: {
          replicas: 2,
          readyReplicas: 0,
          image: 'registry.example.com/frontend-app:2.1.0-rc.1',
          namespace: 'staging',
        },
        startedAt: new Date('2024-01-20T11:45:00Z'),
        deployedBy: 'jane.smith',
      },
      {
        id: 'dep-3',
        applicationId: 'app-3',
        applicationName: 'Analytics Service',
        environment: 'development',
        status: 'failed',
        version: '0.5.2',
        commit: {
          sha: 'b2c4d6e',
          message: 'Add new analytics endpoints',
          author: 'bob.wilson',
          timestamp: new Date('2024-01-20T09:15:00Z'),
          branch: 'feature/analytics-v2',
        },
        pipeline: {
          id: 'pipeline-3',
          url: 'https://gitea.example.com/analytics/actions/runs/125',
          stages: [
            {
              name: 'Build',
              status: 'success',
              startedAt: new Date('2024-01-20T09:15:00Z'),
              completedAt: new Date('2024-01-20T09:17:00Z'),
              duration: 120000,
            },
            {
              name: 'Test',
              status: 'failed',
              startedAt: new Date('2024-01-20T09:17:00Z'),
              completedAt: new Date('2024-01-20T09:18:30Z'),
              duration: 90000,
              logs: [
                'Running test suite...',
                'FAIL src/analytics.test.ts',
                '  ● Analytics endpoint returns correct data',
                '    Expected: 200',
                '    Received: 500',
                'Test Suites: 1 failed, 5 passed',
              ],
            },
            {
              name: 'Deploy',
              status: 'skipped',
            },
          ],
        },
        cluster: {
          name: 'local-k3s-dev',
          region: 'local',
          provider: 'k3s',
        },
        deployment: {
          replicas: 1,
          readyReplicas: 0,
          image: 'registry.example.com/analytics-service:0.5.2',
          namespace: 'development',
        },
        startedAt: new Date('2024-01-20T09:15:00Z'),
        completedAt: new Date('2024-01-20T09:18:30Z'),
        deployedBy: 'bob.wilson',
      },
    ];

    return mockDeployments;
  }

  async triggerDeployment(config: DeploymentConfig): Promise<CombinedDeployment> {
    const deploymentId = `dep-${Date.now()}`;
    
    const deployment: CombinedDeployment = {
      id: deploymentId,
      applicationId: config.applicationId,
      applicationName: config.applicationName,
      environment: config.environment,
      status: 'pending',
      version: config.commit?.substring(0, 7) || 'latest',
      commit: {
        sha: config.commit || 'unknown',
        message: 'Triggered manual deployment',
        author: config.deployedBy,
        timestamp: new Date(),
        branch: config.branch,
      },
      pipeline: {
        id: `pipeline-${Date.now()}`,
        url: config.repository ? `${config.repository.url}/actions` : '',
        stages: [
          { name: 'Build', status: 'pending' },
          { name: 'Test', status: 'pending' },
          { name: 'Deploy', status: 'pending' },
        ],
      },
      cluster: {
        name: this.getClusterForEnvironment(config.environment),
        region: 'eu-central',
        provider: 'k3s',
      },
      deployment: {
        replicas: this.getReplicasForEnvironment(config.environment),
        readyReplicas: 0,
        image: `registry.example.com/${config.applicationName.toLowerCase()}:${config.commit?.substring(0, 7) || 'latest'}`,
        namespace: config.environment,
      },
      startedAt: new Date(),
      deployedBy: config.deployedBy,
    };

    // Store deployment
    this.deployments.set(deploymentId, deployment);

    // Add to history
    this.history.unshift({
      id: `hist-${Date.now()}`,
      deployment,
      action: 'deployed',
      timestamp: new Date(),
      user: config.deployedBy,
      details: `Deployed ${config.applicationName} v${deployment.version} to ${config.environment}`,
    });

    // Simulate async deployment process
    setTimeout(() => {
      this.updateDeploymentStatus(deploymentId, 'building');
    }, 1000);

    return deployment;
  }

  async rollbackDeployment(
    deploymentId: string, 
    targetVersion: string, 
    options?: { reason?: string; user?: string }
  ): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Update deployment status
    deployment.status = 'rolling_back' as any;
    deployment.rollbackTo = targetVersion;

    // Add to history
    this.history.unshift({
      id: `hist-${Date.now()}`,
      deployment,
      action: 'rolled_back',
      timestamp: new Date(),
      user: options?.user || 'system',
      details: options?.reason || `Rolled back ${deployment.applicationName} from v${deployment.version} to v${targetVersion}`,
    });

    // Simulate rollback process
    setTimeout(() => {
      deployment.status = 'rolled_back';
      deployment.version = targetVersion;
    }, 5000);
  }

  async getDeployment(deploymentId: string): Promise<CombinedDeployment | null> {
    return this.deployments.get(deploymentId) || null;
  }

  async getDeploymentHistory(options: {
    environment?: string;
    applicationId?: string;
    limit?: number;
  }): Promise<DeploymentHistory[]> {
    let filtered = [...this.history];

    if (options.environment && options.environment !== 'all') {
      filtered = filtered.filter(h => h.deployment.environment === options.environment);
    }

    if (options.applicationId) {
      filtered = filtered.filter(h => h.deployment.applicationId === options.applicationId);
    }

    return filtered.slice(0, options.limit || 20);
  }

  async getApplication(applicationId: string): Promise<Application | null> {
    // Mock application data - replace with real database lookup
    const mockApplications: Application[] = [
      {
        id: 'app-1',
        name: 'E-commerce API',
        description: 'Main e-commerce backend API',
        repository: {
          owner: 'company',
          name: 'ecommerce-api',
          url: 'https://gitea.example.com/company/ecommerce-api',
        },
        giteaRepo: {
          owner: 'company',
          name: 'ecommerce-api',
        },
      },
      {
        id: 'app-2',
        name: 'Frontend App',
        description: 'Customer-facing web application',
        repository: {
          owner: 'company',
          name: 'frontend-app',
          url: 'https://gitea.example.com/company/frontend-app',
        },
        giteaRepo: {
          owner: 'company',
          name: 'frontend-app',
        },
      },
      {
        id: 'app-3',
        name: 'Analytics Service',
        description: 'Analytics and reporting service',
        repository: {
          owner: 'company',
          name: 'analytics-service',
          url: 'https://gitea.example.com/company/analytics-service',
        },
        giteaRepo: {
          owner: 'company',
          name: 'analytics-service',
        },
      },
    ];

    return mockApplications.find(app => app.id === applicationId) || null;
  }

  private updateDeploymentStatus(deploymentId: string, status: CombinedDeployment['status']) {
    const deployment = this.deployments.get(deploymentId);
    if (deployment) {
      deployment.status = status;
      
      // Update pipeline stages based on status
      if (status === 'building') {
        deployment.pipeline.stages[0].status = 'running';
        deployment.pipeline.stages[0].startedAt = new Date();
      } else if (status === 'deploying') {
        deployment.pipeline.stages[0].status = 'success';
        deployment.pipeline.stages[0].completedAt = new Date();
        deployment.pipeline.stages[1].status = 'running';
        deployment.pipeline.stages[1].startedAt = new Date();
      } else if (status === 'running') {
        deployment.pipeline.stages.forEach(stage => {
          if (stage.status !== 'success') {
            stage.status = 'success';
            stage.completedAt = new Date();
          }
        });
        deployment.completedAt = new Date();
        deployment.deployment.readyReplicas = deployment.deployment.replicas;
        
        // Add mock metrics for running deployments
        deployment.metrics = {
          cpu: Math.floor(Math.random() * 80) + 10,
          memory: Math.floor(Math.random() * 800) + 200,
          requests: Math.floor(Math.random() * 200) + 50,
          errors: Math.random() * 2,
          latency: Math.floor(Math.random() * 100) + 50,
        };
      }
    }
  }

  private getClusterForEnvironment(environment: string): string {
    switch (environment) {
      case 'production': return 'hetzner-k3s-prod';
      case 'staging': return 'hetzner-k3s-staging';
      case 'development': return 'local-k3s-dev';
      default: return 'hetzner-k3s-staging';
    }
  }

  private getReplicasForEnvironment(environment: string): number {
    switch (environment) {
      case 'production': return 3;
      case 'staging': return 2;
      case 'development': return 1;
      default: return 1;
    }
  }
}
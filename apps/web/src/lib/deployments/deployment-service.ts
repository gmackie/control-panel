import { K3sDeployment, GiteaWorkflowRun, Application } from '@/types/deployments';
import { GiteaService } from '@/lib/gitea/gitea-service';

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
  private giteaService: GiteaService;

  constructor() {
    this.giteaService = new GiteaService();
  }

  async combineDeploymentData(
    k3sDeployments: K3sDeployment[],
    giteaRuns: GiteaWorkflowRun[]
  ): Promise<CombinedDeployment[]> {
    const combined: CombinedDeployment[] = [];
    
    // Process real K3s deployments
    for (const deployment of k3sDeployments) {
      // Try to find a matching workflow run
      const matchingRun = giteaRuns.find(run => 
        run.repository?.name === deployment.name ||
        deployment.labels.app === run.repository?.name
      );

      // Determine environment from namespace or labels
      const environment = this.inferEnvironment(deployment.namespace, deployment.labels);
      
      // Determine status
      let status: CombinedDeployment['status'] = 'running';
      if (deployment.readyReplicas === 0) {
        status = deployment.replicas > 0 ? 'deploying' : 'failed';
      } else if (deployment.readyReplicas < deployment.replicas) {
        status = 'deploying';
      }

      // Check for failed conditions
      const failedCondition = deployment.conditions?.find(c => 
        c.type === 'Available' && c.status === 'False'
      );
      if (failedCondition) {
        status = 'failed';
      }

      // Extract version from image tag
      const imageTag = deployment.image.split(':')[1] || 'latest';
      
      combined.push({
        id: `${deployment.namespace}-${deployment.name}`,
        applicationId: deployment.labels.app || deployment.name,
        applicationName: deployment.name,
        environment,
        status,
        version: imageTag,
        commit: {
          sha: matchingRun?.head_sha || deployment.labels.commit || 'unknown',
          message: matchingRun?.head_commit?.message || 'Deployed via kubectl',
          author: matchingRun?.actor?.login || 'system',
          timestamp: new Date(matchingRun?.created_at || deployment.creationTimestamp),
          branch: matchingRun?.head_branch || deployment.labels.branch || 'main',
        },
        pipeline: matchingRun ? {
          id: String(matchingRun.id),
          url: `${process.env.GITEA_URL}/${matchingRun.repository?.full_name}/actions/runs/${matchingRun.id}`,
          stages: this.extractPipelineStages(matchingRun),
        } : {
          id: 'manual',
          url: '',
          stages: [{
            name: 'Deploy',
            status: status === 'running' ? 'success' : status === 'failed' ? 'failed' : 'running',
          }],
        },
        cluster: {
          name: 'k3s-hetzner',
          region: 'eu-central (Hetzner)',
          provider: 'k3s',
        },
        deployment: {
          replicas: deployment.replicas,
          readyReplicas: deployment.readyReplicas,
          image: deployment.image,
          namespace: deployment.namespace,
        },
        startedAt: new Date(deployment.creationTimestamp),
        completedAt: status === 'running' ? new Date() : undefined,
        deployedBy: matchingRun?.actor?.login || 'system',
      });
    }

    // Add workflow runs that don't have corresponding K8s deployments (in-progress builds)
    for (const run of giteaRuns) {
      const hasDeployment = combined.some(d => 
        d.applicationName === run.repository?.name
      );

      if (!hasDeployment && (run.status === 'queued' || run.status === 'in_progress')) {
        combined.push({
          id: `workflow-${run.id}`,
          applicationId: run.repository?.name || 'unknown',
          applicationName: run.repository?.name || run.name,
          environment: this.inferEnvironmentFromBranch(run.head_branch),
          status: run.status === 'in_progress' ? 'building' : 'pending',
          version: run.head_sha.substring(0, 7),
          commit: {
            sha: run.head_sha,
            message: run.head_commit?.message || '',
            author: run.actor?.login || 'unknown',
            timestamp: new Date(run.created_at),
            branch: run.head_branch,
          },
          pipeline: {
            id: String(run.id),
            url: `${process.env.GITEA_URL}/${run.repository?.full_name}/actions/runs/${run.id}`,
            stages: this.extractPipelineStages(run),
          },
          cluster: {
            name: 'k3s-hetzner',
            region: 'eu-central (Hetzner)',
            provider: 'k3s',
          },
          deployment: {
            replicas: 0,
            readyReplicas: 0,
            image: '',
            namespace: this.inferEnvironmentFromBranch(run.head_branch),
          },
          startedAt: new Date(run.created_at),
          deployedBy: run.actor?.login || 'unknown',
        });
      }
    }

    return combined;
  }

  private extractPipelineStages(run: GiteaWorkflowRun): PipelineStage[] {
    if (run.jobs && run.jobs.length > 0) {
      return run.jobs.flatMap(job => 
        (job.steps || []).map(step => ({
          name: step.name,
          status: this.mapStepStatus(step.status, step.conclusion),
          startedAt: step.started_at ? new Date(step.started_at) : undefined,
          completedAt: step.completed_at ? new Date(step.completed_at) : undefined,
        }))
      );
    }

    // Default stages if no job info
    return [
      { name: 'Build', status: this.mapRunStatus(run.status, run.conclusion) },
      { name: 'Test', status: run.status === 'completed' ? this.mapRunStatus(run.status, run.conclusion) : 'pending' },
      { name: 'Deploy', status: run.conclusion === 'success' ? 'success' : 'pending' },
    ];
  }

  private mapStepStatus(status: string, conclusion?: string): PipelineStage['status'] {
    if (status === 'completed') {
      return conclusion === 'success' ? 'success' : 
             conclusion === 'failure' ? 'failed' : 
             conclusion === 'skipped' ? 'skipped' : 'pending';
    }
    return status === 'in_progress' ? 'running' : 'pending';
  }

  private mapRunStatus(status: string, conclusion?: string): PipelineStage['status'] {
    if (status === 'completed') {
      return conclusion === 'success' ? 'success' : 'failed';
    }
    return status === 'in_progress' ? 'running' : 'pending';
  }

  private inferEnvironment(namespace: string, labels: Record<string, string>): 'development' | 'staging' | 'production' {
    // Check labels first
    if (labels.environment) {
      const env = labels.environment.toLowerCase();
      if (env === 'production' || env === 'prod') return 'production';
      if (env === 'staging' || env === 'stage') return 'staging';
      if (env === 'development' || env === 'dev') return 'development';
    }

    // Then check namespace
    const ns = namespace.toLowerCase();
    if (ns.includes('prod')) return 'production';
    if (ns.includes('staging') || ns.includes('stage')) return 'staging';
    if (ns.includes('dev')) return 'development';

    // Default to production for unknown namespaces
    return 'production';
  }

  private inferEnvironmentFromBranch(branch: string): 'development' | 'staging' | 'production' {
    const b = branch.toLowerCase();
    if (b === 'main' || b === 'master') return 'production';
    if (b === 'staging' || b === 'stage') return 'staging';
    return 'development';
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
        name: 'k3s-hetzner',
        region: 'eu-central (Hetzner)',
        provider: 'k3s',
      },
      deployment: {
        replicas: this.getReplicasForEnvironment(config.environment),
        readyReplicas: 0,
        image: `registry.gmac.io/${config.applicationName.toLowerCase()}:${config.commit?.substring(0, 7) || 'latest'}`,
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
    deployment.status = 'rolled_back';
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
    // Try to get real applications from Gitea repositories
    try {
      const repos = await this.giteaService.getRepositories();
      
      for (const repo of repos) {
        if (repo.name === applicationId || repo.id.toString() === applicationId) {
          const [owner, name] = repo.full_name.split('/');
          return {
            id: repo.id.toString(),
            name: repo.name,
            description: repo.description || '',
            repository: {
              owner,
              name,
              url: repo.html_url,
            },
            giteaRepo: {
              owner,
              name,
            },
          };
        }
      }
    } catch (error) {
      console.error('Error fetching application from Gitea:', error);
    }

    return null;
  }

  async getApplications(): Promise<Application[]> {
    try {
      const repos = await this.giteaService.getRepositories();
      
      return repos.map(repo => {
        const [owner, name] = repo.full_name.split('/');
        return {
          id: repo.id.toString(),
          name: repo.name,
          description: repo.description || '',
          repository: {
            owner,
            name,
            url: repo.html_url,
          },
          giteaRepo: {
            owner,
            name,
          },
        };
      });
    } catch (error) {
      console.error('Error fetching applications from Gitea:', error);
      return [];
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

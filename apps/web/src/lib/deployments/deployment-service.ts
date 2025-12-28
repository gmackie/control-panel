import { K3sDeployment, GiteaWorkflowRun, Application } from '@/types/deployments';
import { GiteaService } from '@/lib/gitea/gitea-service';
import { getDbAsync } from '@/lib/db';
import { deploymentHistory, DeploymentHistoryRecord, NewDeploymentHistory } from '@repo/db';
import { desc, eq, and, or, inArray } from 'drizzle-orm';

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
  private giteaService: GiteaService;

  constructor() {
    this.giteaService = new GiteaService();
  }

  private recordToHistory(record: DeploymentHistoryRecord): DeploymentHistory {
    const metadata = record.metadata ? JSON.parse(record.metadata) : {};
    return {
      id: record.id,
      deployment: {
        id: record.deploymentId,
        applicationId: record.applicationId,
        applicationName: record.applicationName,
        environment: record.environment as 'development' | 'staging' | 'production',
        status: record.status as CombinedDeployment['status'],
        version: record.version || 'unknown',
        commit: {
          sha: record.commitSha || 'unknown',
          message: record.commitMessage || '',
          author: record.triggeredBy,
          timestamp: record.startedAt,
          branch: record.branch || 'main',
        },
        pipeline: metadata.pipeline || { id: 'manual', url: '', stages: [] },
        cluster: metadata.cluster || { name: 'k3s-hetzner', region: 'eu-central', provider: 'k3s' },
        deployment: {
          replicas: record.replicas || 1,
          readyReplicas: record.status === 'running' ? (record.replicas || 1) : 0,
          image: record.image || '',
          namespace: record.environment,
        },
        startedAt: record.startedAt,
        completedAt: record.completedAt || undefined,
        deployedBy: record.triggeredBy,
      },
      action: record.action as DeploymentHistory['action'],
      timestamp: record.createdAt,
      user: record.triggeredBy,
      details: record.details || undefined,
    };
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
    const db = await getDbAsync();
    const deploymentId = `dep-${Date.now()}`;
    const now = new Date();
    
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
        timestamp: now,
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
      startedAt: now,
      deployedBy: config.deployedBy,
    };

    if (db) {
      const historyRecord: NewDeploymentHistory = {
        deploymentId,
        applicationId: config.applicationId,
        applicationName: config.applicationName,
        environment: config.environment,
        action: 'deployed',
        version: deployment.version,
        commitSha: config.commit || null,
        commitMessage: 'Triggered manual deployment',
        branch: config.branch,
        image: deployment.deployment.image,
        replicas: deployment.deployment.replicas,
        status: 'pending',
        triggeredBy: config.deployedBy,
        details: `Deployed ${config.applicationName} v${deployment.version} to ${config.environment}`,
        metadata: JSON.stringify({
          pipeline: deployment.pipeline,
          cluster: deployment.cluster,
        }),
        startedAt: now,
        createdAt: now,
      };
      await db.insert(deploymentHistory).values(historyRecord);
    }

    return deployment;
  }

  async rollbackDeployment(
    deploymentId: string, 
    targetVersion: string, 
    options?: { reason?: string; user?: string }
  ): Promise<void> {
    const db = await getDbAsync();
    if (!db) throw new Error('Database not available');

    const results = await db
      .select()
      .from(deploymentHistory)
      .where(eq(deploymentHistory.deploymentId, deploymentId))
      .orderBy(desc(deploymentHistory.createdAt))
      .limit(1);

    if (results.length === 0) {
      throw new Error('Deployment not found');
    }

    const original = results[0];
    const now = new Date();
    
    const rollbackRecord: NewDeploymentHistory = {
      deploymentId: `rollback-${Date.now()}`,
      applicationId: original.applicationId,
      applicationName: original.applicationName,
      environment: original.environment,
      action: 'rolled_back',
      version: targetVersion,
      commitSha: original.commitSha,
      commitMessage: original.commitMessage,
      branch: original.branch,
      image: original.image,
      replicas: original.replicas,
      status: 'rolled_back',
      triggeredBy: options?.user || 'system',
      details: options?.reason || `Rolled back ${original.applicationName} from v${original.version} to v${targetVersion}`,
      metadata: original.metadata,
      startedAt: now,
      completedAt: now,
      createdAt: now,
    };

    await db.insert(deploymentHistory).values(rollbackRecord);
  }

  async getDeployment(deploymentId: string): Promise<CombinedDeployment | null> {
    const db = await getDbAsync();
    if (!db) return null;

    const results = await db
      .select()
      .from(deploymentHistory)
      .where(eq(deploymentHistory.deploymentId, deploymentId))
      .orderBy(desc(deploymentHistory.createdAt))
      .limit(1);

    if (results.length === 0) return null;

    return this.recordToHistory(results[0]).deployment;
  }

  async getDeploymentHistory(options: {
    environment?: string;
    applicationId?: string;
    limit?: number;
  }): Promise<DeploymentHistory[]> {
    const db = await getDbAsync();
    if (!db) return [];

    const conditions = [];

    if (options.environment && options.environment !== 'all') {
      conditions.push(eq(deploymentHistory.environment, options.environment));
    }

    if (options.applicationId) {
      conditions.push(eq(deploymentHistory.applicationId, options.applicationId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(deploymentHistory)
      .where(whereClause)
      .orderBy(desc(deploymentHistory.createdAt))
      .limit(options.limit || 20);

    return results.map(r => this.recordToHistory(r));
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

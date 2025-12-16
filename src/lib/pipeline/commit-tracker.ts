/**
 * Commit Tracker Service
 * Tracks commits from push to production deployment
 * Uses in-memory storage when database is not available
 */

import { getDbAsync } from '@/lib/db';
import { 
  commits, 
  pipelineRuns, 
  pipelineStages,
  deploymentEvents, 
  webhookEvents,
  environmentStatus 
} from '@/lib/schema';
import { GiteaService } from '@/lib/gitea/gitea-service';
import { K3sService } from '@/lib/k3s/k3s-service';

// Helper to get drizzle operators dynamically (avoids loading at build time)
async function getDrizzleOps() {
  const { eq, desc, and } = await import('drizzle-orm');
  return { eq, desc, and };
}

// Generate simple unique IDs without uuid dependency
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail?: string;
  authorAvatar?: string;
  branch: string;
  repository: string;
  timestamp: string;
  url?: string;
  parentSha?: string;
}

export interface PipelineInfo {
  id: string;
  commitSha: string;
  repository: string;
  workflowName: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled';
  conclusion?: string;
  branch: string;
  event: string;
  triggeredBy?: string;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  url?: string;
  stages: StageInfo[];
}

export interface StageInfo {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped';
  order: number;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
}

export interface DeploymentInfo {
  id: string;
  commitSha: string;
  repository: string;
  environment: 'staging' | 'production';
  namespace: string;
  deploymentName: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';
  imageTag: string;
  imageDigest?: string;
  replicas?: number;
  readyReplicas?: number;
  previousImageTag?: string;
  deployedBy?: string;
  deployedAt?: string;
  healthCheckStatus?: 'healthy' | 'unhealthy' | 'unknown';
  url?: string;
}

export interface CommitJourney {
  commit: CommitInfo;
  pipelines: PipelineInfo[];
  deployments: {
    staging?: DeploymentInfo;
    production?: DeploymentInfo;
  };
  status: 'pending' | 'building' | 'testing' | 'staging' | 'production' | 'failed';
  percentComplete: number;
}

export interface EnvironmentComparison {
  repository: string;
  staging: {
    commitSha?: string;
    commitMessage?: string;
    imageTag?: string;
    deployedAt?: string;
    status?: string;
  };
  production: {
    commitSha?: string;
    commitMessage?: string;
    imageTag?: string;
    deployedAt?: string;
    status?: string;
  };
  commitsBehind: number;
  commitsAhead: CommitInfo[];
}

// In-memory storage for when database is not available
const memoryStore = {
  commits: new Map<string, CommitInfo>(),
  pipelines: new Map<string, PipelineInfo>(),
  deployments: new Map<string, DeploymentInfo>(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  environments: new Map<string, any>(),
};

export class CommitTracker {
  private giteaService: GiteaService;
  private k3sService: K3sService;

  constructor() {
    this.giteaService = new GiteaService();
    this.k3sService = new K3sService();
  }

  // ==========================================
  // Commit Operations
  // ==========================================

  async recordCommit(commit: CommitInfo): Promise<void> {
    const db = await getDbAsync();
    
    if (db) {
      const { eq } = await getDrizzleOps();
      const now = new Date().toISOString();
      try {
        await db.insert(commits).values({
          id: commit.sha,
          sha: commit.sha,
          shortSha: commit.shortSha || commit.sha.substring(0, 7),
          message: commit.message,
          author: commit.author,
          authorEmail: commit.authorEmail,
          authorAvatar: commit.authorAvatar,
          branch: commit.branch,
          repository: commit.repository,
          timestamp: commit.timestamp,
          url: commit.url,
          parentSha: commit.parentSha,
          createdAt: now,
        }).onConflictDoUpdate({
          target: commits.sha,
          set: {
            message: commit.message,
            branch: commit.branch,
          }
        });
        // Silence unused variable warning
        void eq;
      } catch (error) {
        console.error('Error recording commit to database:', error);
        // Fall back to memory
        memoryStore.commits.set(commit.sha, commit);
      }
    } else {
      memoryStore.commits.set(commit.sha, commit);
    }
  }

  async getCommit(sha: string): Promise<CommitInfo | null> {
    const db = await getDbAsync();
    
    if (db) {
      const { eq } = await getDrizzleOps();
      try {
        const result = await db.select().from(commits).where(eq(commits.sha, sha)).limit(1);
        if (result.length === 0) return null;
        
        const c = result[0];
        return {
          sha: c.sha,
          shortSha: c.shortSha,
          message: c.message,
          author: c.author,
          authorEmail: c.authorEmail || undefined,
          authorAvatar: c.authorAvatar || undefined,
          branch: c.branch,
          repository: c.repository,
          timestamp: c.timestamp,
          url: c.url || undefined,
          parentSha: c.parentSha || undefined,
        };
      } catch (error) {
        console.error('Error getting commit from database:', error);
      }
    }
    
    return memoryStore.commits.get(sha) || null;
  }

  async getRecentCommits(repository: string, limit: number = 20): Promise<CommitInfo[]> {
    const db = await getDbAsync();
    
    if (db) {
      const { eq, desc } = await getDrizzleOps();
      try {
        const result = await db.select()
          .from(commits)
          .where(eq(commits.repository, repository))
          .orderBy(desc(commits.timestamp))
          .limit(limit);
        
        return result.map((c: typeof result[0]) => ({
          sha: c.sha,
          shortSha: c.shortSha,
          message: c.message,
          author: c.author,
          authorEmail: c.authorEmail || undefined,
          authorAvatar: c.authorAvatar || undefined,
          branch: c.branch,
          repository: c.repository,
          timestamp: c.timestamp,
          url: c.url || undefined,
          parentSha: c.parentSha || undefined,
        }));
      } catch (error) {
        console.error('Error getting recent commits from database:', error);
      }
    }
    
    // Memory fallback
    return Array.from(memoryStore.commits.values())
      .filter(c => c.repository === repository)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // ==========================================
  // Pipeline Operations
  // ==========================================

  async recordPipelineRun(pipeline: Omit<PipelineInfo, 'stages'>): Promise<string> {
    const db = await getDbAsync();
    const now = new Date().toISOString();
    const id = pipeline.id || generateId();
    
    if (db) {
      try {
        await db.insert(pipelineRuns).values({
          id,
          commitSha: pipeline.commitSha,
          repository: pipeline.repository,
          workflowName: pipeline.workflowName,
          status: pipeline.status,
          conclusion: pipeline.conclusion,
          branch: pipeline.branch,
          event: pipeline.event,
          triggeredBy: pipeline.triggeredBy,
          startedAt: pipeline.startedAt,
          finishedAt: pipeline.finishedAt,
          duration: pipeline.duration,
          url: pipeline.url,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: pipelineRuns.id,
          set: {
            status: pipeline.status,
            conclusion: pipeline.conclusion,
            finishedAt: pipeline.finishedAt,
            duration: pipeline.duration,
            updatedAt: now,
          }
        });
      } catch (error) {
        console.error('Error recording pipeline to database:', error);
        memoryStore.pipelines.set(id, { ...pipeline, id, stages: [] });
      }
    } else {
      memoryStore.pipelines.set(id, { ...pipeline, id, stages: [] });
    }
    
    return id;
  }

  async updatePipelineStatus(
    id: string, 
    status: string, 
    conclusion?: string,
    finishedAt?: string
  ): Promise<void> {
    const db = await getDbAsync();
    const now = new Date().toISOString();

    if (db) {
      const { eq } = await getDrizzleOps();
      try {
        const startedAtResult = await db.select({ startedAt: pipelineRuns.startedAt })
          .from(pipelineRuns)
          .where(eq(pipelineRuns.id, id))
          .limit(1);
        
        let duration: number | undefined;
        if (finishedAt && startedAtResult.length > 0 && startedAtResult[0].startedAt) {
          duration = Math.floor(
            (new Date(finishedAt).getTime() - new Date(startedAtResult[0].startedAt).getTime()) / 1000
          );
        }

        await db.update(pipelineRuns)
          .set({
            status,
            conclusion,
            finishedAt,
            duration,
            updatedAt: now,
          })
          .where(eq(pipelineRuns.id, id));
      } catch (error) {
        console.error('Error updating pipeline status in database:', error);
      }
    }
    
    // Update memory store
    const pipeline = memoryStore.pipelines.get(id);
    if (pipeline) {
      pipeline.status = status as PipelineInfo['status'];
      pipeline.conclusion = conclusion;
      pipeline.finishedAt = finishedAt;
    }
  }

  async recordPipelineStage(pipelineRunId: string, stage: StageInfo): Promise<void> {
    const db = await getDbAsync();
    
    if (db) {
      try {
        await db.insert(pipelineStages).values({
          id: stage.id || generateId(),
          pipelineRunId,
          name: stage.name,
          status: stage.status,
          order: stage.order,
          startedAt: stage.startedAt,
          finishedAt: stage.finishedAt,
          duration: stage.duration,
        }).onConflictDoUpdate({
          target: pipelineStages.id,
          set: {
            status: stage.status,
            finishedAt: stage.finishedAt,
            duration: stage.duration,
          }
        });
      } catch (error) {
        console.error('Error recording pipeline stage to database:', error);
      }
    }
    
    // Update memory store
    const pipeline = memoryStore.pipelines.get(pipelineRunId);
    if (pipeline) {
      const existingIndex = pipeline.stages.findIndex(s => s.id === stage.id);
      if (existingIndex >= 0) {
        pipeline.stages[existingIndex] = stage;
      } else {
        pipeline.stages.push(stage);
      }
    }
  }

  async getPipelineRuns(commitSha: string): Promise<PipelineInfo[]> {
    const db = await getDbAsync();
    
    if (db) {
      const { eq, desc } = await getDrizzleOps();
      try {
        const runs = await db.select()
          .from(pipelineRuns)
          .where(eq(pipelineRuns.commitSha, commitSha))
          .orderBy(desc(pipelineRuns.createdAt));
        
        const result: PipelineInfo[] = [];
        
        for (const run of runs) {
          const stages = await db.select()
            .from(pipelineStages)
            .where(eq(pipelineStages.pipelineRunId, run.id))
            .orderBy(pipelineStages.order);
          
          result.push({
            id: run.id,
            commitSha: run.commitSha,
            repository: run.repository,
            workflowName: run.workflowName,
            status: run.status as PipelineInfo['status'],
            conclusion: run.conclusion || undefined,
            branch: run.branch,
            event: run.event,
            triggeredBy: run.triggeredBy || undefined,
            startedAt: run.startedAt || undefined,
            finishedAt: run.finishedAt || undefined,
            duration: run.duration || undefined,
            url: run.url || undefined,
            stages: stages.map((s: typeof stages[0]) => ({
              id: s.id,
              name: s.name,
              status: s.status as StageInfo['status'],
              order: s.order,
              startedAt: s.startedAt || undefined,
              finishedAt: s.finishedAt || undefined,
              duration: s.duration || undefined,
            })),
          });
        }
        
        return result;
      } catch (error) {
        console.error('Error getting pipeline runs from database:', error);
      }
    }
    
    // Memory fallback
    return Array.from(memoryStore.pipelines.values())
      .filter(p => p.commitSha === commitSha);
  }

  // ==========================================
  // Deployment Operations
  // ==========================================

  async recordDeployment(deployment: DeploymentInfo): Promise<string> {
    const db = await getDbAsync();
    const now = new Date().toISOString();
    const id = deployment.id || generateId();
    
    if (db) {
      try {
        await db.insert(deploymentEvents).values({
          id,
          commitSha: deployment.commitSha,
          repository: deployment.repository,
          environment: deployment.environment,
          namespace: deployment.namespace,
          deploymentName: deployment.deploymentName,
          status: deployment.status,
          imageTag: deployment.imageTag,
          imageDigest: deployment.imageDigest,
          replicas: deployment.replicas,
          readyReplicas: deployment.readyReplicas,
          previousImageTag: deployment.previousImageTag,
          deployedBy: deployment.deployedBy,
          deployedAt: deployment.deployedAt,
          healthCheckStatus: deployment.healthCheckStatus,
          url: deployment.url,
          createdAt: now,
          updatedAt: now,
        });

        // Update environment status
        await this.updateEnvironmentStatus(deployment);
      } catch (error) {
        console.error('Error recording deployment to database:', error);
        memoryStore.deployments.set(id, { ...deployment, id });
      }
    } else {
      memoryStore.deployments.set(id, { ...deployment, id });
    }
    
    return id;
  }

  async updateDeploymentStatus(
    id: string,
    status: string,
    healthCheckStatus?: string,
    readyReplicas?: number
  ): Promise<void> {
    const db = await getDbAsync();
    const now = new Date().toISOString();
    
    if (db) {
      const { eq } = await getDrizzleOps();
      try {
        await db.update(deploymentEvents)
          .set({
            status,
            healthCheckStatus,
            readyReplicas,
            updatedAt: now,
            deployedAt: status === 'deployed' ? now : undefined,
          })
          .where(eq(deploymentEvents.id, id));
      } catch (error) {
        console.error('Error updating deployment status in database:', error);
      }
    }
    
    // Update memory store
    const deployment = memoryStore.deployments.get(id);
    if (deployment) {
      deployment.status = status as DeploymentInfo['status'];
      deployment.healthCheckStatus = healthCheckStatus as DeploymentInfo['healthCheckStatus'];
      deployment.readyReplicas = readyReplicas;
    }
  }

  async getDeployments(commitSha: string): Promise<DeploymentInfo[]> {
    const db = await getDbAsync();
    
    if (db) {
      const { eq, desc } = await getDrizzleOps();
      try {
        const result = await db.select()
          .from(deploymentEvents)
          .where(eq(deploymentEvents.commitSha, commitSha))
          .orderBy(desc(deploymentEvents.createdAt));
        
        return result.map((d: typeof result[0]) => ({
          id: d.id,
          commitSha: d.commitSha,
          repository: d.repository,
          environment: d.environment as 'staging' | 'production',
          namespace: d.namespace,
          deploymentName: d.deploymentName,
          status: d.status as DeploymentInfo['status'],
          imageTag: d.imageTag,
          imageDigest: d.imageDigest || undefined,
          replicas: d.replicas || undefined,
          readyReplicas: d.readyReplicas || undefined,
          previousImageTag: d.previousImageTag || undefined,
          deployedBy: d.deployedBy || undefined,
          deployedAt: d.deployedAt || undefined,
          healthCheckStatus: d.healthCheckStatus as DeploymentInfo['healthCheckStatus'],
          url: d.url || undefined,
        }));
      } catch (error) {
        console.error('Error getting deployments from database:', error);
      }
    }
    
    // Memory fallback
    return Array.from(memoryStore.deployments.values())
      .filter(d => d.commitSha === commitSha);
  }

  // ==========================================
  // Environment Status
  // ==========================================

  async updateEnvironmentStatus(deployment: DeploymentInfo): Promise<void> {
    const db = await getDbAsync();
    const now = new Date().toISOString();
    const id = `${deployment.repository}:${deployment.environment}`;
    
    if (db) {
      try {
        await db.insert(environmentStatus).values({
          id,
          repository: deployment.repository,
          environment: deployment.environment,
          namespace: deployment.namespace,
          deploymentName: deployment.deploymentName,
          currentCommitSha: deployment.commitSha,
          currentImageTag: deployment.imageTag,
          status: deployment.healthCheckStatus || 'unknown',
          replicas: deployment.replicas,
          readyReplicas: deployment.readyReplicas,
          lastDeployedAt: deployment.deployedAt,
          lastDeployedBy: deployment.deployedBy,
          url: deployment.url,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: environmentStatus.id,
          set: {
            currentCommitSha: deployment.commitSha,
            currentImageTag: deployment.imageTag,
            status: deployment.healthCheckStatus || 'unknown',
            replicas: deployment.replicas,
            readyReplicas: deployment.readyReplicas,
            lastDeployedAt: deployment.deployedAt,
            lastDeployedBy: deployment.deployedBy,
            url: deployment.url,
            updatedAt: now,
          }
        });
      } catch (error) {
        console.error('Error updating environment status in database:', error);
      }
    }
    
    memoryStore.environments.set(id, {
      ...deployment,
      updatedAt: now,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getEnvironmentStatus(repository: string, environment: string): Promise<any> {
    const db = await getDbAsync();
    const id = `${repository}:${environment}`;
    
    if (db) {
      const { eq, and } = await getDrizzleOps();
      try {
        const result = await db.select()
          .from(environmentStatus)
          .where(and(
            eq(environmentStatus.repository, repository),
            eq(environmentStatus.environment, environment)
          ))
          .limit(1);
        
        return result[0] || null;
      } catch (error) {
        console.error('Error getting environment status from database:', error);
      }
    }
    
    return memoryStore.environments.get(id) || null;
  }

  // ==========================================
  // Commit Journey Tracking
  // ==========================================

  async getCommitJourney(sha: string): Promise<CommitJourney | null> {
    const commit = await this.getCommit(sha);
    if (!commit) return null;

    const pipelines = await this.getPipelineRuns(sha);
    const allDeployments = await this.getDeployments(sha);
    
    const stagingDeployment = allDeployments.find(d => d.environment === 'staging');
    const productionDeployment = allDeployments.find(d => d.environment === 'production');

    // Determine overall status
    let status: CommitJourney['status'] = 'pending';
    let percentComplete = 0;

    if (productionDeployment?.status === 'deployed') {
      status = 'production';
      percentComplete = 100;
    } else if (stagingDeployment?.status === 'deployed') {
      status = 'staging';
      percentComplete = 75;
    } else if (pipelines.some(p => p.status === 'success')) {
      status = 'testing';
      percentComplete = 50;
    } else if (pipelines.some(p => p.status === 'running')) {
      status = 'building';
      percentComplete = 25;
    } else if (pipelines.some(p => p.status === 'failure') || 
               allDeployments.some(d => d.status === 'failed')) {
      status = 'failed';
      percentComplete = pipelines.some(p => p.status === 'success') ? 50 : 25;
    }

    return {
      commit,
      pipelines,
      deployments: {
        staging: stagingDeployment,
        production: productionDeployment,
      },
      status,
      percentComplete,
    };
  }

  async getRecentCommitJourneys(repository: string, limit: number = 10): Promise<CommitJourney[]> {
    const recentCommits = await this.getRecentCommits(repository, limit);
    const journeys: CommitJourney[] = [];

    for (const commit of recentCommits) {
      const journey = await this.getCommitJourney(commit.sha);
      if (journey) {
        journeys.push(journey);
      }
    }

    return journeys;
  }

  // ==========================================
  // Environment Comparison
  // ==========================================

  async compareEnvironments(repository: string): Promise<EnvironmentComparison> {
    const stagingStatus = await this.getEnvironmentStatus(repository, 'staging');
    const prodStatus = await this.getEnvironmentStatus(repository, 'production');

    let stagingCommit: CommitInfo | null = null;
    let prodCommit: CommitInfo | null = null;
    let commitsAhead: CommitInfo[] = [];

    if (stagingStatus?.currentCommitSha) {
      stagingCommit = await this.getCommit(stagingStatus.currentCommitSha);
    }
    if (prodStatus?.currentCommitSha) {
      prodCommit = await this.getCommit(prodStatus.currentCommitSha);
    }

    // Calculate commits ahead (staging commits not in production)
    if (stagingStatus?.currentCommitSha && prodStatus?.currentCommitSha) {
      const allCommits = await this.getRecentCommits(repository, 50);
      const prodIndex = allCommits.findIndex(c => c.sha === prodStatus.currentCommitSha);
      const stagingIndex = allCommits.findIndex(c => c.sha === stagingStatus.currentCommitSha);
      
      if (prodIndex >= 0 && stagingIndex >= 0 && stagingIndex < prodIndex) {
        commitsAhead = allCommits.slice(stagingIndex, prodIndex);
      }
    }

    return {
      repository,
      staging: {
        commitSha: stagingStatus?.currentCommitSha,
        commitMessage: stagingCommit?.message,
        imageTag: stagingStatus?.currentImageTag,
        deployedAt: stagingStatus?.lastDeployedAt,
        status: stagingStatus?.status,
      },
      production: {
        commitSha: prodStatus?.currentCommitSha,
        commitMessage: prodCommit?.message,
        imageTag: prodStatus?.currentImageTag,
        deployedAt: prodStatus?.lastDeployedAt,
        status: prodStatus?.status,
      },
      commitsBehind: commitsAhead.length,
      commitsAhead,
    };
  }

  // ==========================================
  // Webhook Event Storage
  // ==========================================

  async storeWebhookEvent(
    source: string,
    eventType: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any,
    repository?: string,
    signature?: string
  ): Promise<string> {
    const db = await getDbAsync();
    const id = generateId();
    const now = new Date().toISOString();

    if (db) {
      try {
        await db.insert(webhookEvents).values({
          id,
          source,
          eventType,
          repository,
          payload: JSON.stringify(payload),
          signature,
          processed: 0,
          createdAt: now,
        });
      } catch (error) {
        console.error('Error storing webhook event in database:', error);
      }
    }

    return id;
  }

  async markWebhookProcessed(id: string, error?: string): Promise<void> {
    const db = await getDbAsync();
    const now = new Date().toISOString();
    
    if (db) {
      const { eq } = await getDrizzleOps();
      try {
        await db.update(webhookEvents)
          .set({
            processed: error ? 0 : 1,
            processedAt: now,
            error,
          })
          .where(eq(webhookEvents.id, id));
      } catch (err) {
        console.error('Error marking webhook processed in database:', err);
      }
    }
  }

  // ==========================================
  // Sync with Real Data
  // ==========================================

  async syncFromGitea(repository: string): Promise<void> {
    const [owner, repo] = repository.split('/');
    
    try {
      // Sync recent commits
      const giteaCommits = await this.giteaService.getCommits(owner, repo, { limit: 20 });
      
      for (const c of giteaCommits) {
        await this.recordCommit({
          sha: c.sha,
          shortSha: c.sha.substring(0, 7),
          message: c.commit?.message || '',
          author: c.commit?.author?.name || c.author?.login || 'Unknown',
          authorEmail: c.commit?.author?.email,
          authorAvatar: c.author?.avatar_url,
          branch: 'main', // Default, would need branch info from API
          repository,
          timestamp: c.commit?.author?.date || c.created || new Date().toISOString(),
          url: c.html_url,
          parentSha: c.parents?.[0]?.sha,
        });
      }

      // Sync workflow runs
      const workflowRuns = await this.giteaService.getWorkflowRuns({ owner, repo, limit: 10 });
      
      for (const run of workflowRuns) {
        const workflowUrl = `${process.env.GITEA_URL || 'https://git.gmac.io'}/${repository}/actions/runs/${run.id}`;
        
        await this.recordPipelineRun({
          id: `gitea-${run.id}`,
          commitSha: run.head_sha,
          repository,
          workflowName: run.name || 'CI/CD',
          status: this.mapGiteaStatus(run.status, run.conclusion),
          conclusion: run.conclusion,
          branch: run.head_branch || 'main',
          event: run.event || 'push',
          triggeredBy: run.actor?.login,
          startedAt: run.created_at,
          finishedAt: run.updated_at,
          url: workflowUrl,
        });
      }
    } catch (error) {
      console.error('Error syncing from Gitea:', error);
    }
  }

  async syncFromK8s(repository: string, namespace: string): Promise<void> {
    try {
      const deployments = await this.k3sService.getDeployments();
      const nsDeployments = deployments.filter(d => d.namespace === namespace);

      for (const dep of nsDeployments) {
        // Extract commit sha from image tag if available (e.g., image:sha-abc1234)
        const imageTag = dep.image.split(':')[1] || 'latest';
        let commitSha = '';
        
        if (imageTag.startsWith('sha-')) {
          commitSha = imageTag.replace('sha-', '');
        }

        const environment = namespace.includes('staging') ? 'staging' : 'production';

        await this.recordDeployment({
          id: `k8s-${namespace}-${dep.name}`,
          commitSha,
          repository,
          environment: environment as 'staging' | 'production',
          namespace,
          deploymentName: dep.name,
          status: dep.readyReplicas === dep.replicas ? 'deployed' : 'deploying',
          imageTag,
          replicas: dep.replicas,
          readyReplicas: dep.readyReplicas,
          healthCheckStatus: dep.readyReplicas === dep.replicas ? 'healthy' : 'unhealthy',
        });
      }
    } catch (error) {
      console.error('Error syncing from K8s:', error);
    }
  }

  private mapGiteaStatus(status: string, conclusion?: string): PipelineInfo['status'] {
    if (status === 'completed') {
      switch (conclusion) {
        case 'success': return 'success';
        case 'failure': return 'failure';
        case 'cancelled': return 'cancelled';
        default: return 'failure';
      }
    }
    if (status === 'in_progress' || status === 'running') return 'running';
    return 'pending';
  }
}

// Export singleton instance
export const commitTracker = new CommitTracker();

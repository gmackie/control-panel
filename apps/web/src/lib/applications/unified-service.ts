/**
 * Unified Application Service
 * 
 * Aggregates data from all sources to provide a complete view of each application:
 * - Gitea: Repository, commits, branches, PRs, workflows
 * - Harbor: Container images, vulnerability scans
 * - K8s: Deployments, pods, resources
 * - Integrations: Clerk, Stripe, Sentry, PostHog, Turso, Supabase
 * 
 * Persists data to PostgreSQL for caching and historical tracking.
 */

import { GiteaService } from '@/lib/gitea/gitea-service';
import { clerkService } from '@/lib/clerk/client';
import { stripeService } from '@/lib/stripe/client';
import { sentryService } from '@/lib/sentry/client';
import { postHogService } from '@/lib/posthog/client';
import { 
  UnifiedApplication, 
  CommitInfo,
  PullRequestInfo,
  PipelineRun,
  DeploymentInfo,
  ContainerImage,
  AuthMetrics,
  ErrorMetrics,
  AnalyticsMetrics,
  PaymentMetrics,
  TestResults,
  ActivityLogEntry,
} from '@/types/unified-app';
import {
  applicationsRepo,
  commitsRepo,
  deploymentsRepo,
} from '@/lib/db/repositories';
import { isPostgresConfigured } from '@/lib/db/postgres';

// Initialize services
const giteaService = new GiteaService();

// Cache TTL in milliseconds (5 minutes for most data)
const CACHE_TTL = 5 * 60 * 1000;

// Sync times type
interface SyncTimes {
  commits?: Date;
  pipelines?: Date;
  deployments?: Date;
  integrations?: Date;
}

// Track last sync times per application
const lastSyncTimes = new Map<string, SyncTimes>();

/**
 * Check if data needs refresh based on last sync time
 */
function needsRefresh(appId: string, dataType: keyof SyncTimes): boolean {
  const times = lastSyncTimes.get(appId);
  if (!times) return true;
  
  const lastSync = times[dataType];
  if (!lastSync) return true;
  
  const elapsed = Date.now() - lastSync.getTime();
  return elapsed > CACHE_TTL;
}

/**
 * Update sync time for an application's data type
 */
function updateSyncTime(appId: string, dataType: keyof SyncTimes): void {
  const times = lastSyncTimes.get(appId) || {};
  times[dataType] = new Date();
  lastSyncTimes.set(appId, times);
}

// K8s API helper
async function fetchK8sAPI(path: string): Promise<any> {
  const token = process.env.K3S_SA_TOKEN;
  const apiServer = process.env.K8S_API_SERVER || 'https://kubernetes.default.svc';
  
  const response = await fetch(`${apiServer}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`K8s API error: ${response.status}`);
  }
  
  return response.json();
}

// Harbor API helper
async function fetchHarborAPI(path: string): Promise<any> {
  const harborUrl = process.env.HARBOR_URL || 'https://registry.gmac.io';
  const username = process.env.HARBOR_USERNAME;
  const password = process.env.HARBOR_PASSWORD;
  
  const response = await fetch(`${harborUrl}/api/v2.0${path}`, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Harbor API error: ${response.status}`);
  }
  
  return response.json();
}

// Map workflow status to our status
function mapWorkflowStatus(status: string): 'pending' | 'running' | 'success' | 'failure' | 'cancelled' {
  switch (status) {
    case 'queued':
    case 'waiting':
      return 'pending';
    case 'in_progress':
      return 'running';
    case 'completed':
      return 'success'; // Check conclusion for actual result
    default:
      return 'pending';
  }
}

export class UnifiedApplicationService {
  
  // ==========================================
  // Database Sync Methods
  // ==========================================
  
  /**
   * Sync an application to PostgreSQL
   * Creates or updates the application record
   */
  private async syncApplicationToDb(app: UnifiedApplication): Promise<string | null> {
    if (!isPostgresConfigured()) return null;
    if (!app.repository) return null; // Can't sync without repository info
    
    try {
      // Check if application exists by repository full name
      let dbApp = await applicationsRepo.getByRepository(app.repository.fullName);
      
      if (dbApp) {
        // Update existing
        await applicationsRepo.update(dbApp.id, {
          name: app.name,
          description: app.description,
          status: app.status.overall,
          repositoryUrl: app.repository.url,
        });
        return dbApp.id;
      } else {
        // Create new
        dbApp = await applicationsRepo.create({
          name: app.name,
          slug: app.slug,
          description: app.description,
          repositoryUrl: app.repository.url,
          repositoryFullName: app.repository.fullName,
          defaultBranch: app.repository.defaultBranch,
          status: app.status.overall,
        });
        return dbApp.id;
      }
    } catch (error) {
      console.warn('Failed to sync application to PostgreSQL:', error);
      return null;
    }
  }
  
  /**
   * Sync commits to PostgreSQL
   */
  private async syncCommitsToDb(applicationId: string, commits: CommitInfo[]): Promise<void> {
    if (!isPostgresConfigured() || !applicationId) return;
    
    try {
      const commitData = commits.map(c => ({
        applicationId,
        sha: c.sha,
        shortSha: c.shortSha,
        message: c.message,
        authorName: c.author.name,
        authorEmail: c.author.email,
        authorAvatar: c.author.avatar,
        branch: 'main', // Would need to track this from the API
        repository: '', // Would come from the app
        committedAt: new Date(c.timestamp),
        url: c.url,
      }));
      
      await commitsRepo.createMany(commitData);
    } catch (error) {
      console.warn('Failed to sync commits to PostgreSQL:', error);
    }
  }
  
  /**
   * Sync pipeline runs to PostgreSQL
   */
  private async syncPipelineRunsToDb(applicationId: string, runs: PipelineRun[]): Promise<void> {
    if (!isPostgresConfigured() || !applicationId) return;
    
    try {
      for (const run of runs) {
        // Check if run already exists (by workflow ID if available)
        const existingRuns = await deploymentsRepo.getPipelineRuns(applicationId, { limit: 1 });
        const exists = existingRuns.some(r => r.workflowId === parseInt(run.id));
        
        if (!exists) {
          await deploymentsRepo.createPipelineRun({
            applicationId,
            workflowName: run.workflowName,
            workflowId: parseInt(run.id) || undefined,
            runNumber: run.runNumber,
            status: run.status,
            conclusion: run.conclusion,
            branch: run.branch,
            event: run.event,
            triggeredBy: run.triggeredBy,
            startedAt: run.startedAt ? new Date(run.startedAt) : undefined,
            finishedAt: run.finishedAt ? new Date(run.finishedAt) : undefined,
            duration: run.duration,
            url: run.url,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to sync pipeline runs to PostgreSQL:', error);
    }
  }
  
  /**
   * Sync deployments to PostgreSQL
   */
  private async syncDeploymentsToDb(applicationId: string, deployments: DeploymentInfo[]): Promise<void> {
    if (!isPostgresConfigured() || !applicationId) return;
    
    try {
      for (const dep of deployments) {
        // Upsert environment status
        await deploymentsRepo.upsertEnvironmentStatus({
          applicationId,
          environment: dep.environment,
          namespace: dep.namespace,
          deploymentName: dep.name,
          currentImageTag: dep.currentImage?.split(':')[1] || 'latest',
          currentVersion: dep.currentVersion,
          status: dep.status,
          replicas: dep.replicas,
          readyReplicas: dep.readyReplicas,
          url: dep.url,
        });
      }
    } catch (error) {
      console.warn('Failed to sync deployments to PostgreSQL:', error);
    }
  }
  
  /**
   * Get application from PostgreSQL cache if available
   */
  private async getApplicationFromDb(appId: string): Promise<{ dbId: string; app: any } | null> {
    if (!isPostgresConfigured()) return null;
    
    try {
      // Try by repository full name first
      let dbApp = await applicationsRepo.getByRepository(appId);
      
      // Try by slug if not found
      if (!dbApp) {
        const slug = appId.includes('/') ? appId.split('/')[1] : appId;
        dbApp = await applicationsRepo.getBySlug(slug.toLowerCase());
      }
      
      return dbApp ? { dbId: dbApp.id, app: dbApp } : null;
    } catch (error) {
      console.warn('Failed to get application from PostgreSQL:', error);
      return null;
    }
  }
  
  /**
   * Get commits from PostgreSQL cache
   */
  private async getCommitsFromDb(applicationId: string, limit: number): Promise<CommitInfo[] | null> {
    if (!isPostgresConfigured()) return null;
    
    try {
      const commits = await commitsRepo.getByApplication(applicationId, { limit });
      
      if (commits.length === 0) return null;
      
      return commits.map(c => ({
        sha: c.sha,
        shortSha: c.shortSha,
        message: c.message,
        author: {
          name: c.authorName,
          email: c.authorEmail || '',
          avatar: c.authorAvatar || undefined,
        },
        timestamp: c.committedAt.toISOString(),
        url: c.url || '',
      }));
    } catch (error) {
      console.warn('Failed to get commits from PostgreSQL:', error);
      return null;
    }
  }
  
  /**
   * Get pipeline runs from PostgreSQL cache
   */
  private async getPipelineRunsFromDb(applicationId: string, limit: number): Promise<PipelineRun[] | null> {
    if (!isPostgresConfigured()) return null;
    
    try {
      const runs = await deploymentsRepo.getPipelineRuns(applicationId, { limit });
      
      if (runs.length === 0) return null;
      
      return runs.map(r => ({
        id: r.id,
        commitSha: '', // Not stored in this table
        workflowName: r.workflowName,
        runNumber: r.runNumber || 0,
        status: r.status,
        conclusion: r.conclusion || undefined,
        branch: r.branch,
        event: r.event,
        triggeredBy: r.triggeredBy || undefined,
        startedAt: r.startedAt?.toISOString(),
        finishedAt: r.finishedAt?.toISOString(),
        duration: r.duration || undefined,
        url: r.url || '',
        stages: [],
      }));
    } catch (error) {
      console.warn('Failed to get pipeline runs from PostgreSQL:', error);
      return null;
    }
  }

  // ==========================================
  // Public API Methods
  // ==========================================
  
  /**
   * Get all applications by discovering from Gitea and matching with K8s deployments
   * Also syncs discovered applications to PostgreSQL
   */
  async getApplications(): Promise<UnifiedApplication[]> {
    try {
      // Get all repos from Gitea
      const repos = await giteaService.getRepositories();
      
      // Get all deployments from K8s
      const k8sDeployments = await this.getK8sDeployments();
      
      // Map repos to unified applications
      const applications: UnifiedApplication[] = await Promise.all(
        repos.map(async (repo) => {
          // Find matching K8s deployments
          const matchingDeployments = k8sDeployments.filter(
            (d: any) => d.metadata?.labels?.['app.kubernetes.io/name'] === repo.name ||
                 d.metadata?.labels?.['app'] === repo.name ||
                 d.metadata?.name === repo.name
          );
          
          // Parse owner from full_name
          const [owner, repoName] = repo.full_name.split('/');
          
          // Get latest commit
          const commits = await giteaService.getCommits(owner, repoName, { limit: 1 }).catch(() => []);
          
          // Get workflow status
          const workflows = await giteaService.getWorkflowRuns({ owner, repo: repoName, limit: 1 }).catch(() => []);
          
          const app = this.buildUnifiedApplication(repo, matchingDeployments, commits[0], workflows[0]);
          
          // Sync to PostgreSQL in background (non-blocking)
          this.syncApplicationToDb(app).catch(err => 
            console.warn(`Failed to sync app ${app.name} to DB:`, err)
          );
          
          return app;
        })
      );
      
      return applications;
    } catch (error) {
      console.error('Error fetching applications:', error);
      return [];
    }
  }
  
  /**
   * Get a single application with full details
   * Uses PostgreSQL cache when available, refreshes from APIs as needed
   */
  async getApplication(appId: string): Promise<UnifiedApplication | null> {
    try {
      // appId format: "owner/repo" or just "repo" (assumes default org)
      const [owner, repoName] = appId.includes('/') 
        ? appId.split('/') 
        : [process.env.GITEA_ORG || 'gmac', appId];
      
      // Get repository info
      const repo = await giteaService.getRepository(owner, repoName);
      if (!repo) return null;
      
      // Get all related data in parallel
      const [
        commits,
        branches,
        pullRequests,
        workflows,
        k8sDeployments,
        images,
      ] = await Promise.all([
        giteaService.getCommits(owner, repoName, { limit: 20 }).catch(() => []),
        giteaService.getBranches(owner, repoName).catch(() => []),
        giteaService.getPullRequests(owner, repoName, 'open').catch(() => []),
        giteaService.getWorkflowRuns({ owner, repo: repoName, limit: 10 }).catch(() => []),
        this.getK8sDeploymentsForApp(repoName),
        this.getContainerImages(repoName).catch(() => []),
      ]);
      
      const app = this.buildUnifiedApplicationFull(
        repo, 
        commits, 
        branches, 
        pullRequests,
        workflows, 
        k8sDeployments, 
        images
      );
      
      // Sync to PostgreSQL in background
      this.syncApplicationToDb(app).then(async (dbId) => {
        if (dbId) {
          // Build commit info for syncing
          const commitInfos: CommitInfo[] = commits.map((c: any) => ({
            sha: c.sha,
            shortSha: c.sha?.substring(0, 7) || '',
            message: c.commit?.message?.split('\n')[0] || '',
            author: {
              name: c.commit?.author?.name || '',
              email: c.commit?.author?.email || '',
              avatar: c.author?.avatar_url,
            },
            timestamp: c.commit?.author?.date || '',
            url: c.html_url || '',
          }));
          
          // Build pipeline info for syncing
          const pipelineRuns: PipelineRun[] = workflows.map((w: any) => ({
            id: w.id?.toString() || '',
            commitSha: w.head_sha || '',
            workflowName: w.name || 'Workflow',
            runNumber: w.run_number,
            status: w.status,
            conclusion: w.conclusion,
            branch: w.head_branch || '',
            event: w.event || '',
            triggeredBy: w.actor?.login,
            startedAt: w.created_at,
            finishedAt: w.updated_at,
            url: '',
            stages: [],
          }));
          
          // Sync all data
          await Promise.all([
            this.syncCommitsToDb(dbId, commitInfos),
            this.syncPipelineRunsToDb(dbId, pipelineRuns),
            this.syncDeploymentsToDb(dbId, k8sDeployments),
          ]);
          
          updateSyncTime(appId, 'commits');
          updateSyncTime(appId, 'pipelines');
          updateSyncTime(appId, 'deployments');
        }
      }).catch(err => console.warn('Background sync failed:', err));
      
      return app;
    } catch (error) {
      console.error('Error fetching application:', error);
      return null;
    }
  }
  
  /**
   * Get commits for an application
   * Uses database cache when fresh, otherwise fetches from Gitea
   */
  async getCommits(appId: string, limit = 50): Promise<CommitInfo[]> {
    const [owner, repoName] = appId.includes('/') 
      ? appId.split('/') 
      : [process.env.GITEA_ORG || 'gmac', appId];
    
    // Try to get from database cache if fresh
    const dbApp = await this.getApplicationFromDb(appId);
    if (dbApp && !needsRefresh(appId, 'commits')) {
      const cachedCommits = await this.getCommitsFromDb(dbApp.dbId, limit);
      if (cachedCommits && cachedCommits.length > 0) {
        console.log(`Returning ${cachedCommits.length} cached commits for ${appId}`);
        return cachedCommits;
      }
    }
    
    // Fetch from Gitea
    const commits = await giteaService.getCommits(owner, repoName, { limit });
    
    // Get workflow status for each commit
    const workflows = await giteaService.getWorkflowRuns({ owner, repo: repoName, limit: 50 }).catch(() => []);
    const workflowByCommit = new Map(workflows.map((w: any) => [w.head_sha, w]));
    
    const result = commits.map((commit: any) => {
      const workflow = workflowByCommit.get(commit.sha);
      return {
        sha: commit.sha,
        shortSha: commit.sha.substring(0, 7),
        message: commit.commit?.message?.split('\n')[0] || '',
        author: {
          name: commit.commit?.author?.name || '',
          email: commit.commit?.author?.email || '',
          avatar: commit.author?.avatar_url,
        },
        timestamp: commit.commit?.author?.date || '',
        url: commit.html_url || '',
        pipelineStatus: workflow ? {
          status: mapWorkflowStatus(workflow.status),
          conclusion: workflow.conclusion,
          workflowName: workflow.name || 'Workflow',
          runNumber: workflow.run_number,
          url: '',
          stages: [],
        } : undefined,
      };
    });
    
    // Sync to database in background
    if (dbApp) {
      this.syncCommitsToDb(dbApp.dbId, result).then(() => {
        updateSyncTime(appId, 'commits');
      }).catch(err => console.warn('Failed to sync commits:', err));
    }
    
    return result;
  }
  
  /**
   * Get pipeline runs for an application
   * Uses database cache when fresh, otherwise fetches from Gitea
   */
  async getPipelineRuns(appId: string, limit = 20): Promise<PipelineRun[]> {
    const [owner, repoName] = appId.includes('/') 
      ? appId.split('/') 
      : [process.env.GITEA_ORG || 'gmac', appId];
    
    // Try to get from database cache if fresh
    const dbApp = await this.getApplicationFromDb(appId);
    if (dbApp && !needsRefresh(appId, 'pipelines')) {
      const cachedRuns = await this.getPipelineRunsFromDb(dbApp.dbId, limit);
      if (cachedRuns && cachedRuns.length > 0) {
        console.log(`Returning ${cachedRuns.length} cached pipeline runs for ${appId}`);
        return cachedRuns;
      }
    }
    
    // Fetch from Gitea
    const workflows = await giteaService.getWorkflowRuns({ owner, repo: repoName, limit });
    
    const result = workflows.map((w: any) => ({
      id: w.id.toString(),
      commitSha: w.head_sha,
      workflowName: w.name || 'Workflow',
      runNumber: w.run_number,
      status: w.status,
      conclusion: w.conclusion,
      branch: w.head_branch,
      event: w.event,
      triggeredBy: w.actor?.login,
      startedAt: w.created_at,
      finishedAt: w.updated_at,
      duration: w.created_at && w.updated_at 
        ? Math.floor((new Date(w.updated_at).getTime() - new Date(w.created_at).getTime()) / 1000)
        : undefined,
      url: '',
      stages: [],
    }));
    
    // Sync to database in background
    if (dbApp) {
      this.syncPipelineRunsToDb(dbApp.dbId, result).then(() => {
        updateSyncTime(appId, 'pipelines');
      }).catch(err => console.warn('Failed to sync pipeline runs:', err));
    }
    
    return result;
  }
  
  /**
   * Get pull requests for an application
   */
  async getPullRequests(appId: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<PullRequestInfo[]> {
    const [owner, repoName] = appId.includes('/') 
      ? appId.split('/') 
      : [process.env.GITEA_ORG || 'gmac', appId];
    
    const prs = await giteaService.getPullRequests(owner, repoName, state);
    
    return prs.map((pr: any) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state as 'open' | 'closed' | 'merged',
      author: pr.user?.login || '',
      sourceBranch: pr.head?.ref || '',
      targetBranch: pr.base?.ref || '',
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url || '',
      reviewStatus: 'pending',
      reviewers: [],
      ciStatus: 'unknown',
      mergeable: pr.mergeable ?? true,
      conflicts: !(pr.mergeable ?? true),
    }));
  }
  
  /**
   * Get deployments for an application
   */
  async getDeployments(appId: string): Promise<DeploymentInfo[]> {
    const repoName = appId.includes('/') ? appId.split('/')[1] : appId;
    return this.getK8sDeploymentsForApp(repoName);
  }
  
  /**
   * Get container images for an application
   */
  async getContainerImages(appName: string): Promise<ContainerImage[]> {
    try {
      const artifacts = await fetchHarborAPI(`/projects/library/repositories/${appName}/artifacts?page_size=20`);
      
      return artifacts.map((artifact: any) => ({
        repository: `library/${appName}`,
        tag: artifact.tags?.[0]?.name || 'untagged',
        digest: artifact.digest,
        size: artifact.size,
        pushedAt: artifact.push_time,
        deployedTo: [],
        vulnerabilities: artifact.scan_overview ? {
          critical: artifact.scan_overview.critical || 0,
          high: artifact.scan_overview.high || 0,
          medium: artifact.scan_overview.medium || 0,
          low: artifact.scan_overview.low || 0,
        } : undefined,
      }));
    } catch {
      return [];
    }
  }
  
  /**
   * Get test results for an application
   */
  async getTestResults(appId: string): Promise<TestResults | null> {
    const [owner, repoName] = appId.includes('/') 
      ? appId.split('/') 
      : [process.env.GITEA_ORG || 'gmac', appId];
    
    const workflows = await giteaService.getWorkflowRuns({ owner, repo: repoName, limit: 5 }).catch(() => []);
    const testWorkflow = workflows.find((w: any) => 
      w.name?.toLowerCase().includes('test') || 
      w.name?.toLowerCase().includes('ci')
    );
    
    if (!testWorkflow) return null;
    
    return {
      lastRun: testWorkflow.updated_at,
      status: testWorkflow.conclusion === 'success' ? 'passing' : 'failing',
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      failedTests: [],
    };
  }
  
  /**
   * Get auth metrics (from Clerk)
   */
  async getAuthMetrics(): Promise<AuthMetrics | null> {
    try {
      const stats = await clerkService.getDashboardStats();
      
      return {
        totalUsers: stats.totalUsers,
        activeUsers24h: stats.activeUsersLast24h,
        activeUsers7d: stats.activeUsersLast7d,
        newUsers24h: stats.newUsersLast24h,
        newUsers7d: stats.newUsersLast7d,
        activeSessions: stats.activeSessions,
        mfaEnabled: stats.mfaUsers,
        mfaAdoptionRate: parseFloat(stats.mfaAdoptionRate as string) || 0,
        authMethods: {
          password: stats.passwordUsers,
          google: stats.providerBreakdown['google'] || 0,
          github: stats.providerBreakdown['github'] || 0,
          other: stats.socialUsers - (stats.providerBreakdown['google'] || 0) - (stats.providerBreakdown['github'] || 0),
        },
        organizations: stats.organizations,
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Get error metrics (from Sentry)
   */
  async getErrorMetrics(): Promise<ErrorMetrics | null> {
    try {
      const stats = await sentryService.getDashboardStats();
      
      return {
        totalIssues: stats.totalIssues,
        unresolvedIssues: stats.unresolvedIssues,
        newIssues24h: stats.newIssues24h,
        newIssues7d: stats.newIssues7d,
        critical: stats.fatalIssues,
        error: stats.errorIssues,
        warning: stats.warningIssues,
        errorRate: 0,
        errorsPerMinute: stats.errors24h / (24 * 60),
        affectedUsers: stats.totalAffectedUsers,
        topIssues: stats.topIssues.map((i: any) => ({
          id: i.id,
          shortId: i.shortId,
          title: i.title,
          culprit: '',
          level: i.level as any,
          status: 'unresolved' as const,
          count: parseInt(i.count),
          userCount: i.userCount,
          firstSeen: '',
          lastSeen: '',
          platform: '',
          project: i.project || '',
          url: '',
        })),
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Get analytics metrics (from PostHog)
   */
  async getAnalyticsMetrics(): Promise<AnalyticsMetrics | null> {
    try {
      const stats = await postHogService.getDashboardStats();
      
      return {
        uniqueUsers24h: stats.trackedPersons,
        uniqueUsers7d: stats.trackedPersons,
        uniqueUsers30d: stats.trackedPersons,
        totalEvents24h: stats.totalEvents30d / 30,
        totalEvents7d: stats.totalEvents30d / 4,
        topEvents: stats.topEvents,
        activeFeatureFlags: stats.activeFeatureFlags,
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Get payment metrics (from Stripe)
   */
  async getPaymentMetrics(): Promise<PaymentMetrics | null> {
    try {
      const stats = await stripeService.getDashboardStats();
      
      return {
        mrr: stats.mrr / 100,
        arr: stats.arr / 100,
        revenue30d: stats.revenue30d / 100,
        totalCustomers: stats.totalCustomers,
        activeSubscriptions: stats.activeSubscriptions,
        churnRate: parseFloat(stats.churnRate),
        successfulPayments24h: stats.successfulPayments30d / 30,
        failedPayments24h: stats.failedPayments30d / 30,
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Get activity log for an application
   */
  async getActivityLog(appId: string, limit = 50): Promise<ActivityLogEntry[]> {
    const [owner, repoName] = appId.includes('/') 
      ? appId.split('/') 
      : [process.env.GITEA_ORG || 'gmac', appId];
    
    const [commits, workflows, prs] = await Promise.all([
      giteaService.getCommits(owner, repoName, { limit }).catch(() => []),
      giteaService.getWorkflowRuns({ owner, repo: repoName, limit }).catch(() => []),
      giteaService.getPullRequests(owner, repoName, 'all').catch(() => []),
    ]);
    
    const activities: ActivityLogEntry[] = [];
    
    // Add commits
    commits.forEach((commit: any) => {
      activities.push({
        id: `commit-${commit.sha}`,
        timestamp: commit.commit?.author?.date || '',
        type: 'commit',
        actor: {
          id: commit.author?.login || 'unknown',
          name: commit.commit?.author?.name || '',
          avatar: commit.author?.avatar_url,
        },
        action: `Committed: ${commit.commit?.message?.split('\n')[0] || ''}`,
        details: { sha: commit.sha, branch: '' },
        commitSha: commit.sha,
      });
    });
    
    // Add workflow runs
    workflows.forEach((w: any) => {
      activities.push({
        id: `pipeline-${w.id}`,
        timestamp: w.created_at,
        type: w.status === 'completed' ? 'pipeline_completed' : 'pipeline_started',
        actor: {
          id: w.actor?.login || 'system',
          name: w.actor?.login || 'CI System',
          avatar: w.actor?.avatar_url,
        },
        action: `Pipeline ${w.name} ${w.status}${w.conclusion ? ` (${w.conclusion})` : ''}`,
        details: { workflowName: w.name, runNumber: w.run_number },
        commitSha: w.head_sha,
      });
    });
    
    // Add PRs
    prs.forEach((pr: any) => {
      activities.push({
        id: `pr-${pr.id}`,
        timestamp: pr.created_at,
        type: pr.merged_at ? 'pr_merged' : pr.state === 'closed' ? 'pr_closed' : 'pr_opened',
        actor: {
          id: pr.user?.login || '',
          name: pr.user?.login || '',
          avatar: pr.user?.avatar_url,
        },
        action: `${pr.merged_at ? 'Merged' : pr.state === 'closed' ? 'Closed' : 'Opened'} PR #${pr.number}: ${pr.title}`,
        details: { prNumber: pr.number, title: pr.title },
      });
    });
    
    return activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, limit);
  }
  
  /**
   * Trigger a deployment
   */
  async triggerDeployment(appId: string, environment: 'staging' | 'production', options?: {
    commitSha?: string;
    imageTag?: string;
  }): Promise<{ success: boolean; message: string; deploymentId?: string }> {
    const [owner, repoName] = appId.includes('/') 
      ? appId.split('/') 
      : [process.env.GITEA_ORG || 'gmac', appId];
    
    try {
      await giteaService.triggerWorkflow(owner, repoName, 'deploy.yaml', {
        environment,
        commit_sha: options?.commitSha,
        image_tag: options?.imageTag,
      });
      
      return {
        success: true,
        message: `Deployment to ${environment} triggered successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to trigger deployment: ${error}`,
      };
    }
  }
  
  /**
   * Force refresh all data for an application from external sources
   * Clears cache and fetches fresh data
   */
  async forceRefresh(appId: string): Promise<void> {
    // Clear sync times to force refresh
    lastSyncTimes.delete(appId);
    
    // Fetch fresh data (this will re-sync to DB)
    await this.getApplication(appId);
    
    console.log(`Force refreshed data for ${appId}`);
  }
  
  /**
   * Sync all applications to PostgreSQL
   * Useful for initial setup or recovery
   */
  async syncAllApplications(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;
    
    try {
      const apps = await this.getApplications();
      
      for (const app of apps) {
        try {
          const dbId = await this.syncApplicationToDb(app);
          if (dbId) {
            synced++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
    } catch (error) {
      console.error('Failed to sync all applications:', error);
    }
    
    return { synced, failed };
  }
  
  /**
   * Get application statistics from the database
   */
  async getApplicationStats(appId: string): Promise<{
    commitCount30d: number;
    pipelineSuccessRate: number;
    deploymentCount30d: number;
  } | null> {
    const dbApp = await this.getApplicationFromDb(appId);
    if (!dbApp) return null;
    
    try {
      const [commitCount, pipelineStats] = await Promise.all([
        commitsRepo.getCommitCount(dbApp.dbId, 30),
        deploymentsRepo.getPipelineSuccessRate(dbApp.dbId, 30),
      ]);
      
      // Get deployment count
      const deployments = await deploymentsRepo.getByApplication(dbApp.dbId, { limit: 100 });
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentDeployments = deployments.filter(d => 
        new Date(d.createdAt) > thirtyDaysAgo
      );
      
      return {
        commitCount30d: commitCount,
        pipelineSuccessRate: pipelineStats.rate,
        deploymentCount30d: recentDeployments.length,
      };
    } catch (error) {
      console.warn('Failed to get application stats:', error);
      return null;
    }
  }
  
  /**
   * Get database ID for an application
   * Useful for other services that need to reference the app
   */
  async getApplicationDbId(appId: string): Promise<string | null> {
    const dbApp = await this.getApplicationFromDb(appId);
    return dbApp?.dbId || null;
  }
  
  // ==========================================
  // Private Helper Methods
  // ==========================================
  
  private async getK8sDeployments(): Promise<any[]> {
    try {
      const response = await fetchK8sAPI('/apis/apps/v1/deployments');
      return response.items || [];
    } catch {
      return [];
    }
  }
  
  private async getK8sDeploymentsForApp(appName: string): Promise<DeploymentInfo[]> {
    try {
      const allDeployments = await this.getK8sDeployments();
      
      const appDeployments = allDeployments.filter((d: any) => 
        d.metadata?.labels?.['app.kubernetes.io/name'] === appName ||
        d.metadata?.labels?.['app'] === appName ||
        d.metadata?.name === appName ||
        d.metadata?.name?.includes(appName)
      );
      
      return Promise.all(appDeployments.map(async (d: any) => {
        const namespace = d.metadata?.namespace || 'default';
        const environment = namespace.includes('prod') ? 'production' 
          : namespace.includes('staging') ? 'staging'
          : 'development';
        
        const pods = await this.getPodsForDeployment(namespace, d.metadata?.name).catch(() => []);
        
        return {
          environment: environment as any,
          namespace,
          name: d.metadata?.name || '',
          status: this.getDeploymentStatus(d),
          replicas: d.spec?.replicas || 0,
          readyReplicas: d.status?.readyReplicas || 0,
          availableReplicas: d.status?.availableReplicas || 0,
          currentImage: d.spec?.template?.spec?.containers?.[0]?.image,
          currentVersion: d.metadata?.labels?.['app.kubernetes.io/version'],
          lastDeployedAt: d.metadata?.creationTimestamp,
          pods,
        };
      }));
    } catch {
      return [];
    }
  }
  
  private async getPodsForDeployment(namespace: string, deploymentName: string): Promise<any[]> {
    try {
      const response = await fetchK8sAPI(
        `/api/v1/namespaces/${namespace}/pods?labelSelector=app.kubernetes.io/name=${deploymentName}`
      );
      
      return (response.items || []).map((pod: any) => ({
        name: pod.metadata?.name,
        status: pod.status?.phase,
        ready: pod.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True',
        restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
        age: pod.metadata?.creationTimestamp,
        node: pod.spec?.nodeName,
        ip: pod.status?.podIP,
      }));
    } catch {
      return [];
    }
  }
  
  private getDeploymentStatus(deployment: any): DeploymentInfo['status'] {
    const status = deployment.status;
    
    if (!status) return 'not_deployed';
    
    if (status.readyReplicas === status.replicas && status.replicas > 0) {
      return 'healthy';
    }
    
    if (status.readyReplicas > 0) {
      return 'degraded';
    }
    
    return 'unhealthy';
  }
  
  private buildUnifiedApplication(
    repo: any,
    _deployments: any[],
    latestCommit: any,
    latestWorkflow: any
  ): UnifiedApplication {
    const [owner] = repo.full_name.split('/');
    
    return {
      id: repo.full_name,
      name: repo.name,
      slug: repo.name.toLowerCase(),
      description: repo.description,
      repository: {
        provider: 'gitea',
        owner,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
        isPrivate: repo.private,
        latestCommit: latestCommit ? {
          sha: latestCommit.sha,
          shortSha: latestCommit.sha?.substring(0, 7),
          message: latestCommit.commit?.message?.split('\n')[0] || '',
          author: {
            name: latestCommit.commit?.author?.name || '',
            email: latestCommit.commit?.author?.email || '',
          },
          timestamp: latestCommit.commit?.author?.date || '',
          url: latestCommit.html_url || '',
        } : undefined,
        branches: [],
        openPullRequests: 0,
        stars: repo.stars_count || 0,
        forks: repo.forks_count || 0,
        openIssues: repo.open_issues_count || 0,
      },
      deployments: [],
      images: [],
      integrations: [],
      status: {
        overall: 'unknown',
        repository: 'connected',
        ci: latestWorkflow?.conclusion === 'success' ? 'passing' 
          : latestWorkflow?.conclusion === 'failure' ? 'failing'
          : latestWorkflow?.status === 'in_progress' ? 'pending'
          : 'unknown',
        staging: 'not_deployed',
        production: 'not_deployed',
        lastActivity: repo.updated_at,
      },
      createdAt: repo.created_at || '',
      updatedAt: repo.updated_at,
      createdBy: owner,
      tags: [],
    };
  }
  
  private buildUnifiedApplicationFull(
    repo: any,
    commits: any[],
    branches: any[],
    pullRequests: any[],
    workflows: any[],
    deployments: DeploymentInfo[],
    images: ContainerImage[]
  ): UnifiedApplication {
    const latestWorkflow = workflows[0];
    const [owner] = repo.full_name?.split('/') || [repo.owner?.login];
    
    const stagingDeployment = deployments.find(d => d.environment === 'staging');
    const productionDeployment = deployments.find(d => d.environment === 'production');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' = 'healthy';
    if (productionDeployment?.status === 'unhealthy' || stagingDeployment?.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (productionDeployment?.status === 'degraded' || stagingDeployment?.status === 'degraded') {
      overallStatus = 'degraded';
    } else if (!productionDeployment && !stagingDeployment) {
      overallStatus = 'unknown';
    }
    
    return {
      id: repo.full_name,
      name: repo.name,
      slug: repo.name.toLowerCase(),
      description: repo.description,
      repository: {
        provider: 'gitea',
        owner,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
        isPrivate: repo.private,
        latestCommit: commits[0] ? {
          sha: commits[0].sha,
          shortSha: commits[0].sha?.substring(0, 7),
          message: commits[0].commit?.message?.split('\n')[0] || '',
          author: {
            name: commits[0].commit?.author?.name || '',
            email: commits[0].commit?.author?.email || '',
            avatar: commits[0].author?.avatar_url,
          },
          timestamp: commits[0].commit?.author?.date || '',
          url: commits[0].html_url || '',
        } : undefined,
        branches: branches.map((b: any) => ({
          name: b.name,
          isDefault: b.name === repo.default_branch,
          isProtected: b.protected,
          lastCommit: {
            sha: b.commit?.id || '',
            message: b.commit?.message?.split('\n')[0] || '',
            timestamp: b.commit?.timestamp || '',
          },
        })),
        openPullRequests: pullRequests.filter((pr: any) => pr.state === 'open').length,
        stars: repo.stars_count || 0,
        forks: repo.forks_count || 0,
        openIssues: repo.open_issues_count || 0,
      },
      deployments,
      images,
      integrations: [],
      status: {
        overall: overallStatus,
        repository: 'connected',
        ci: latestWorkflow?.conclusion === 'success' ? 'passing' 
          : latestWorkflow?.conclusion === 'failure' ? 'failing'
          : latestWorkflow?.status === 'in_progress' ? 'pending'
          : 'unknown',
        staging: stagingDeployment?.status || 'not_deployed',
        production: productionDeployment?.status || 'not_deployed',
        lastActivity: repo.updated_at,
      },
      createdAt: repo.created_at || '',
      updatedAt: repo.updated_at,
      createdBy: owner,
      tags: [],
    };
  }
}

// Export singleton instance
export const unifiedAppService = new UnifiedApplicationService();

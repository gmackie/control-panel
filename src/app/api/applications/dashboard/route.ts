import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getApplications } from '@/lib/applications/manager';
import { GiteaClient } from '@/lib/gitea/client';
import { HarborClient } from '@/lib/harbor/client';
import { ClerkMonitor } from '@/lib/monitoring/clerk-monitor';
import { StripeMonitor } from '@/lib/monitoring/stripe-monitor';
import { TursoMonitor } from '@/lib/monitoring/turso-monitor';
import { K3sServiceMonitor } from '@/lib/monitoring/k3s-service-monitor';

interface DashboardApplication {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: "healthy" | "degraded" | "critical" | "unknown";
  
  repository?: {
    provider: "gitea" | "github" | "gitlab";
    url: string;
    defaultBranch: string;
    lastCommit?: {
      sha: string;
      message: string;
      author: string;
      date: string;
    };
  };
  
  cicd?: {
    provider: "gitea-actions" | "github-actions" | "gitlab-ci";
    status: "success" | "failed" | "running" | "pending";
    workflowRuns: Array<{
      id: string;
      name: string;
      status: "success" | "failed" | "running" | "pending";
      branch: string;
      commit: string;
      startedAt: string;
      completedAt?: string;
    }>;
  };
  
  registry?: {
    provider: "harbor" | "dockerhub" | "gcr";
    images: Array<{
      name: string;
      tag: string;
      size: number;
      pushed: string;
      vulnerabilities?: {
        critical: number;
        high: number;
        medium: number;
        low: number;
      };
    }>;
  };
  
  environments: {
    staging?: {
      status: "healthy" | "unhealthy" | "deploying";
      url?: string;
      version: string;
      lastDeployed: string;
      healthChecks: {
        api: boolean;
        database: boolean;
        cache: boolean;
      };
    };
    production?: {
      status: "healthy" | "unhealthy" | "deploying";
      url?: string;
      version: string;
      lastDeployed: string;
      metrics: {
        requestsPerSecond: number;
        errorRate: number;
        responseTime: number;
        uptime: number;
      };
      alerts: Array<{
        id: string;
        severity: "critical" | "warning" | "info";
        message: string;
        triggeredAt: string;
      }>;
    };
  };
  
  integrations: {
    stripe?: {
      connected: boolean;
      monthlyRevenue?: number;
      activeSubscriptions?: number;
      churnRate?: number;
      lastSync: string;
    };
    clerk?: {
      connected: boolean;
      totalUsers?: number;
      activeUsers?: number;
      mfaAdoption?: number;
      lastSync: string;
    };
    turso?: {
      connected: boolean;
      databases?: number;
      storageUsed?: number;
      requestsToday?: number;
      lastSync: string;
    };
    supabase?: {
      connected: boolean;
      databases?: number;
      realtimeConnections?: number;
      storageUsed?: number;
      lastSync: string;
    };
    elevenlabs?: {
      connected: boolean;
      charactersUsed?: number;
      charactersLimit?: number;
      voicesCreated?: number;
      lastSync: string;
    };
    openrouter?: {
      connected: boolean;
      tokensUsed?: number;
      costToday?: number;
      modelsUsed?: string[];
      lastSync: string;
    };
    sendgrid?: {
      connected: boolean;
      emailsSent?: number;
      bounceRate?: number;
      openRate?: number;
      lastSync: string;
    };
    twilio?: {
      connected: boolean;
      messagesSent?: number;
      callsToday?: number;
      costToday?: number;
      lastSync: string;
    };
    aws?: {
      connected: boolean;
      services?: string[];
      monthlyCost?: number;
      lastSync: string;
    };
  };
  
  cost: {
    total: number;
    breakdown: {
      infrastructure: number;
      integrations: number;
      storage: number;
      bandwidth: number;
    };
    trend: "up" | "down" | "stable";
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).login || session.user.email!;
    
    // Fetch base applications
    const applications = await getApplications(userId);
    
    // Initialize service clients
    const giteaClient = new GiteaClient({
      baseUrl: process.env.GITEA_BASE_URL || 'https://gitea.gmac.io',
      token: process.env.GITEA_API_TOKEN
    });
    const harborClient = new HarborClient({
      baseUrl: process.env.HARBOR_BASE_URL || 'https://harbor.gmac.io',
      username: process.env.HARBOR_USERNAME || 'admin',
      password: process.env.HARBOR_PASSWORD!
    });
    const clerkMonitor = new ClerkMonitor();
    const stripeMonitor = new StripeMonitor();
    const tursoMonitor = new TursoMonitor();
    const k3sMonitor = new K3sServiceMonitor();
    
    // Transform applications to dashboard format with real data
    const dashboardApps: DashboardApplication[] = await Promise.all(
      applications.map(async (app) => {
        const dashboardApp: DashboardApplication = {
          id: app.id,
          name: app.name,
          slug: app.slug,
          description: app.description,
          status: "unknown",
          environments: {},
          integrations: {},
          cost: {
            total: 0,
            breakdown: {
              infrastructure: 0,
              integrations: 0,
              storage: 0,
              bandwidth: 0,
            },
            trend: "stable",
          },
        };
        
        // Fetch repository info from Gitea
        try {
          const repoName = app.slug;
          const repo = await giteaClient.getRepository('gmackie', repoName);
          
          if (repo) {
            dashboardApp.repository = {
              provider: "gitea",
              url: repo.html_url,
              defaultBranch: repo.default_branch || "main",
            };
            
            // Get latest commit
            const commits = await giteaClient.getCommits('gmackie', repoName);
            if (commits && commits.length > 0) {
              const latestCommit = commits[0];
              dashboardApp.repository.lastCommit = {
                sha: latestCommit.sha.substring(0, 7),
                message: latestCommit.commit.message,
                author: latestCommit.commit.author.name,
                date: latestCommit.commit.author.date,
              };
            }
            
            // Get CI/CD status from Gitea Actions
            try {
              const workflows = await giteaClient.getWorkflowRuns('gmackie', repoName);
              if (workflows && workflows.length > 0) {
                dashboardApp.cicd = {
                  provider: "gitea-actions",
                  status: workflows[0].status === "completed" 
                    ? (workflows[0].conclusion === "success" ? "success" : "failed")
                    : workflows[0].status === "in_progress" ? "running" : "pending",
                  workflowRuns: workflows.slice(0, 5).map(run => ({
                    id: run.id.toString(),
                    name: run.workflow_name || "CI/CD Pipeline",
                    status: run.status === "completed"
                      ? (run.conclusion === "success" ? "success" : "failed")
                      : run.status === "in_progress" ? "running" : "pending",
                    branch: run.head_branch,
                    commit: run.head_sha.substring(0, 7),
                    startedAt: run.created_at,
                    completedAt: run.updated_at,
                  })),
                };
              }
            } catch (error) {
              console.error(`Failed to fetch CI/CD status for ${app.name}:`, error);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch repository info for ${app.name}:`, error);
        }
        
        // Fetch container registry info from Harbor
        try {
          const projectName = app.slug.toLowerCase();
          const repositories = await harborClient.listRepositories(projectName);
          
          if (repositories && repositories.length > 0) {
            const images = [];
            for (const repo of repositories.slice(0, 3)) {
              const artifacts = await harborClient.listArtifacts(projectName, repo.name);
              for (const artifact of artifacts.slice(0, 2)) {
                images.push({
                  name: repo.name,
                  tag: artifact.tags?.[0]?.name || "latest",
                  size: artifact.size || 0,
                  pushed: artifact.push_time,
                  vulnerabilities: artifact.scan_overview?.application?.summary
                    ? {
                        critical: artifact.scan_overview.application.summary.summary?.Critical || 0,
                        high: artifact.scan_overview.application.summary.summary?.High || 0,
                        medium: artifact.scan_overview.application.summary.summary?.Medium || 0,
                        low: artifact.scan_overview.application.summary.summary?.Low || 0,
                      }
                    : undefined,
                });
              }
            }
            
            dashboardApp.registry = {
              provider: "harbor",
              images,
            };
          }
        } catch (error) {
          console.error(`Failed to fetch registry info for ${app.name}:`, error);
        }
        
        // Fetch K3s deployment status for environments
        try {
          const k3sServices = await k3sMonitor.getServiceStatus();
          
          // Check for staging deployment (look for service matching app name)
          const stagingService = k3sServices.find(
            s => s.name === app.slug && s.environment === 'staging'
          );
          
          if (stagingService) {
            dashboardApp.environments.staging = {
              status: stagingService.status === "healthy" ? "healthy" : "unhealthy",
              url: `https://staging-${app.slug}.gmac.io`,
              version: stagingService.version || "latest",
              lastDeployed: new Date().toISOString(), // Would need to fetch from K8s annotations
              healthChecks: {
                api: stagingService.status === "healthy",
                database: true, // Would need actual health check
                cache: true, // Would need actual health check
              },
            };
          }
          
          // Check for production deployment
          const prodService = k3sServices.find(
            s => s.name === app.slug && s.environment === 'production'
          );
          
          if (prodService) {
            dashboardApp.environments.production = {
              status: prodService.status === "healthy" ? "healthy" : "unhealthy",
              url: `https://${app.slug}.gmac.io`,
              version: prodService.version || "latest",
              lastDeployed: new Date().toISOString(), // Would need to fetch from K8s annotations
              metrics: {
                requestsPerSecond: 0, // Would need Prometheus metrics
                errorRate: 0, // Would need Prometheus metrics
                responseTime: 0, // Would need Prometheus metrics
                uptime: 99.9, // Would need actual uptime calculation
              },
              alerts: [], // Would need to fetch from AlertManager
            };
          }
        } catch (error) {
          console.error(`Failed to fetch K3s deployment status for ${app.name}:`, error);
        }
        
        // Check integration statuses
        const integrationPromises = [];
        
        // Check Stripe integration
        if (app.secrets.some(s => s.key === 'STRIPE_SECRET_KEY')) {
          integrationPromises.push(
            stripeMonitor.getMetrics().then(metrics => {
              dashboardApp.integrations.stripe = {
                connected: metrics.connected,
                monthlyRevenue: metrics.revenue?.monthly || 0,
                activeSubscriptions: metrics.subscriptions?.active || 0,
                churnRate: metrics.subscriptions?.churnRate || 0,
                lastSync: new Date().toISOString(),
              };
            }).catch(error => {
              console.error(`Failed to fetch Stripe metrics for ${app.name}:`, error);
              dashboardApp.integrations.stripe = {
                connected: false,
                lastSync: new Date().toISOString(),
              };
            })
          );
        }
        
        // Check Clerk integration
        if (app.secrets.some(s => s.key === 'CLERK_SECRET_KEY')) {
          integrationPromises.push(
            clerkMonitor.getMetrics().then(metrics => {
              dashboardApp.integrations.clerk = {
                connected: metrics.connected,
                totalUsers: metrics.users?.total || 0,
                activeUsers: metrics.users?.active || 0,
                mfaAdoption: metrics.authentication?.mfaAdoption || 0,
                lastSync: new Date().toISOString(),
              };
            }).catch(error => {
              console.error(`Failed to fetch Clerk metrics for ${app.name}:`, error);
              dashboardApp.integrations.clerk = {
                connected: false,
                lastSync: new Date().toISOString(),
              };
            })
          );
        }
        
        // Check Turso integration
        if (app.secrets.some(s => s.key === 'TURSO_DATABASE_URL')) {
          integrationPromises.push(
            tursoMonitor.getDatabases().then(databases => {
              const totalRequests = databases.reduce((sum, db) => 
                sum + (db.operations?.reads || 0) + (db.operations?.writes || 0), 0
              );
              const totalStorage = databases.reduce((sum, db) => 
                sum + (db.size || 0), 0
              );
              
              dashboardApp.integrations.turso = {
                connected: true,
                databases: databases.length,
                storageUsed: totalStorage / (1024 * 1024 * 1024), // Convert to GB
                requestsToday: totalRequests,
                lastSync: new Date().toISOString(),
              };
            }).catch(error => {
              console.error(`Failed to fetch Turso metrics for ${app.name}:`, error);
              dashboardApp.integrations.turso = {
                connected: false,
                lastSync: new Date().toISOString(),
              };
            })
          );
        }
        
        // Check other integrations based on secrets
        const integrationMap = {
          'SUPABASE_URL': 'supabase',
          'ELEVENLABS_API_KEY': 'elevenlabs',
          'OPENROUTER_API_KEY': 'openrouter',
          'SENDGRID_API_KEY': 'sendgrid',
          'TWILIO_ACCOUNT_SID': 'twilio',
          'AWS_ACCESS_KEY_ID': 'aws',
        };
        
        for (const [secretKey, integration] of Object.entries(integrationMap)) {
          if (app.secrets.some(s => s.key === secretKey)) {
            (dashboardApp.integrations as any)[integration] = {
              connected: true,
              lastSync: new Date().toISOString(),
            };
          }
        }
        
        await Promise.all(integrationPromises);
        
        // Calculate status based on environments and integrations
        const hasProductionIssues = dashboardApp.environments.production?.status === "unhealthy" ||
          (dashboardApp.environments.production?.alerts?.length || 0) > 0;
        const hasStagingIssues = dashboardApp.environments.staging?.status === "unhealthy";
        const hasIntegrationIssues = Object.values(dashboardApp.integrations).some(
          i => i.connected === false
        );
        
        if (hasProductionIssues) {
          dashboardApp.status = "critical";
        } else if (hasStagingIssues || hasIntegrationIssues) {
          dashboardApp.status = "degraded";
        } else if (dashboardApp.environments.production || dashboardApp.environments.staging) {
          dashboardApp.status = "healthy";
        } else {
          dashboardApp.status = "unknown";
        }
        
        // Calculate costs (simplified - would need actual cost data)
        const baseInfraCost = dashboardApp.environments.production ? 50 : 0;
        const stagingCost = dashboardApp.environments.staging ? 25 : 0;
        const integrationCost = Object.keys(dashboardApp.integrations).length * 10;
        
        dashboardApp.cost = {
          total: baseInfraCost + stagingCost + integrationCost,
          breakdown: {
            infrastructure: baseInfraCost + stagingCost,
            integrations: integrationCost,
            storage: 5,
            bandwidth: 10,
          },
          trend: "stable", // Would need historical data to calculate trend
        };
        
        return dashboardApp;
      })
    );
    
    return NextResponse.json(dashboardApps);
  } catch (error) {
    console.error('Error fetching application dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch application dashboard' },
      { status: 500 }
    );
  }
}
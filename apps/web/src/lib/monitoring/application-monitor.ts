/**
 * Application Monitoring System
 * Comprehensive monitoring for Git repos, Helm charts, pods, and observability integrations
 */

import { z } from 'zod';

// Application monitoring schema
export const ApplicationMonitoringSchema = z.object({
  id: z.string(),
  name: z.string(),
  namespace: z.string(),
  
  // Git Repository
  git: z.object({
    url: z.string().url(),
    branch: z.string().default('main'),
    provider: z.enum(['gitea', 'github', 'gitlab']),
    lastCommit: z.object({
      sha: z.string(),
      message: z.string(),
      author: z.string(),
      timestamp: z.date(),
    }).optional(),
    webhookUrl: z.string().url().optional(),
  }),
  
  // Helm Chart
  helm: z.object({
    chartName: z.string(),
    chartVersion: z.string(),
    repository: z.string().url(),
    valuesFile: z.string().optional(),
    releaseName: z.string(),
    deployedVersion: z.string().optional(),
    lastDeployed: z.date().optional(),
    status: z.enum(['deployed', 'pending', 'failed', 'superseded', 'unknown']).default('unknown'),
  }),
  
  // Kubernetes Resources
  k8s: z.object({
    cluster: z.enum(['staging', 'production']),
    namespace: z.string(),
    deployments: z.array(z.string()),
    services: z.array(z.string()),
    ingresses: z.array(z.string()),
    configMaps: z.array(z.string()).optional(),
    secrets: z.array(z.string()).optional(),
  }),
  
  // Pod Monitoring
  pods: z.object({
    desired: z.number(),
    ready: z.number(),
    running: z.number(),
    pending: z.number(),
    failed: z.number(),
    restarts: z.number().default(0),
    lastRestart: z.date().optional(),
  }),
  
  // Health & Status
  health: z.object({
    status: z.enum(['healthy', 'degraded', 'critical', 'unknown']).default('unknown'),
    lastCheck: z.date(),
    uptime: z.number().optional(), // in seconds
    responseTime: z.number().optional(), // in milliseconds
  }),
  
  // Observability Links
  observability: z.object({
    grafana: z.object({
      dashboardUrl: z.string().url().optional(),
      alertsUrl: z.string().url().optional(),
    }).optional(),
    loki: z.object({
      logsUrl: z.string().url().optional(),
      query: z.string().optional(),
    }).optional(),
    prometheus: z.object({
      metricsUrl: z.string().url().optional(),
      targets: z.array(z.string()).optional(),
    }).optional(),
  }),
  
  // CI/CD
  cicd: z.object({
    provider: z.enum(['gitea-actions', 'github-actions', 'gitlab-ci', 'argocd']),
    lastBuild: z.object({
      id: z.string(),
      status: z.enum(['success', 'failure', 'running', 'pending']),
      startTime: z.date(),
      endTime: z.date().optional(),
      duration: z.number().optional(),
    }).optional(),
    deploymentHistory: z.array(z.object({
      version: z.string(),
      environment: z.string(),
      timestamp: z.date(),
      status: z.enum(['success', 'failure', 'rollback']),
    })).optional(),
  }),
});

export type ApplicationMonitoring = z.infer<typeof ApplicationMonitoringSchema>;

export class ApplicationMonitor {
  private giteaUrl: string;
  private giteaToken: string;
  private grafanaUrl: string;
  private grafanaToken: string;
  private lokiUrl: string;
  private prometheusUrl: string;

  constructor() {
    this.giteaUrl = process.env.GITEA_URL || 'https://git.gmac.io';
    this.giteaToken = process.env.GITEA_TOKEN || '';
    this.grafanaUrl = process.env.GRAFANA_URL || 'https://grafana.gmac.io';
    this.grafanaToken = process.env.GRAFANA_API_KEY || '';
    this.lokiUrl = process.env.LOKI_URL || 'https://loki.gmac.io';
    this.prometheusUrl = process.env.PROMETHEUS_URL || 'https://prometheus.gmac.io';
  }

  /**
   * Get comprehensive monitoring data for an application
   */
  async getApplicationMonitoring(appName: string, namespace: string = 'default'): Promise<ApplicationMonitoring> {
    const [gitData, helmData, k8sData, observabilityData] = await Promise.all([
      this.getGitRepositoryStatus(appName),
      this.getHelmChartStatus(appName, namespace),
      this.getKubernetesStatus(appName, namespace),
      this.getObservabilityLinks(appName, namespace),
    ]);

    return {
      id: `${appName}-${namespace}`,
      name: appName,
      namespace,
      git: gitData,
      helm: helmData,
      k8s: k8sData.resources,
      pods: k8sData.pods,
      health: await this.getHealthStatus(appName, namespace),
      observability: observabilityData,
      cicd: await this.getCICDStatus(appName),
    };
  }

  /**
   * Get Git repository status from Gitea
   */
  private async getGitRepositoryStatus(appName: string) {
    try {
      const response = await fetch(`${this.giteaUrl}/api/v1/repos/${process.env.GITEA_ORG || 'gmackie'}/${appName}`, {
        headers: {
          'Authorization': `token ${this.giteaToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch repository: ${response.statusText}`);
      }

      const repo = await response.json();
      
      // Get latest commit
      const commitsResponse = await fetch(`${this.giteaUrl}/api/v1/repos/${process.env.GITEA_ORG}/${appName}/commits`, {
        headers: {
          'Authorization': `token ${this.giteaToken}`,
          'Accept': 'application/json',
        },
      });

      const commits = commitsResponse.ok ? await commitsResponse.json() : [];
      const lastCommit = commits[0];

      return {
        url: repo.clone_url || repo.html_url,
        branch: repo.default_branch || 'main',
        provider: 'gitea' as const,
        lastCommit: lastCommit ? {
          sha: lastCommit.sha,
          message: lastCommit.commit.message,
          author: lastCommit.commit.author.name,
          timestamp: new Date(lastCommit.commit.author.date),
        } : undefined,
        webhookUrl: `https://control.gmac.io/api/webhooks/gitea`,
      };
    } catch (error) {
      console.error(`Error fetching Git data for ${appName}:`, error);
      return {
        url: `${this.giteaUrl}/${process.env.GITEA_ORG}/${appName}`,
        branch: 'main',
        provider: 'gitea' as const,
      };
    }
  }

  /**
   * Get Helm chart status
   */
  private async getHelmChartStatus(appName: string, namespace: string) {
    try {
      // Use kubectl to get Helm release info
      const { execSync } = await import('child_process');
      
      const helmCommand = `helm list -n ${namespace} --output json`;
      const helmOutput = execSync(helmCommand, { encoding: 'utf8' });
      const releases = JSON.parse(helmOutput);
      
      const release = releases.find((r: any) => r.name === appName || r.chart.includes(appName));
      
      if (release) {
        return {
          chartName: release.chart.split('-')[0],
          chartVersion: release.chart.split('-').slice(1).join('-'),
          repository: 'https://charts.gmac.io', // Default helm repo
          releaseName: release.name,
          deployedVersion: release.app_version,
          lastDeployed: new Date(release.updated),
          status: this.mapHelmStatus(release.status),
        };
      }
      
      throw new Error('Helm release not found');
    } catch (error) {
      console.error(`Error fetching Helm data for ${appName}:`, error);
      return {
        chartName: appName,
        chartVersion: 'unknown',
        repository: 'https://charts.gmac.io',
        releaseName: appName,
        status: 'unknown' as const,
      };
    }
  }

  /**
   * Get Kubernetes resources and pod status
   */
  private async getKubernetesStatus(appName: string, namespace: string) {
    try {
      const { execSync } = await import('child_process');
      
      // Get deployments
      const deploymentsCmd = `kubectl get deployments -n ${namespace} -l app=${appName} -o json`;
      const deployments = JSON.parse(execSync(deploymentsCmd, { encoding: 'utf8' }));
      
      // Get services
      const servicesCmd = `kubectl get services -n ${namespace} -l app=${appName} -o json`;
      const services = JSON.parse(execSync(servicesCmd, { encoding: 'utf8' }));
      
      // Get ingresses
      const ingressesCmd = `kubectl get ingresses -n ${namespace} -l app=${appName} -o json`;
      const ingresses = JSON.parse(execSync(ingressesCmd, { encoding: 'utf8' }));
      
      // Get pods
      const podsCmd = `kubectl get pods -n ${namespace} -l app=${appName} -o json`;
      const pods = JSON.parse(execSync(podsCmd, { encoding: 'utf8' }));
      
      // Calculate pod statistics
      const podStats = this.calculatePodStats(pods.items);
      
      return {
        resources: {
          cluster: this.determineCluster(namespace),
          namespace,
          deployments: deployments.items.map((d: any) => d.metadata.name),
          services: services.items.map((s: any) => s.metadata.name),
          ingresses: ingresses.items.map((i: any) => i.metadata.name),
        },
        pods: podStats,
      };
    } catch (error) {
      console.error(`Error fetching K8s data for ${appName}:`, error);
      return {
        resources: {
          cluster: 'unknown' as any,
          namespace,
          deployments: [],
          services: [],
          ingresses: [],
        },
        pods: {
          desired: 0,
          ready: 0,
          running: 0,
          pending: 0,
          failed: 0,
          restarts: 0,
        },
      };
    }
  }

  /**
   * Get observability links for Grafana, Loki, etc.
   */
  private async getObservabilityLinks(appName: string, namespace: string) {
    const baseQuery = `{namespace="${namespace}",app="${appName}"}`;
    
    return {
      grafana: {
        dashboardUrl: `${this.grafanaUrl}/d/app-overview/application-overview?var-app=${appName}&var-namespace=${namespace}`,
        alertsUrl: `${this.grafanaUrl}/alerting/list?queryString=${encodeURIComponent(appName)}`,
      },
      loki: {
        logsUrl: `${this.grafanaUrl}/explore?left=%7B"datasource":"loki","queries":%5B%7B"expr":"${encodeURIComponent(baseQuery)}"%7D%5D%7D`,
        query: baseQuery,
      },
      prometheus: {
        metricsUrl: `${this.grafanaUrl}/explore?left=%7B"datasource":"prometheus","queries":%5B%7B"expr":"${encodeURIComponent(baseQuery)}"%7D%5D%7D`,
        targets: [
          `up${baseQuery}`,
          `http_requests_total${baseQuery}`,
          `container_cpu_usage_seconds_total${baseQuery}`,
          `container_memory_usage_bytes${baseQuery}`,
        ],
      },
    };
  }

  /**
   * Get application health status
   */
  private async getHealthStatus(appName: string, namespace: string) {
    try {
      // Check if application has a health endpoint
      const healthUrl = await this.getHealthEndpoint(appName, namespace);
      
      if (healthUrl) {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
          const response = await fetch(healthUrl, { 
            signal: controller.signal,
            headers: { 'User-Agent': 'Control-Panel-Monitor' }
          });
          clearTimeout(timeoutId);
          const responseTime = Date.now() - startTime;
        
          const status = response.ok ? 'healthy' : 'degraded';
          
          return {
            status: status as any,
            lastCheck: new Date(),
            responseTime,
          };
        } catch (error) {
          clearTimeout(timeoutId);
          // Handle fetch error or timeout
          return {
            status: 'critical' as any,
            lastCheck: new Date(),
            responseTime: Date.now() - startTime,
          };
        }
      }
      
      // Fallback to pod status
      const { execSync } = await import('child_process');
      const podsCmd = `kubectl get pods -n ${namespace} -l app=${appName} -o json`;
      const pods = JSON.parse(execSync(podsCmd, { encoding: 'utf8' }));
      
      const healthyPods = pods.items.filter((pod: any) => 
        pod.status.phase === 'Running' && 
        pod.status.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True')
      );
      
      const status = healthyPods.length > 0 ? 'healthy' : 
                   pods.items.length > 0 ? 'degraded' : 'critical';
      
      return {
        status: status as any,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        status: 'unknown' as any,
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Get CI/CD status
   */
  private async getCICDStatus(appName: string) {
    try {
      // Get Gitea Actions status
      const response = await fetch(`${this.giteaUrl}/api/v1/repos/${process.env.GITEA_ORG}/${appName}/actions/runs`, {
        headers: {
          'Authorization': `token ${this.giteaToken}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const runs = await response.json();
        const lastRun = runs.workflow_runs?.[0];
        
        if (lastRun) {
          return {
            provider: 'gitea-actions' as const,
            lastBuild: {
              id: lastRun.id.toString(),
              status: this.mapCIStatus(lastRun.conclusion),
              startTime: new Date(lastRun.created_at),
              endTime: lastRun.updated_at ? new Date(lastRun.updated_at) : undefined,
              duration: lastRun.updated_at && lastRun.created_at ? 
                new Date(lastRun.updated_at).getTime() - new Date(lastRun.created_at).getTime() : undefined,
            },
          };
        }
      }
    } catch (error) {
      console.error(`Error fetching CI/CD data for ${appName}:`, error);
    }

    return {
      provider: 'gitea-actions' as const,
    };
  }

  /**
   * Helper methods
   */
  private calculatePodStats(pods: any[]) {
    const stats = {
      desired: 0,
      ready: 0,
      running: 0,
      pending: 0,
      failed: 0,
      restarts: 0,
    };

    pods.forEach(pod => {
      stats.desired++;
      
      switch (pod.status.phase) {
        case 'Running':
          stats.running++;
          if (pod.status.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True')) {
            stats.ready++;
          }
          break;
        case 'Pending':
          stats.pending++;
          break;
        case 'Failed':
        case 'Error':
          stats.failed++;
          break;
      }
      
      // Count restarts
      const restarts = pod.status.containerStatuses?.reduce((total: number, container: any) => 
        total + (container.restartCount || 0), 0) || 0;
      stats.restarts += restarts;
    });

    return stats;
  }

  private determineCluster(namespace: string): 'staging' | 'production' {
    if (namespace.includes('staging') || namespace.includes('dev')) {
      return 'staging';
    }
    return 'production';
  }

  private mapHelmStatus(status: string) {
    const statusMap: Record<string, any> = {
      'deployed': 'deployed',
      'pending-install': 'pending',
      'pending-upgrade': 'pending',
      'pending-rollback': 'pending',
      'superseded': 'superseded',
      'failed': 'failed',
    };
    return statusMap[status] || 'unknown';
  }

  private mapCIStatus(conclusion: string) {
    const statusMap: Record<string, any> = {
      'success': 'success',
      'failure': 'failure',
      'cancelled': 'failure',
      'neutral': 'pending',
      'skipped': 'pending',
      'timed_out': 'failure',
    };
    return statusMap[conclusion] || 'pending';
  }

  private async getHealthEndpoint(appName: string, namespace: string): Promise<string | null> {
    try {
      const { execSync } = await import('child_process');
      const ingressCmd = `kubectl get ingress -n ${namespace} -l app=${appName} -o json`;
      const ingresses = JSON.parse(execSync(ingressCmd, { encoding: 'utf8' }));
      
      if (ingresses.items.length > 0) {
        const ingress = ingresses.items[0];
        const host = ingress.spec.rules?.[0]?.host;
        const tls = ingress.spec.tls && ingress.spec.tls.length > 0;
        const protocol = tls ? 'https' : 'http';
        
        // Common health check endpoints
        const healthPaths = ['/health', '/healthz', '/api/health', '/status'];
        
        for (const path of healthPaths) {
          const url = `${protocol}://${host}${path}`;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const response = await fetch(url, { 
              method: 'HEAD',
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
              return url;
            }
          } catch (e) {
            // Continue to next path
          }
        }
      }
    } catch (error) {
      // No ingress or error getting ingress
    }
    
    return null;
  }
}

export const applicationMonitor = new ApplicationMonitor();
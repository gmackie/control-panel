import { GiteaService } from '@/lib/gitea/gitea-service';
import { K3sService } from '@/lib/k3s/k3s-service';
import { PrometheusClient } from '@/lib/prometheus/client';
import { GrafanaClient } from '@/lib/grafana/client';
import { GitHubClient, CrossPublishedRepo } from '@/lib/github/client';

export interface Application {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  
  // Gitea Repository info
  gitea?: {
    owner: string;
    repo: string;
    url: string;
    defaultBranch: string;
    lastCommit?: {
      sha: string;
      message: string;
      author: string;
      date: string;
    };
    workflows?: Array<{
      id: number;
      name: string;
      status: string;
      conclusion?: string;
      url: string;
    }>;
  };

  // GitHub cross-publish info
  github?: {
    url: string;
    fullName: string;
    lastPush?: string;
    stars: number;
    forks: number;
    syncStatus: 'synced' | 'gitea-ahead' | 'github-ahead' | 'unknown';
  };
  
  // Kubernetes Deployment info
  kubernetes?: {
    namespace: string;
    deploymentName: string;
    replicas: number;
    readyReplicas: number;
    image: string;
    imageTag: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    pods: Array<{
      name: string;
      status: string;
      ready: boolean;
      restarts: number;
    }>;
    services: Array<{
      name: string;
      type: string;
      clusterIP: string;
      externalIP?: string;
      ports: string;
    }>;
    ingress?: {
      host: string;
      path: string;
      tls: boolean;
    };
  };
  
  // Container Registry info
  registry?: {
    image: string;
    tags: string[];
    lastPushed?: string;
    size?: string;
  };

  // Metrics from Prometheus
  metrics?: {
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
    latency: number;
  };

  // Observability links
  observability?: {
    grafanaDashboardUrl?: string;
    grafanaExploreUrl?: string;
    prometheusUrl?: string;
    logsUrl?: string;
  };
  
  // Linkage status
  linked: boolean;
  crossPublished: boolean;
  lastSynced: string;
}

export interface ApplicationMapping {
  giteaRepo: string;  // format: owner/repo
  k8sNamespace: string;
  k8sDeployment: string;
  registryImage?: string;
}

// Known mappings between Gitea repos and K8s deployments
const KNOWN_MAPPINGS: ApplicationMapping[] = [
  {
    giteaRepo: 'gmackie/control-panel',
    k8sNamespace: 'control-panel',
    k8sDeployment: 'control-panel',
    registryImage: 'registry.gmac.io/library/control-panel',
  },
  {
    giteaRepo: 'gmackie/classcheck-app',
    k8sNamespace: 'classcheck-staging',
    k8sDeployment: 'classcheck-frontend-staging',
    registryImage: 'registry.gmac.io/classcheck/frontend',
  },
  {
    giteaRepo: 'gmackie/classback',
    k8sNamespace: 'classcheck-staging',
    k8sDeployment: 'classback',
    registryImage: 'registry.gmac.io/classcheck/backend',
  },
  {
    giteaRepo: 'gmackie/class-check-api',
    k8sNamespace: 'classcheck-staging',
    k8sDeployment: 'classcheck-backend',
    registryImage: 'registry.gmac.io/classcheck/backend',
  },
  {
    giteaRepo: 'gmackie/edgeops',
    k8sNamespace: 'edgeops',
    k8sDeployment: 'edgeops',
  },
];

export class ApplicationRegistry {
  private giteaService: GiteaService;
  private k3sService: K3sService;
  private prometheusClient: PrometheusClient;
  private grafanaClient: GrafanaClient;
  private githubClient: GitHubClient;
  private mappings: ApplicationMapping[];
  private cache: Map<string, Application> = new Map();
  private cacheExpiry: number = 0;
  private cacheTTL: number = 60000; // 1 minute

  constructor() {
    this.giteaService = new GiteaService();
    this.k3sService = new K3sService();
    this.prometheusClient = new PrometheusClient();
    this.grafanaClient = new GrafanaClient();
    this.githubClient = new GitHubClient();
    this.mappings = [...KNOWN_MAPPINGS];
  }

  async discoverApplications(): Promise<Application[]> {
    // Check cache
    if (Date.now() < this.cacheExpiry && this.cache.size > 0) {
      return Array.from(this.cache.values());
    }

    const applications: Application[] = [];
    const processedRepos = new Set<string>();
    const processedDeployments = new Set<string>();

    // Fetch data from all sources in parallel
    const [giteaRepos, k8sDeployments, k8sPods, k8sServices, crossPublishedRepos] = await Promise.all([
      this.giteaService.getRepositories(),
      this.k3sService.getDeployments(),
      this.k3sService.getPods(),
      this.k3sService.getServices(),
      this.getCrossPublishedRepos(),
    ]);

    // Create a map for quick cross-publish lookup
    const crossPublishMap = new Map<string, CrossPublishedRepo>();
    for (const repo of crossPublishedRepos) {
      crossPublishMap.set(repo.name.toLowerCase(), repo);
    }

    // First, process known mappings
    for (const mapping of this.mappings) {
      const giteaRepo = giteaRepos.find(r => r.full_name === mapping.giteaRepo);
      const k8sDeployment = k8sDeployments.find(
        d => d.namespace === mapping.k8sNamespace && d.name === mapping.k8sDeployment
      );

      if (giteaRepo || k8sDeployment) {
        const app = await this.buildApplication(
          mapping.giteaRepo,
          giteaRepo,
          k8sDeployment,
          k8sPods,
          k8sServices,
          crossPublishMap
        );
        applications.push(app);
        processedRepos.add(mapping.giteaRepo);
        if (k8sDeployment) {
          processedDeployments.add(`${mapping.k8sNamespace}/${mapping.k8sDeployment}`);
        }
      }
    }

    // Auto-discover by matching repo names to deployment names
    for (const giteaRepo of giteaRepos) {
      if (processedRepos.has(giteaRepo.full_name)) continue;

      // Try to find a matching K8s deployment
      const matchingDeployment = k8sDeployments.find(d => {
        const deployKey = `${d.namespace}/${d.name}`;
        if (processedDeployments.has(deployKey)) return false;
        
        // Match by name similarity
        const repoName = giteaRepo.name.toLowerCase();
        const deployName = d.name.toLowerCase();
        const namespace = d.namespace.toLowerCase();
        
        return deployName.includes(repoName) || 
               repoName.includes(deployName) ||
               namespace.includes(repoName);
      });

      const app = await this.buildApplication(
        giteaRepo.full_name,
        giteaRepo,
        matchingDeployment,
        k8sPods,
        k8sServices,
        crossPublishMap
      );
      
      applications.push(app);
      processedRepos.add(giteaRepo.full_name);
      if (matchingDeployment) {
        processedDeployments.add(`${matchingDeployment.namespace}/${matchingDeployment.name}`);
      }
    }

    // Add unlinked K8s deployments (custom apps not in Gitea)
    const appNamespaces = ['control-panel', 'classcheck-staging', 'edgeops', 'demo-app', 'hello-world'];
    for (const deployment of k8sDeployments) {
      const deployKey = `${deployment.namespace}/${deployment.name}`;
      if (processedDeployments.has(deployKey)) continue;
      if (!appNamespaces.includes(deployment.namespace)) continue;

      const app = await this.buildApplication(
        null,
        null,
        deployment,
        k8sPods,
        k8sServices,
        crossPublishMap
      );
      applications.push(app);
    }

    // Update cache
    this.cache.clear();
    for (const app of applications) {
      this.cache.set(app.id, app);
    }
    this.cacheExpiry = Date.now() + this.cacheTTL;

    return applications;
  }

  private async getCrossPublishedRepos(): Promise<CrossPublishedRepo[]> {
    try {
      const giteaRepos = await this.giteaService.getRepositories();
      return await this.githubClient.findCrossPublishedRepos(giteaRepos);
    } catch (error) {
      console.error('Error fetching cross-published repos:', error);
      return [];
    }
  }

  private async buildApplication(
    repoFullName: string | null,
    giteaRepo: any | null,
    k8sDeployment: any | null,
    allPods: any[],
    allServices: any[],
    crossPublishMap: Map<string, CrossPublishedRepo>
  ): Promise<Application> {
    const id = repoFullName || 
      (k8sDeployment ? `k8s:${k8sDeployment.namespace}/${k8sDeployment.name}` : `unknown-${Date.now()}`);
    
    const name = giteaRepo?.name || k8sDeployment?.name || 'unknown';
    const displayName = this.formatDisplayName(name);

    const app: Application = {
      id,
      name,
      displayName,
      description: giteaRepo?.description,
      linked: !!(giteaRepo && k8sDeployment),
      crossPublished: false,
      lastSynced: new Date().toISOString(),
    };

    // Add Gitea info
    if (giteaRepo) {
      const [owner, repo] = giteaRepo.full_name.split('/');
      
      // Get latest commit
      let lastCommit;
      try {
        const commits = await this.giteaService.getCommits(owner, repo, { limit: 1 });
        if (commits.length > 0) {
          const c = commits[0];
          lastCommit = {
            sha: c.sha,
            message: c.commit?.message || '',
            author: c.commit?.author?.name || c.author?.login || '',
            date: c.commit?.author?.date || c.created,
          };
        }
      } catch {
        // Ignore commit fetch errors
      }

      // Get workflow runs
      let workflows: any[] = [];
      try {
        const runs = await this.giteaService.getWorkflowRuns({ owner, repo, limit: 5 });
        workflows = runs.map(run => ({
          id: run.id,
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          url: `${process.env.GITEA_URL}/${giteaRepo.full_name}/actions/runs/${run.id}`,
        }));
      } catch {
        // Ignore workflow fetch errors
      }

      app.gitea = {
        owner,
        repo,
        url: giteaRepo.html_url,
        defaultBranch: giteaRepo.default_branch,
        lastCommit,
        workflows,
      };

      // Check for GitHub cross-publish
      const crossPublish = crossPublishMap.get(name.toLowerCase());
      if (crossPublish) {
        app.crossPublished = true;
        app.github = {
          url: crossPublish.github.url,
          fullName: crossPublish.github.fullName,
          lastPush: crossPublish.github.lastPush,
          stars: crossPublish.github.stars,
          forks: crossPublish.github.forks,
          syncStatus: crossPublish.syncStatus,
        };
      }
    }

    // Add Kubernetes info
    if (k8sDeployment) {
      const deploymentPods = allPods.filter(
        p => p.namespace === k8sDeployment.namespace && 
             p.name.startsWith(k8sDeployment.name)
      );

      const deploymentServices = allServices.filter(
        s => s.namespace === k8sDeployment.namespace &&
             (s.name === k8sDeployment.name || s.name.startsWith(k8sDeployment.name))
      );

      // Parse image and tag
      const image = k8sDeployment.image;
      const imageParts = image.split(':');
      const imageTag = imageParts.length > 1 ? imageParts[imageParts.length - 1] : 'latest';
      const imageName = imageParts.slice(0, -1).join(':') || image;

      // Determine health status
      let status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' = 'unknown';
      if (k8sDeployment.readyReplicas === k8sDeployment.replicas && k8sDeployment.replicas > 0) {
        status = 'healthy';
      } else if (k8sDeployment.readyReplicas > 0) {
        status = 'degraded';
      } else if (k8sDeployment.replicas > 0) {
        status = 'unhealthy';
      }

      app.kubernetes = {
        namespace: k8sDeployment.namespace,
        deploymentName: k8sDeployment.name,
        replicas: k8sDeployment.replicas,
        readyReplicas: k8sDeployment.readyReplicas,
        image: imageName,
        imageTag,
        status,
        pods: deploymentPods.map(p => ({
          name: p.name,
          status: p.status,
          ready: p.ready === `${p.ready.split('/')[0]}/${p.ready.split('/')[0]}`,
          restarts: p.restarts,
        })),
        services: deploymentServices.map(s => ({
          name: s.name,
          type: s.type,
          clusterIP: s.clusterIP,
          externalIP: s.externalIP,
          ports: s.ports,
        })),
      };

      // Add registry info if using custom registry
      if (image.includes('registry.gmac.io')) {
        app.registry = {
          image: imageName,
          tags: [imageTag],
        };
      }

      // Fetch metrics from Prometheus
      try {
        app.metrics = await this.prometheusClient.getApplicationMetrics(
          k8sDeployment.namespace,
          k8sDeployment.name
        );
      } catch {
        // Metrics unavailable
      }

      // Add observability links
      const prometheusUrl = process.env.PROMETHEUS_URL || 'https://prometheus.gmac.io';
      
      app.observability = {
        grafanaDashboardUrl: this.grafanaClient.getDashboardUrl({
          namespace: k8sDeployment.namespace,
          app: k8sDeployment.name,
        }),
        grafanaExploreUrl: this.grafanaClient.getExploreUrl(
          `{namespace="${k8sDeployment.namespace}",pod=~"${k8sDeployment.name}.*"}`
        ),
        prometheusUrl: `${prometheusUrl}/graph?g0.expr=container_cpu_usage_seconds_total{namespace="${k8sDeployment.namespace}",pod=~"${k8sDeployment.name}.*"}`,
      };
    }

    return app;
  }

  private formatDisplayName(name: string): string {
    return name
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async getApplication(id: string): Promise<Application | null> {
    const apps = await this.discoverApplications();
    return apps.find(a => a.id === id) || null;
  }

  async addMapping(mapping: ApplicationMapping): Promise<void> {
    // Check if mapping already exists
    const existing = this.mappings.find(
      m => m.giteaRepo === mapping.giteaRepo && 
           m.k8sNamespace === mapping.k8sNamespace &&
           m.k8sDeployment === mapping.k8sDeployment
    );
    
    if (!existing) {
      this.mappings.push(mapping);
      // Invalidate cache
      this.cacheExpiry = 0;
    }
  }

  async removeMapping(giteaRepo: string): Promise<void> {
    this.mappings = this.mappings.filter(m => m.giteaRepo !== giteaRepo);
    this.cacheExpiry = 0;
  }

  getMappings(): ApplicationMapping[] {
    return [...this.mappings];
  }

  // Get cluster-wide metrics
  async getClusterMetrics() {
    return this.prometheusClient.getClusterMetrics();
  }

  // Get Grafana dashboards
  async getGrafanaDashboards() {
    try {
      return await this.grafanaClient.getKubernetesDashboards();
    } catch {
      return [];
    }
  }
}

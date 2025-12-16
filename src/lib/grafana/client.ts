/**
 * Grafana API Client
 * Connects to Grafana to fetch dashboards and generate links
 */

export interface GrafanaConfig {
  url: string;           // Internal URL for API calls
  externalUrl?: string;  // External URL for browser links
  apiKey?: string;
}

export interface GrafanaDashboard {
  id: number;
  uid: string;
  title: string;
  uri: string;
  url: string;
  slug: string;
  type: string;
  tags: string[];
  isStarred: boolean;
  folderId?: number;
  folderUid?: string;
  folderTitle?: string;
  folderUrl?: string;
}

export interface GrafanaFolder {
  id: number;
  uid: string;
  title: string;
  url: string;
  hasAcl: boolean;
  canSave: boolean;
  canEdit: boolean;
  canAdmin: boolean;
  canDelete: boolean;
  createdBy: string;
  created: string;
  updatedBy: string;
  updated: string;
}

export interface GrafanaDatasource {
  id: number;
  uid: string;
  name: string;
  type: string;
  typeName: string;
  access: string;
  url: string;
  isDefault: boolean;
  database: string;
}

export interface GrafanaAlertRule {
  id: number;
  uid: string;
  orgID: number;
  folderUID: string;
  ruleGroup: string;
  title: string;
  condition: string;
  data: any[];
  updated: string;
  noDataState: string;
  execErrState: string;
  for: string;
  annotations: Record<string, string>;
  labels: Record<string, string>;
  isPaused: boolean;
}

export interface GrafanaAnnotation {
  id?: number;
  alertId?: number;
  dashboardId?: number;
  dashboardUID?: string;
  panelId?: number;
  time: number;
  timeEnd?: number;
  tags?: string[];
  text: string;
}

export class GrafanaClient {
  private config: GrafanaConfig;

  constructor(config?: Partial<GrafanaConfig>) {
    this.config = {
      url: config?.url || process.env.GRAFANA_URL || 'http://kube-prometheus-stack-grafana.monitoring.svc.cluster.local',
      externalUrl: config?.externalUrl || process.env.GRAFANA_EXTERNAL_URL || process.env.GRAFANA_URL || 'https://grafana.gmac.io',
      apiKey: config?.apiKey || process.env.GRAFANA_API_KEY || process.env.GRAFANA_TOKEN,
    };
  }

  /**
   * Get the external URL for browser links
   */
  getExternalBaseUrl(): string {
    return this.config.externalUrl || this.config.url;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.config.url}${path}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });

    if (!response.ok) {
      throw new Error(`Grafana API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search for dashboards
   */
  async searchDashboards(query?: string, tags?: string[]): Promise<GrafanaDashboard[]> {
    const params = new URLSearchParams();
    params.append('type', 'dash-db');
    if (query) params.append('query', query);
    if (tags?.length) tags.forEach(tag => params.append('tag', tag));

    return this.request<GrafanaDashboard[]>(`/api/search?${params}`);
  }

  /**
   * Get a specific dashboard by UID
   */
  async getDashboard(uid: string): Promise<{ dashboard: any; meta: any }> {
    return this.request<{ dashboard: any; meta: any }>(`/api/dashboards/uid/${uid}`);
  }

  /**
   * Get all folders
   */
  async getFolders(): Promise<GrafanaFolder[]> {
    return this.request<GrafanaFolder[]>('/api/folders');
  }

  /**
   * Get all datasources
   */
  async getDatasources(): Promise<GrafanaDatasource[]> {
    return this.request<GrafanaDatasource[]>('/api/datasources');
  }

  /**
   * Get all alert rules
   */
  async getAlertRules(): Promise<{ rules: GrafanaAlertRule[] }> {
    try {
      return await this.request<{ rules: GrafanaAlertRule[] }>('/api/v1/provisioning/alert-rules');
    } catch {
      // Fallback to older API
      return { rules: [] };
    }
  }

  /**
   * Create an annotation
   */
  async createAnnotation(annotation: GrafanaAnnotation): Promise<{ id: number; message: string }> {
    return this.request<{ id: number; message: string }>('/api/annotations', {
      method: 'POST',
      body: JSON.stringify(annotation),
    });
  }

  /**
   * Check Grafana health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate a dashboard URL for an application (uses external URL for browser)
   */
  getDashboardUrl(options: {
    namespace?: string;
    app?: string;
    dashboardUid?: string;
  }): string {
    const baseUrl = this.getExternalBaseUrl().replace(/\/$/, '');
    
    if (options.dashboardUid) {
      return `${baseUrl}/d/${options.dashboardUid}`;
    }

    // Generate explore URL with pre-filled queries
    if (options.namespace && options.app) {
      // Create a default explore query
      const query = encodeURIComponent(`{namespace="${options.namespace}",pod=~"${options.app}.*"}`);
      return `${baseUrl}/explore?left={"datasource":"prometheus","queries":[{"expr":"container_cpu_usage_seconds_total${query}"}]}`;
    }

    return `${baseUrl}/dashboards`;
  }

  /**
   * Generate explore URL for metrics (uses external URL for browser)
   */
  getExploreUrl(query: string, datasource: string = 'prometheus'): string {
    const baseUrl = this.getExternalBaseUrl().replace(/\/$/, '');
    const encodedQuery = encodeURIComponent(query);
    return `${baseUrl}/explore?left={"datasource":"${datasource}","queries":[{"expr":"${encodedQuery}"}]}`;
  }

  /**
   * Get common dashboards for Kubernetes monitoring
   */
  async getKubernetesDashboards(): Promise<GrafanaDashboard[]> {
    const allDashboards = await this.searchDashboards();
    
    // Filter for common K8s dashboards
    const k8sKeywords = ['kubernetes', 'k8s', 'node', 'pod', 'container', 'cluster', 'namespace'];
    
    return allDashboards.filter(d => 
      k8sKeywords.some(keyword => 
        d.title.toLowerCase().includes(keyword) || 
        d.tags.some(tag => tag.toLowerCase().includes(keyword))
      )
    );
  }

  /**
   * Find dashboard for a specific application
   */
  async findApplicationDashboard(appName: string, _namespace?: string): Promise<GrafanaDashboard | null> {
    const dashboards = await this.searchDashboards(appName);
    
    if (dashboards.length > 0) {
      // Try to find exact match first
      const exactMatch = dashboards.find(d => 
        d.title.toLowerCase() === appName.toLowerCase()
      );
      if (exactMatch) return exactMatch;
      
      // Return first partial match
      return dashboards[0];
    }
    
    return null;
  }
}

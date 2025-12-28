/**
 * PostHog API Client
 * Monitor analytics events, feature flags, and user behavior
 */

export interface PostHogEvent {
  id: string;
  distinct_id: string;
  event: string;
  properties: Record<string, any>;
  timestamp: string;
  created_at: string;
  elements?: any[];
}

export interface PostHogPerson {
  id: string;
  uuid: string;
  distinct_ids: string[];
  properties: Record<string, any>;
  created_at: string;
}

export interface PostHogFeatureFlag {
  id: number;
  key: string;
  name: string;
  active: boolean;
  deleted: boolean;
  created_at: string;
  created_by: {
    id: number;
    email: string;
  };
  rollout_percentage: number | null;
  filters: {
    groups: Array<{
      properties: any[];
      rollout_percentage: number | null;
    }>;
    multivariate: {
      variants: Array<{
        key: string;
        name: string;
        rollout_percentage: number;
      }>;
    } | null;
  };
  experiment_set: number[] | null;
}

export interface PostHogInsight {
  id: number;
  short_id: string;
  name: string;
  description: string;
  favorited: boolean;
  filters: Record<string, any>;
  result: any;
  created_at: string;
  updated_at: string;
  last_refresh: string;
  saved: boolean;
}

export interface PostHogDashboard {
  id: number;
  name: string;
  description: string;
  pinned: boolean;
  created_at: string;
  created_by: {
    id: number;
    email: string;
  };
  is_shared: boolean;
  deleted: boolean;
  tiles: Array<{
    id: number;
    insight: PostHogInsight | null;
    text: string | null;
  }>;
}

export interface PostHogCohort {
  id: number;
  name: string;
  description: string;
  count: number;
  is_static: boolean;
  created_at: string;
  groups: any[];
}

export interface PostHogAnnotation {
  id: number;
  content: string;
  date_marker: string;
  created_at: string;
  created_by: {
    id: number;
    email: string;
  };
  scope: 'organization' | 'project';
}

export interface PostHogProject {
  id: number;
  uuid: string;
  organization: string;
  api_token: string;
  name: string;
  completed_snippet_onboarding: boolean;
  ingested_event: boolean;
  is_demo: boolean;
  timezone: string;
  created_at: string;
}

export class PostHogClient {
  private baseUrl: string;
  private apiKey: string;
  private projectId: string;

  constructor(config: { apiKey: string; projectId: string; host?: string }) {
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.baseUrl = config.host || 'https://app.posthog.com';
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PostHog API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Events
  async queryEvents(options?: {
    event?: string;
    after?: string;
    before?: string;
    limit?: number;
    properties?: Record<string, any>;
  }): Promise<{ results: PostHogEvent[] }> {
    const params = new URLSearchParams();
    if (options?.event) params.set('event', options.event);
    if (options?.after) params.set('after', options.after);
    if (options?.before) params.set('before', options.before);
    if (options?.limit) params.set('limit', options.limit.toString());

    return this.request(`/api/projects/${this.projectId}/events?${params}`);
  }

  async getEventDefinitions(): Promise<{ results: Array<{ name: string; volume_30_day: number; query_usage_30_day: number }> }> {
    return this.request(`/api/projects/${this.projectId}/event_definitions`);
  }

  // Persons
  async listPersons(options?: {
    limit?: number;
    search?: string;
  }): Promise<{ results: PostHogPerson[]; count: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.search) params.set('search', options.search);

    return this.request(`/api/projects/${this.projectId}/persons?${params}`);
  }

  async getPerson(personId: string): Promise<PostHogPerson> {
    return this.request(`/api/projects/${this.projectId}/persons/${personId}`);
  }

  // Feature Flags
  async listFeatureFlags(): Promise<{ results: PostHogFeatureFlag[] }> {
    return this.request(`/api/projects/${this.projectId}/feature_flags`);
  }

  async getFeatureFlag(flagId: number): Promise<PostHogFeatureFlag> {
    return this.request(`/api/projects/${this.projectId}/feature_flags/${flagId}`);
  }

  async updateFeatureFlag(flagId: number, data: Partial<{ active: boolean; rollout_percentage: number }>): Promise<PostHogFeatureFlag> {
    return this.request(`/api/projects/${this.projectId}/feature_flags/${flagId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Insights
  async listInsights(options?: {
    limit?: number;
    saved?: boolean;
  }): Promise<{ results: PostHogInsight[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.saved !== undefined) params.set('saved', options.saved.toString());

    return this.request(`/api/projects/${this.projectId}/insights?${params}`);
  }

  async getInsight(insightId: number): Promise<PostHogInsight> {
    return this.request(`/api/projects/${this.projectId}/insights/${insightId}`);
  }

  // Dashboards
  async listDashboards(): Promise<{ results: PostHogDashboard[] }> {
    return this.request(`/api/projects/${this.projectId}/dashboards`);
  }

  async getDashboard(dashboardId: number): Promise<PostHogDashboard> {
    return this.request(`/api/projects/${this.projectId}/dashboards/${dashboardId}`);
  }

  // Cohorts
  async listCohorts(): Promise<{ results: PostHogCohort[] }> {
    return this.request(`/api/projects/${this.projectId}/cohorts`);
  }

  // Annotations
  async listAnnotations(): Promise<{ results: PostHogAnnotation[] }> {
    return this.request(`/api/projects/${this.projectId}/annotations`);
  }

  // Project info
  async getProject(): Promise<PostHogProject> {
    return this.request(`/api/projects/${this.projectId}`);
  }

  // Trend query (for analytics)
  async queryTrend(options: {
    events: Array<{ id: string; name?: string }>;
    date_from?: string;
    date_to?: string;
    interval?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<{ result: any[] }> {
    return this.request(`/api/projects/${this.projectId}/insights/trend`, {
      method: 'POST',
      body: JSON.stringify({
        insight: 'TRENDS',
        events: options.events,
        date_from: options.date_from || '-7d',
        date_to: options.date_to,
        interval: options.interval || 'day',
      }),
    });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.getProject();
      return true;
    } catch {
      return false;
    }
  }
}

// Service layer
export class PostHogService {
  private client: PostHogClient;

  constructor() {
    this.client = new PostHogClient({
      apiKey: process.env.POSTHOG_API_KEY || '',
      projectId: process.env.POSTHOG_PROJECT_ID || '',
      host: process.env.POSTHOG_HOST,
    });
  }

  async getProject() {
    return this.client.getProject();
  }

  async getRecentEvents(limit = 50) {
    const { results } = await this.client.queryEvents({ limit });
    return results;
  }

  async getEventsByType(eventName: string, limit = 100) {
    const { results } = await this.client.queryEvents({ event: eventName, limit });
    return results;
  }

  async getEventDefinitions() {
    const { results } = await this.client.getEventDefinitions();
    return results;
  }

  async getPersons(limit = 50) {
    const { results } = await this.client.listPersons({ limit });
    return results;
  }

  async getFeatureFlags() {
    const { results } = await this.client.listFeatureFlags();
    return results;
  }

  async toggleFeatureFlag(flagId: number, active: boolean) {
    return this.client.updateFeatureFlag(flagId, { active });
  }

  async getInsights(saved = true) {
    const { results } = await this.client.listInsights({ saved });
    return results;
  }

  async getDashboards() {
    const { results } = await this.client.listDashboards();
    return results;
  }

  async getCohorts() {
    const { results } = await this.client.listCohorts();
    return results;
  }

  async getDashboardStats() {
    const [
      eventDefs,
      featureFlags,
      insights,
      dashboards,
      cohorts,
      recentEvents,
      persons
    ] = await Promise.all([
      this.client.getEventDefinitions().catch(() => ({ results: [] })),
      this.client.listFeatureFlags().catch(() => ({ results: [] })),
      this.client.listInsights({ saved: true }).catch(() => ({ results: [] })),
      this.client.listDashboards().catch(() => ({ results: [] })),
      this.client.listCohorts().catch(() => ({ results: [] })),
      this.client.queryEvents({ limit: 100 }).catch(() => ({ results: [] })),
      this.client.listPersons({ limit: 100 }).catch(() => ({ results: [], count: 0 })),
    ]);

    // Feature flag stats
    const activeFlags = featureFlags.results.filter(f => f.active && !f.deleted);
    const inactiveFlags = featureFlags.results.filter(f => !f.active && !f.deleted);
    const experimentFlags = featureFlags.results.filter(f => f.experiment_set?.length);

    // Event stats
    const eventTypes = eventDefs.results;
    const topEvents = eventTypes
      .sort((a, b) => (b.volume_30_day || 0) - (a.volume_30_day || 0))
      .slice(0, 10);
    
    const totalEvents30d = eventTypes.reduce((sum, e) => sum + (e.volume_30_day || 0), 0);

    // Group recent events by type
    const eventBreakdown: Record<string, number> = {};
    recentEvents.results.forEach(event => {
      eventBreakdown[event.event] = (eventBreakdown[event.event] || 0) + 1;
    });

    // Recent persons with activity
    const _now = new Date();
    // Timestamps available for future filtering if needed
    // const last24h = new Date(_now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    // const last7d = new Date(_now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    return {
      // Feature Flags
      totalFeatureFlags: featureFlags.results.filter(f => !f.deleted).length,
      activeFeatureFlags: activeFlags.length,
      inactiveFeatureFlags: inactiveFlags.length,
      experimentsRunning: experimentFlags.filter(f => f.active).length,

      // Feature flags list for quick toggle
      featureFlags: featureFlags.results
        .filter(f => !f.deleted)
        .slice(0, 10)
        .map(f => ({
          id: f.id,
          key: f.key,
          name: f.name,
          active: f.active,
          rollout_percentage: f.rollout_percentage,
        })),

      // Events
      totalEventTypes: eventTypes.length,
      totalEvents30d,
      topEvents: topEvents.map(e => ({
        name: e.name,
        count: e.volume_30_day,
      })),
      recentEventBreakdown: eventBreakdown,

      // Insights & Dashboards
      savedInsights: insights.results.length,
      dashboards: dashboards.results.length,
      pinnedDashboards: dashboards.results.filter(d => d.pinned).length,

      // Cohorts
      cohorts: cohorts.results.length,
      totalCohortUsers: cohorts.results.reduce((sum, c) => sum + (c.count || 0), 0),

      // Persons
      trackedPersons: persons.count || persons.results.length,
    };
  }

  async healthCheck() {
    return this.client.healthCheck();
  }
}

export const postHogService = new PostHogService();

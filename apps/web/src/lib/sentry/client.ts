/**
 * Sentry API Client
 * Monitor errors, issues, releases, and performance
 */

export interface SentryProject {
  id: string;
  slug: string;
  name: string;
  dateCreated: string;
  platform: string;
  isBookmarked: boolean;
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  features: string[];
  status: 'active' | 'disabled' | 'pending_deletion';
}

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  status: 'unresolved' | 'resolved' | 'ignored';
  statusDetails: Record<string, any>;
  isPublic: boolean;
  platform: string;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  type: string;
  metadata: {
    value?: string;
    type?: string;
    filename?: string;
    function?: string;
  };
  numComments: number;
  userCount: number;
  count: string;
  firstSeen: string;
  lastSeen: string;
  stats: {
    '24h': number[][];
    '30d'?: number[][];
  };
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
  isSubscribed: boolean;
  hasSeen: boolean;
  annotations: string[];
  isUnhandled: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface SentryEvent {
  eventID: string;
  context: Record<string, any>;
  contexts: Record<string, any>;
  dateCreated: string;
  dateReceived: string;
  entries: Array<{
    type: string;
    data: any;
  }>;
  errors: any[];
  fingerprints: string[];
  groupID: string;
  id: string;
  message: string;
  platform: string;
  projectID: string;
  sdk: {
    name: string;
    version: string;
  };
  tags: Array<{
    key: string;
    value: string;
  }>;
  title: string;
  type: string;
  user: {
    id?: string;
    email?: string;
    ip_address?: string;
    username?: string;
  } | null;
}

export interface SentryRelease {
  version: string;
  shortVersion: string;
  ref: string | null;
  url: string | null;
  dateReleased: string | null;
  dateCreated: string;
  data: Record<string, any>;
  newGroups: number;
  firstEvent: string | null;
  lastEvent: string | null;
  commitCount: number;
  authors: Array<{
    name: string;
    email: string;
  }>;
  projects: Array<{
    id: number;
    slug: string;
    name: string;
  }>;
  versionInfo: {
    package: string | null;
    version: {
      raw: string;
    };
    description: string;
    buildHash: string | null;
  };
}

export interface SentryTeam {
  id: string;
  slug: string;
  name: string;
  dateCreated: string;
  memberCount: number;
}

export interface SentryOrganizationStats {
  start: string;
  end: string;
  intervals: string[];
  groups: Array<{
    by: Record<string, string>;
    series: Record<string, number[]>;
    totals: Record<string, number>;
  }>;
}

export interface SentryPerformanceTransaction {
  id: string;
  transaction: string;
  project: string;
  'count()': number;
  'avg(transaction.duration)': number;
  'p50(transaction.duration)': number;
  'p95(transaction.duration)': number;
  'failure_rate()': number;
  'apdex()': number;
}

export class SentryClient {
  private baseUrl = 'https://sentry.io/api/0';
  private authToken: string;
  private organization: string;

  constructor(config: { authToken: string; organization: string }) {
    this.authToken = config.authToken;
    this.organization = config.organization;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sentry API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Projects
  async listProjects(): Promise<SentryProject[]> {
    return this.request<SentryProject[]>(`/organizations/${this.organization}/projects/`);
  }

  async getProject(projectSlug: string): Promise<SentryProject> {
    return this.request<SentryProject>(`/projects/${this.organization}/${projectSlug}/`);
  }

  // Issues
  async listIssues(options?: {
    project?: string;
    query?: string;
    statsPeriod?: string;
    limit?: number;
    sort?: 'date' | 'new' | 'priority' | 'freq' | 'user';
  }): Promise<SentryIssue[]> {
    const params = new URLSearchParams();
    if (options?.project) params.set('project', options.project);
    if (options?.query) params.set('query', options.query);
    if (options?.statsPeriod) params.set('statsPeriod', options.statsPeriod);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.sort) params.set('sort', options.sort);

    return this.request<SentryIssue[]>(`/organizations/${this.organization}/issues/?${params}`);
  }

  async getIssue(issueId: string): Promise<SentryIssue> {
    return this.request<SentryIssue>(`/issues/${issueId}/`);
  }

  async updateIssue(issueId: string, data: { status?: string; assignedTo?: string; hasSeen?: boolean }): Promise<SentryIssue> {
    return this.request<SentryIssue>(`/issues/${issueId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Events
  async listEvents(issueId: string, options?: {
    limit?: number;
  }): Promise<SentryEvent[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());

    return this.request<SentryEvent[]>(`/issues/${issueId}/events/?${params}`);
  }

  async getLatestEvent(issueId: string): Promise<SentryEvent> {
    return this.request<SentryEvent>(`/issues/${issueId}/events/latest/`);
  }

  // Releases
  async listReleases(options?: {
    project?: string;
    query?: string;
    limit?: number;
  }): Promise<SentryRelease[]> {
    const params = new URLSearchParams();
    if (options?.project) params.set('project', options.project);
    if (options?.query) params.set('query', options.query);
    if (options?.limit) params.set('limit', options.limit.toString());

    return this.request<SentryRelease[]>(`/organizations/${this.organization}/releases/?${params}`);
  }

  async getRelease(version: string): Promise<SentryRelease> {
    return this.request<SentryRelease>(`/organizations/${this.organization}/releases/${encodeURIComponent(version)}/`);
  }

  // Teams
  async listTeams(): Promise<SentryTeam[]> {
    return this.request<SentryTeam[]>(`/organizations/${this.organization}/teams/`);
  }

  // Organization Stats
  async getOrganizationStats(options?: {
    statsPeriod?: string;
    interval?: string;
    field?: string;
    category?: string;
  }): Promise<SentryOrganizationStats> {
    const params = new URLSearchParams();
    params.set('statsPeriod', options?.statsPeriod || '24h');
    params.set('interval', options?.interval || '1h');
    params.set('field', options?.field || 'sum(quantity)');
    params.set('category', options?.category || 'error');

    return this.request<SentryOrganizationStats>(`/organizations/${this.organization}/stats_v2/?${params}`);
  }

  // Performance (requires performance monitoring feature)
  async getPerformanceTransactions(options?: {
    project?: string;
    statsPeriod?: string;
    query?: string;
  }): Promise<{ data: SentryPerformanceTransaction[] }> {
    const params = new URLSearchParams();
    params.set('field', 'transaction');
    params.set('field', 'project');
    params.set('field', 'count()');
    params.set('field', 'avg(transaction.duration)');
    params.set('field', 'p50(transaction.duration)');
    params.set('field', 'p95(transaction.duration)');
    params.set('field', 'failure_rate()');
    params.set('statsPeriod', options?.statsPeriod || '24h');
    if (options?.project) params.set('project', options.project);
    if (options?.query) params.set('query', options.query);

    return this.request(`/organizations/${this.organization}/events/?${params}`);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.listProjects();
      return true;
    } catch {
      return false;
    }
  }
}

// Service layer
export class SentryService {
  private client: SentryClient;

  constructor() {
    this.client = new SentryClient({
      authToken: process.env.SENTRY_AUTH_TOKEN || '',
      organization: process.env.SENTRY_ORG || '',
    });
  }

  async getProjects() {
    return this.client.listProjects();
  }

  async getProject(projectSlug: string) {
    return this.client.getProject(projectSlug);
  }

  async getUnresolvedIssues(projectSlug?: string) {
    return this.client.listIssues({
      project: projectSlug,
      query: 'is:unresolved',
      statsPeriod: '14d',
      limit: 100,
    });
  }

  async getIssue(issueId: string) {
    return this.client.getIssue(issueId);
  }

  async resolveIssue(issueId: string) {
    return this.client.updateIssue(issueId, { status: 'resolved' });
  }

  async ignoreIssue(issueId: string) {
    return this.client.updateIssue(issueId, { status: 'ignored' });
  }

  async getIssueEvents(issueId: string, limit = 10) {
    return this.client.listEvents(issueId, { limit });
  }

  async getReleases(limit = 20) {
    return this.client.listReleases({ limit });
  }

  async getTeams() {
    return this.client.listTeams();
  }

  async getDashboardStats() {
    const [
      projects,
      allIssues,
      unresolvedIssues,
      releases,
      teams,
      stats24h,
      stats7d
    ] = await Promise.all([
      this.client.listProjects().catch(() => []),
      this.client.listIssues({ statsPeriod: '14d', limit: 100 }).catch(() => []),
      this.client.listIssues({ query: 'is:unresolved', statsPeriod: '14d', limit: 100 }).catch(() => []),
      this.client.listReleases({ limit: 20 }).catch(() => []),
      this.client.listTeams().catch(() => []),
      this.client.getOrganizationStats({ statsPeriod: '24h', interval: '1h' }).catch(() => null),
      this.client.getOrganizationStats({ statsPeriod: '7d', interval: '1d' }).catch(() => null),
    ]);

    // Issue severity breakdown
    const fatalIssues = unresolvedIssues.filter(i => i.level === 'fatal');
    const errorIssues = unresolvedIssues.filter(i => i.level === 'error');
    const warningIssues = unresolvedIssues.filter(i => i.level === 'warning');

    // Priority breakdown
    const highPriority = unresolvedIssues.filter(i => i.priority === 'high');
    const mediumPriority = unresolvedIssues.filter(i => i.priority === 'medium');

    // Issues by project
    const issuesByProject: Record<string, number> = {};
    unresolvedIssues.forEach(issue => {
      const projectName = issue.project?.name || 'Unknown';
      issuesByProject[projectName] = (issuesByProject[projectName] || 0) + 1;
    });

    // Most affected users
    const totalAffectedUsers = unresolvedIssues.reduce((sum, i) => sum + (i.userCount || 0), 0);
    const totalOccurrences = unresolvedIssues.reduce((sum, i) => sum + parseInt(i.count || '0', 10), 0);

    // New issues (first seen in last 24h)
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const newIssues24h = unresolvedIssues.filter(i => new Date(i.firstSeen) > last24h);
    const newIssues7d = unresolvedIssues.filter(i => new Date(i.firstSeen) > last7d);

    // Regression issues (resolved but reopened)
    const regressions = allIssues.filter(i => i.status === 'unresolved' && i.annotations?.includes('regression'));

    // Calculate error rates from stats
    let errors24h = 0;
    let errors7d = 0;
    if (stats24h?.groups?.[0]?.totals) {
      errors24h = Object.values(stats24h.groups[0].totals)[0] || 0;
    }
    if (stats7d?.groups?.[0]?.totals) {
      errors7d = Object.values(stats7d.groups[0].totals)[0] || 0;
    }

    // Recent releases
    const recentReleases = releases.slice(0, 5);
    const releasesWithIssues = releases.filter(r => r.newGroups > 0);

    return {
      // Project overview
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      
      // Issue counts
      totalIssues: allIssues.length,
      unresolvedIssues: unresolvedIssues.length,
      newIssues24h: newIssues24h.length,
      newIssues7d: newIssues7d.length,
      
      // Severity breakdown
      fatalIssues: fatalIssues.length,
      errorIssues: errorIssues.length,
      warningIssues: warningIssues.length,
      
      // Priority breakdown
      highPriorityIssues: highPriority.length,
      mediumPriorityIssues: mediumPriority.length,
      
      // Impact metrics
      totalAffectedUsers,
      totalOccurrences,
      
      // Error volume
      errors24h,
      errors7d,
      
      // By project
      issuesByProject,
      
      // Regressions
      regressions: regressions.length,
      
      // Teams
      totalTeams: teams.length,
      
      // Releases
      totalReleases: releases.length,
      recentReleases: recentReleases.map(r => ({
        version: r.shortVersion || r.version,
        date: r.dateCreated,
        newIssues: r.newGroups,
        authors: r.authors?.length || 0,
      })),
      releasesWithNewIssues: releasesWithIssues.length,
      
      // Top issues
      topIssues: unresolvedIssues
        .sort((a, b) => (b.userCount || 0) - (a.userCount || 0))
        .slice(0, 5)
        .map(i => ({
          id: i.id,
          shortId: i.shortId,
          title: i.title,
          level: i.level,
          userCount: i.userCount,
          count: i.count,
          project: i.project?.name,
        })),
    };
  }

  async healthCheck() {
    return this.client.healthCheck();
  }
}

export const sentryService = new SentryService();

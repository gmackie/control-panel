/**
 * Expo Platform API Client
 * Monitor React Native apps, builds, submissions, and EAS updates
 * API Docs: https://docs.expo.dev/eas/
 */

// Account types
export interface ExpoAccount {
  id: string;
  name: string;
  ownerUserActor: { username: string };
}

// Project types
export interface ExpoProject {
  id: string;
  slug: string;
  name: string;
  fullName: string;
  description?: string;
  scopeKey: string;
  ownerAccount: { id: string; name: string };
  githubRepository?: { url: string };
  icon?: { url: string };
  sdkVersion?: string;
  runtimeVersion?: string;
  platforms?: string[];
  privacySetting?: string;
  createdAt: string;
  updatedAt: string;
}

// Build types
export type ExpoBuildStatus =
  | 'new'
  | 'in_queue'
  | 'in_progress'
  | 'errored'
  | 'finished'
  | 'canceled';

export interface ExpoBuild {
  id: string;
  status: ExpoBuildStatus;
  platform: 'ios' | 'android';
  buildProfile?: string;
  channel?: string;
  runtimeVersion?: string;
  appVersion?: string;
  sdkVersion?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  expirationDate?: string;
  artifacts?: {
    buildUrl?: string;
    logsUrl?: string;
    applicationArchiveUrl?: string;
  };
  initiatingActor?: { username: string };
  error?: { message: string };
}

// Submission types
export type ExpoSubmissionStatus =
  | 'awaiting_build'
  | 'in_queue'
  | 'in_progress'
  | 'finished'
  | 'errored'
  | 'canceled';

export interface ExpoSubmission {
  id: string;
  status: ExpoSubmissionStatus;
  platform: 'ios' | 'android';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  turtleBuildId?: string;
  submittedBuildId?: string;
  error?: { message: string };
}

// Update types
export interface ExpoUpdate {
  id: string;
  group: string;
  runtimeVersion: string;
  platform: 'ios' | 'android' | 'web';
  message?: string;
  createdAt: string;
  actor?: { username: string };
  branch?: { name: string };
  gitCommitHash?: string;
}

// API Response wrappers - Expo API can return different formats
interface ExpoApiResponse<T> {
  data?: T;
}

interface ExpoListResponse<T> {
  data?: T[];
}

// Raw response types for handling various formats
type RawApiResponse = Record<string, unknown> | unknown[];

export class ExpoClient {
  private baseUrl = 'https://api.expo.dev';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Expo API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors?.[0]?.message) {
          errorMessage = errorJson.errors[0].message;
        }
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Helper to extract data from various response formats
  private extractData<T>(result: RawApiResponse): T[] {
    if (Array.isArray(result)) {
      return result as T[];
    }
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      if (Array.isArray(obj.data)) {
        return obj.data as T[];
      }
      // Some endpoints return the array directly under a key
      if (Array.isArray(obj.accounts)) return obj.accounts as T[];
      if (Array.isArray(obj.projects)) return obj.projects as T[];
      if (Array.isArray(obj.builds)) return obj.builds as T[];
      if (Array.isArray(obj.submissions)) return obj.submissions as T[];
      if (Array.isArray(obj.updates)) return obj.updates as T[];
    }
    return [];
  }

  // Accounts
  async getAccounts(): Promise<ExpoAccount[]> {
    try {
      const result = await this.request<RawApiResponse>('/v2/accounts');
      return this.extractData<ExpoAccount>(result);
    } catch (error) {
      console.error('Expo getAccounts error:', error);
      throw error;
    }
  }

  // Projects
  async getProjects(accountName: string): Promise<ExpoProject[]> {
    try {
      const result = await this.request<RawApiResponse>(
        `/v2/accounts/${accountName}/projects`
      );
      return this.extractData<ExpoProject>(result);
    } catch (error) {
      console.error('Expo getProjects error:', error);
      return [];
    }
  }

  async getProject(projectId: string): Promise<ExpoProject | null> {
    try {
      const result = await this.request<ExpoApiResponse<ExpoProject> | ExpoProject>(
        `/v2/projects/${projectId}`
      );
      if (result && typeof result === 'object') {
        if ('data' in result && result.data) return result.data as ExpoProject;
        if ('id' in result) return result as ExpoProject;
      }
      return null;
    } catch (error) {
      console.error('Expo getProject error:', error);
      return null;
    }
  }

  // Builds
  async getBuilds(
    projectId: string,
    options?: {
      limit?: number;
      offset?: number;
      platform?: 'ios' | 'android';
      status?: ExpoBuildStatus;
    }
  ): Promise<ExpoBuild[]> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.offset) params.set('offset', options.offset.toString());
      if (options?.platform) params.set('platform', options.platform);
      if (options?.status) params.set('status', options.status);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const result = await this.request<RawApiResponse>(
        `/v2/projects/${projectId}/builds${queryString}`
      );
      return this.extractData<ExpoBuild>(result);
    } catch (error) {
      console.error('Expo getBuilds error:', error);
      return [];
    }
  }

  // Submissions
  async getSubmissions(
    projectId: string,
    options?: {
      limit?: number;
      offset?: number;
      platform?: 'ios' | 'android';
    }
  ): Promise<ExpoSubmission[]> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.offset) params.set('offset', options.offset.toString());
      if (options?.platform) params.set('platform', options.platform);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const result = await this.request<RawApiResponse>(
        `/v2/projects/${projectId}/submissions${queryString}`
      );
      return this.extractData<ExpoSubmission>(result);
    } catch (error) {
      console.error('Expo getSubmissions error:', error);
      return [];
    }
  }

  // Updates (EAS Update)
  async getUpdates(
    projectId: string,
    options?: {
      limit?: number;
      offset?: number;
      branch?: string;
    }
  ): Promise<ExpoUpdate[]> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.offset) params.set('offset', options.offset.toString());
      if (options?.branch) params.set('branch', options.branch);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const result = await this.request<RawApiResponse>(
        `/v2/projects/${projectId}/updates${queryString}`
      );
      return this.extractData<ExpoUpdate>(result);
    } catch (error) {
      console.error('Expo getUpdates error:', error);
      return [];
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.getAccounts();
      return true;
    } catch {
      return false;
    }
  }
}

// Service layer for common operations
export class ExpoService {
  private client: ExpoClient;

  constructor(accessToken?: string) {
    this.client = new ExpoClient(accessToken || process.env.EXPO_ACCESS_TOKEN || '');
  }

  async getAccounts() {
    return this.client.getAccounts();
  }

  async getProjects(accountName: string) {
    return this.client.getProjects(accountName);
  }

  async getBuilds(projectId: string, limit?: number) {
    return this.client.getBuilds(projectId, { limit });
  }

  async getSubmissions(projectId: string) {
    return this.client.getSubmissions(projectId);
  }

  async getUpdates(projectId: string) {
    return this.client.getUpdates(projectId);
  }

  async getDashboardStats() {
    const accounts = await this.client.getAccounts();

    let totalProjects = 0;
    let totalBuilds = 0;
    let totalSubmissions = 0;
    let totalUpdates = 0;
    const allPlatforms = new Set<string>();
    const buildStatuses: Record<string, number> = {};

    const accountDetails = await Promise.all(
      accounts.map(async (account) => {
        const projects = await this.client.getProjects(account.name).catch(() => []);

        const projectDetails = await Promise.all(
          projects.slice(0, 10).map(async (project) => {
            const [builds, submissions, updates] = await Promise.all([
              this.client.getBuilds(project.id, { limit: 20 }).catch(() => []),
              this.client.getSubmissions(project.id, { limit: 10 }).catch(() => []),
              this.client.getUpdates(project.id, { limit: 10 }).catch(() => []),
            ]);

            // Collect platforms
            project.platforms?.forEach((p) => allPlatforms.add(p));
            builds.forEach((b) => allPlatforms.add(b.platform));

            // Count build statuses
            builds.forEach((b) => {
              buildStatuses[b.status] = (buildStatuses[b.status] || 0) + 1;
            });

            totalBuilds += builds.length;
            totalSubmissions += submissions.length;
            totalUpdates += updates.length;

            return {
              id: project.id,
              slug: project.slug,
              name: project.name,
              fullName: project.fullName,
              description: project.description,
              platforms: project.platforms,
              sdkVersion: project.sdkVersion,
              runtimeVersion: project.runtimeVersion,
              githubUrl: project.githubRepository?.url,
              iconUrl: project.icon?.url,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
              builds: builds.map((b) => ({
                id: b.id,
                status: b.status,
                platform: b.platform,
                buildProfile: b.buildProfile,
                channel: b.channel,
                appVersion: b.appVersion,
                createdAt: b.createdAt,
                completedAt: b.completedAt,
                initiatedBy: b.initiatingActor?.username,
                error: b.error?.message,
                artifacts: b.artifacts,
              })),
              submissions: submissions.map((s) => ({
                id: s.id,
                status: s.status,
                platform: s.platform,
                createdAt: s.createdAt,
                completedAt: s.completedAt,
                error: s.error?.message,
              })),
              updates: updates.map((u) => ({
                id: u.id,
                group: u.group,
                platform: u.platform,
                message: u.message,
                branch: u.branch?.name,
                runtimeVersion: u.runtimeVersion,
                createdAt: u.createdAt,
                actor: u.actor?.username,
                gitCommitHash: u.gitCommitHash,
              })),
            };
          })
        );

        totalProjects += projects.length;

        return {
          id: account.id,
          name: account.name,
          owner: account.ownerUserActor?.username,
          projectCount: projects.length,
          projects: projectDetails,
        };
      })
    );

    return {
      // Account counts
      totalAccounts: accounts.length,

      // Resource counts
      totalProjects,
      totalBuilds,
      totalSubmissions,
      totalUpdates,

      // Platforms in use
      platforms: Array.from(allPlatforms),

      // Build status breakdown
      buildStatuses,

      // Account breakdown
      accounts: accountDetails,
    };
  }

  async healthCheck() {
    return this.client.healthCheck();
  }
}

export const expoService = new ExpoService();

/**
 * GitHub API Client
 * Used to detect repos cross-published between Gitea and GitHub
 */

export interface GitHubConfig {
  token?: string;
  username?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  created_at: string;
  updated_at: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

export interface CrossPublishedRepo {
  name: string;
  gitea: {
    url: string;
    fullName: string;
    lastPush?: string;
  };
  github: {
    url: string;
    fullName: string;
    lastPush?: string;
    stars: number;
    forks: number;
  };
  inSync: boolean; // True if last push times are close
  syncStatus: 'synced' | 'gitea-ahead' | 'github-ahead' | 'unknown';
}

export class GitHubClient {
  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';
  private repoCache: Map<string, GitHubRepo[]> = new Map();
  private cacheExpiry: number = 0;
  private cacheTTL: number = 300000; // 5 minutes

  constructor(config?: Partial<GitHubConfig>) {
    this.config = {
      token: config?.token || process.env.GITHUB_TOKEN,
      username: config?.username || process.env.GITHUB_USERNAME || 'gmackie',
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GMAC-Control-Panel',
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });

    if (!response.ok) {
      if (response.status === 403) {
        // Rate limited
        const resetTime = response.headers.get('X-RateLimit-Reset');
        throw new Error(`GitHub API rate limited. Resets at ${resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : 'unknown'}`);
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get authenticated user info
   */
  async getCurrentUser(): Promise<GitHubUser | null> {
    if (!this.config.token) return null;
    
    try {
      return await this.request<GitHubUser>('/user');
    } catch {
      return null;
    }
  }

  /**
   * Get repositories for a user
   */
  async getUserRepos(username?: string): Promise<GitHubRepo[]> {
    const user = username || this.config.username;
    if (!user) return [];

    // Check cache
    const cacheKey = `user:${user}`;
    if (Date.now() < this.cacheExpiry && this.repoCache.has(cacheKey)) {
      return this.repoCache.get(cacheKey)!;
    }

    try {
      const repos = await this.request<GitHubRepo[]>(`/users/${user}/repos?per_page=100&sort=updated`);
      
      // Update cache
      this.repoCache.set(cacheKey, repos);
      this.cacheExpiry = Date.now() + this.cacheTTL;
      
      return repos;
    } catch (error) {
      console.error('Error fetching GitHub repos:', error);
      return [];
    }
  }

  /**
   * Get a specific repository
   */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
    try {
      return await this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
    } catch {
      return null;
    }
  }

  /**
   * Find cross-published repos between Gitea and GitHub
   */
  async findCrossPublishedRepos(giteaRepos: Array<{
    name: string;
    full_name: string;
    html_url: string;
    updated_at?: string;
  }>): Promise<CrossPublishedRepo[]> {
    const githubRepos = await this.getUserRepos();
    const crossPublished: CrossPublishedRepo[] = [];

    for (const giteaRepo of giteaRepos) {
      // Try to find matching GitHub repo by name
      const githubRepo = githubRepos.find(gr => 
        gr.name.toLowerCase() === giteaRepo.name.toLowerCase()
      );

      if (githubRepo) {
        // Determine sync status
        let syncStatus: CrossPublishedRepo['syncStatus'] = 'unknown';
        let inSync = false;

        if (giteaRepo.updated_at && githubRepo.pushed_at) {
          const giteaTime = new Date(giteaRepo.updated_at).getTime();
          const githubTime = new Date(githubRepo.pushed_at).getTime();
          const diff = Math.abs(giteaTime - githubTime);
          
          // Consider synced if within 1 hour
          if (diff < 3600000) {
            syncStatus = 'synced';
            inSync = true;
          } else if (giteaTime > githubTime) {
            syncStatus = 'gitea-ahead';
          } else {
            syncStatus = 'github-ahead';
          }
        }

        crossPublished.push({
          name: giteaRepo.name,
          gitea: {
            url: giteaRepo.html_url,
            fullName: giteaRepo.full_name,
            lastPush: giteaRepo.updated_at,
          },
          github: {
            url: githubRepo.html_url,
            fullName: githubRepo.full_name,
            lastPush: githubRepo.pushed_at,
            stars: githubRepo.stargazers_count,
            forks: githubRepo.forks_count,
          },
          inSync,
          syncStatus,
        });
      }
    }

    return crossPublished;
  }

  /**
   * Check if a specific repo exists on GitHub
   */
  async repoExistsOnGitHub(repoName: string, owner?: string): Promise<boolean> {
    const user = owner || this.config.username;
    if (!user) return false;

    try {
      await this.request(`/repos/${user}/${repoName}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/rate_limit`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GMAC-Control-Panel',
          ...(this.config.token ? { 'Authorization': `Bearer ${this.config.token}` } : {}),
        },
      });

      const data = await response.json();
      return {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: new Date(data.rate.reset * 1000),
      };
    } catch {
      return { limit: 0, remaining: 0, reset: new Date() };
    }
  }
}

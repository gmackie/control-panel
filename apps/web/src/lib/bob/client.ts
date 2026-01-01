export interface BobRepository {
  id: string;
  path: string;
  name: string;
  remote?: string;
  mainBranch: string;
}

export interface BobWorktree {
  id: string;
  repositoryId: string;
  branch: string;
  path: string;
  instances?: BobInstance[];
}

export interface BobInstance {
  id: string;
  worktreeId: string;
  agentType: "claude" | "kiro" | "codex" | "opencode" | "cursor" | "gemini";
  status: "starting" | "running" | "stopped" | "error";
  pid?: number;
}

export interface BobAnalysis {
  id: string;
  summary: string;
  timestamp: string;
}

export interface BobComment {
  id: string;
  file: string;
  line: number;
  type: "suggestion" | "warning" | "error" | "user";
  message: string;
  severity: "low" | "medium" | "high";
  isAI: boolean;
  userReply?: string;
}

export interface BobAnalysisResult {
  analysis: BobAnalysis | null;
  comments: BobComment[];
}

export interface BobDiffAnalysis {
  analysis: {
    comments: Array<{
      file: string;
      line: number;
      type: string;
      message: string;
      severity: string;
    }>;
    summary: string;
    analysisId: string;
  };
  diffAnalyzed: boolean;
}

export interface BobApplyFixResult {
  success: boolean;
  message: string;
  fixesApplied: number;
  filesModified?: number;
  modifiedFiles?: string[];
}

export interface BobCommitResult {
  message: string;
  commitMessage: string;
}

export interface BobPRResult {
  message: string;
  branch: string;
  title: string;
  description?: string;
  pr?: string;
}

export interface StartSessionOptions {
  repositoryUrl: string;
  branch?: string;
  issueContext: {
    source: "sentry" | "posthog" | "manual";
    id: string;
    title: string;
    description?: string;
    stackTrace?: string;
  };
  agentType?: BobInstance["agentType"];
}

export interface SessionStatus {
  worktreeId: string;
  instanceId?: string;
  phase: "cloning" | "analyzing" | "fixing" | "testing" | "review" | "complete" | "error";
  progress: number;
  analysis?: BobAnalysisResult;
  error?: string;
}

export class BobClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: { baseUrl: string; apiKey?: string }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bob API error: ${response.status} - ${error}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }
    return response.text() as unknown as T;
  }

  async listRepositories(): Promise<BobRepository[]> {
    return this.request<BobRepository[]>("/api/repositories");
  }

  async addRepository(repositoryPath: string): Promise<BobRepository> {
    return this.request<BobRepository>("/api/repositories/add", {
      method: "POST",
      body: JSON.stringify({ repositoryPath }),
    });
  }

  async cloneFromGitHub(repoFullName: string, branch?: string): Promise<{ repository: BobRepository; clonePath: string }> {
    return this.request("/api/git/github/clone", {
      method: "POST",
      body: JSON.stringify({ repoFullName, branch }),
    });
  }

  async getRepository(repoId: string): Promise<BobRepository> {
    return this.request<BobRepository>(`/api/repositories/${repoId}`);
  }

  async getWorktrees(repoId: string): Promise<BobWorktree[]> {
    return this.request<BobWorktree[]>(`/api/repositories/${repoId}/worktrees`);
  }

  async createWorktree(repoId: string, branchName: string, baseBranch?: string, agentType?: string): Promise<BobWorktree> {
    return this.request<BobWorktree>(`/api/repositories/${repoId}/worktrees`, {
      method: "POST",
      body: JSON.stringify({ branchName, baseBranch, agentType }),
    });
  }

  async deleteWorktree(worktreeId: string, force = false): Promise<void> {
    await this.request(`/api/repositories/worktrees/${worktreeId}?force=${force}`, {
      method: "DELETE",
    });
  }

  async listInstances(): Promise<BobInstance[]> {
    return this.request<BobInstance[]>("/api/instances");
  }

  async startInstance(worktreeId: string, agentType: BobInstance["agentType"] = "claude"): Promise<BobInstance> {
    return this.request<BobInstance>("/api/instances", {
      method: "POST",
      body: JSON.stringify({ worktreeId, agentType }),
    });
  }

  async getInstance(instanceId: string): Promise<BobInstance> {
    return this.request<BobInstance>(`/api/instances/${instanceId}`);
  }

  async deleteInstance(instanceId: string): Promise<void> {
    await this.request(`/api/instances/${instanceId}`, {
      method: "DELETE",
    });
  }

  async restartInstance(instanceId: string): Promise<BobInstance> {
    return this.request<BobInstance>(`/api/instances/${instanceId}/restart`, {
      method: "POST",
    });
  }

  async getInstancesByRepository(repositoryId: string): Promise<BobInstance[]> {
    return this.request<BobInstance[]>(`/api/instances/repository/${repositoryId}`);
  }

  async getDiff(worktreeId: string): Promise<string> {
    return this.request<string>(`/api/git/${worktreeId}/diff`);
  }

  async analyzeDiff(worktreeId: string): Promise<BobDiffAnalysis> {
    return this.request<BobDiffAnalysis>(`/api/git/${worktreeId}/analyze-diff`, {
      method: "POST",
    });
  }

  async getAnalysis(worktreeId: string): Promise<BobAnalysisResult> {
    return this.request<BobAnalysisResult>(`/api/git/${worktreeId}/analysis`);
  }

  async applyFixes(worktreeId: string): Promise<BobApplyFixResult> {
    return this.request<BobApplyFixResult>(`/api/git/${worktreeId}/apply-fixes`, {
      method: "POST",
    });
  }

  async generateCommitMessage(worktreeId: string, comments?: BobComment[]): Promise<{
    commitMessage: string;
    commitSubject: string;
    commitBody: string;
    changedFiles: string[];
    fileCount: number;
  }> {
    return this.request(`/api/git/${worktreeId}/generate-commit-message`, {
      method: "POST",
      body: JSON.stringify({ comments }),
    });
  }

  async commit(worktreeId: string, message: string): Promise<BobCommitResult> {
    return this.request<BobCommitResult>(`/api/git/${worktreeId}/commit`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  async createPR(worktreeId: string): Promise<BobPRResult> {
    return this.request<BobPRResult>(`/api/git/${worktreeId}/create-pr`, {
      method: "POST",
    });
  }

  async revertChanges(worktreeId: string): Promise<{ message: string }> {
    return this.request(`/api/git/${worktreeId}/revert`, {
      method: "POST",
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.listRepositories();
      return true;
    } catch {
      return false;
    }
  }
}

export class BobService {
  private client: BobClient;

  constructor() {
    this.client = new BobClient({
      baseUrl: process.env.BOB_API_URL || "http://localhost:43829",
      apiKey: process.env.BOB_API_KEY,
    });
  }

  async startFixSession(options: StartSessionOptions): Promise<SessionStatus> {
    const repoName = options.repositoryUrl.split("/").pop()?.replace(".git", "") || "repo";
    const repoFullName = this.extractGitHubRepo(options.repositoryUrl);

    let repository: BobRepository;
    
    if (repoFullName) {
      const result = await this.client.cloneFromGitHub(repoFullName, options.branch);
      repository = result.repository;
    } else {
      const repos = await this.client.listRepositories();
      const existing = repos.find(r => 
        r.remote === options.repositoryUrl || 
        r.name === repoName
      );
      
      if (existing) {
        repository = existing;
      } else {
        throw new Error(`Repository not found. Please add it to Bob first: ${options.repositoryUrl}`);
      }
    }

    const branchName = `ai-fix/${options.issueContext.source}-${options.issueContext.id}`;
    const worktree = await this.client.createWorktree(
      repository.id, 
      branchName, 
      options.branch || repository.mainBranch,
      options.agentType || "claude"
    );

    const instance = await this.client.startInstance(
      worktree.id,
      options.agentType || "claude"
    );

    return {
      worktreeId: worktree.id,
      instanceId: instance.id,
      phase: "cloning",
      progress: 10,
    };
  }

  private extractGitHubRepo(url: string): string | null {
    const patterns = [
      /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/,
      /^([^/]+\/[^/]+)$/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async getSessionStatus(worktreeId: string): Promise<SessionStatus> {
    try {
      const analysis = await this.client.getAnalysis(worktreeId);
      
      if (analysis.analysis && analysis.comments.length > 0) {
        return {
          worktreeId,
          phase: "review",
          progress: 80,
          analysis,
        };
      }

      return {
        worktreeId,
        phase: "analyzing",
        progress: 50,
      };
    } catch {
      return {
        worktreeId,
        phase: "analyzing",
        progress: 30,
      };
    }
  }

  async runAnalysis(worktreeId: string): Promise<BobDiffAnalysis> {
    return this.client.analyzeDiff(worktreeId);
  }

  async applyFixesAndCommit(worktreeId: string, commitMessage?: string): Promise<BobCommitResult> {
    await this.client.applyFixes(worktreeId);
    
    if (!commitMessage) {
      const generated = await this.client.generateCommitMessage(worktreeId);
      commitMessage = generated.commitMessage;
    }
    
    return this.client.commit(worktreeId, commitMessage);
  }

  async createPR(worktreeId: string): Promise<BobPRResult> {
    return this.client.createPR(worktreeId);
  }

  async approveAndCreatePR(worktreeId: string, commitMessage?: string): Promise<BobPRResult> {
    await this.applyFixesAndCommit(worktreeId, commitMessage);
    return this.createPR(worktreeId);
  }

  async cancelSession(worktreeId: string): Promise<void> {
    const instances = await this.client.listInstances();
    const instance = instances.find(i => i.worktreeId === worktreeId);
    
    if (instance) {
      await this.client.deleteInstance(instance.id);
    }
    
    await this.client.deleteWorktree(worktreeId, true);
  }

  async healthCheck(): Promise<boolean> {
    return this.client.healthCheck();
  }
}

export const bobService = new BobService();

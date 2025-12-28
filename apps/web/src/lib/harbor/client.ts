export interface HarborProject {
  project_id: number;
  owner_id: number;
  name: string;
  creation_time: string;
  update_time: string;
  deleted: boolean;
  owner_name: string;
  togglable: boolean;
  current_user_role_id: number;
  current_user_role_ids: number[];
  repo_count: number;
  metadata: {
    public: string;
    enable_content_trust?: string;
    enable_content_trust_cosign?: string;
    prevent_vul?: string;
    severity?: string;
    auto_scan?: string;
    reuse_sys_cve_allowlist?: string;
    retention_id?: string;
  };
  cve_allowlist: {
    id: number;
    project_id: number;
    items: any[];
    creation_time: string;
    update_time: string;
  };
}

export interface HarborRepository {
  id: number;
  project_id: number;
  name: string;
  description: string;
  artifact_count: number;
  pull_count: number;
  creation_time: string;
  update_time: string;
}

export interface HarborArtifact {
  id: number;
  type: string;
  media_type: string;
  manifest_media_type: string;
  project_id: number;
  repository_id: number;
  repository_name: string;
  digest: string;
  size: number;
  push_time: string;
  pull_time: string;
  extra_attrs: any;
  annotations: any;
  references: any[];
  tags: HarborTag[];
  labels: any[];
  scan_overview?: {
    [key: string]: {
      report_id: string;
      scan_status: string;
      severity: string;
      duration: number;
      summary: {
        total: number;
        fixable: number;
        summary: {
          Critical?: number;
          High?: number;
          Medium?: number;
          Low?: number;
          Negligible?: number;
          Unknown?: number;
        };
      };
      start_time: string;
      end_time: string;
      scanner: {
        name: string;
        vendor: string;
        version: string;
      };
      complete_percent: number;
    };
  };
}

export interface HarborTag {
  id: number;
  repository_id: number;
  artifact_id: number;
  name: string;
  push_time: string;
  pull_time: string;
  immutable: boolean;
  signed: boolean;
}

export interface HarborScanReport {
  report_id: string;
  scan_status: string;
  severity: string;
  duration: number;
  summary: {
    total: number;
    fixable: number;
    summary: {
      Critical: number;
      High: number;
      Medium: number;
      Low: number;
      Negligible: number;
      Unknown: number;
    };
  };
  vulnerabilities: HarborVulnerability[];
  scanner: {
    name: string;
    vendor: string;
    version: string;
  };
  complete_percent: number;
  start_time: string;
  end_time: string;
}

export interface HarborVulnerability {
  id: string;
  package: string;
  version: string;
  fix_version?: string;
  severity: string;
  description: string;
  links: string[];
  artifact_digests: string[];
  preferred_cvss?: {
    score_v3?: number;
    score_v2?: number;
    vector_v3?: string;
    vector_v2?: string;
  };
  cwe_ids: string[];
  vendor_attributes?: any;
}

export interface HarborUser {
  user_id: number;
  username: string;
  email: string;
  password: string;
  realname: string;
  comment: string;
  deleted: boolean;
  role_name: string;
  role_id: number;
  sysadmin_flag: boolean;
  admin_role_in_auth: boolean;
  reset_uuid: string;
  creation_time: string;
  update_time: string;
}

export interface HarborQuota {
  id: number;
  ref: {
    id: number;
    name: string;
    owner_name: string;
  };
  hard: {
    storage: number;
  };
  used: {
    storage: number;
  };
  creation_time: string;
  update_time: string;
}

export interface HarborReplicationPolicy {
  id: number;
  name: string;
  description: string;
  src_registry?: {
    id: number;
    name: string;
  };
  dest_registry?: {
    id: number;
    name: string;
  };
  dest_namespace: string;
  dest_namespace_replace_count: number;
  trigger: {
    type: string;
    trigger_settings?: {
      cron?: string;
    };
  };
  enabled: boolean;
  deletion: boolean;
  override: boolean;
  speed: number;
  filters: Array<{
    type: string;
    value: any;
  }>;
  creation_time: string;
  update_time: string;
}

export interface HarborClientConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export class HarborClient {
  private baseUrl: string;
  private auth: string;
  private headers: Record<string, string>;

  constructor(config: HarborClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    this.headers = {
      'Authorization': `Basic ${this.auth}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v2.0${path}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Harbor API error: ${response.status} - ${error}`);
    }

    // Handle empty responses
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0' || response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Project methods
  async listProjects(options?: {
    page?: number;
    pageSize?: number;
    name?: string;
    public?: boolean;
    owner?: string;
    sort?: string;
  }): Promise<HarborProject[]> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.pageSize) params.append('page_size', options.pageSize.toString());
    if (options?.name) params.append('name', options.name);
    if (options?.public !== undefined) params.append('public', options.public.toString());
    if (options?.owner) params.append('owner', options.owner);
    if (options?.sort) params.append('sort', options.sort);

    return this.request<HarborProject[]>(`/projects?${params}`);
  }

  async getProject(projectNameOrId: string | number): Promise<HarborProject> {
    return this.request<HarborProject>(`/projects/${projectNameOrId}`);
  }

  async createProject(project: {
    project_name: string;
    metadata?: {
      public?: string;
      enable_content_trust?: string;
      enable_content_trust_cosign?: string;
      prevent_vul?: string;
      severity?: string;
      auto_scan?: string;
    };
    storage_limit?: number;
    registry_id?: number;
  }): Promise<void> {
    await this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  // Repository methods
  async listRepositories(
    projectName: string,
    options?: {
      page?: number;
      pageSize?: number;
      query?: string;
      sort?: string;
    }
  ): Promise<HarborRepository[]> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.pageSize) params.append('page_size', options.pageSize.toString());
    if (options?.query) params.append('q', options.query);
    if (options?.sort) params.append('sort', options.sort);

    return this.request<HarborRepository[]>(`/projects/${projectName}/repositories?${params}`);
  }

  async getRepository(
    projectName: string,
    repositoryName: string
  ): Promise<HarborRepository> {
    return this.request<HarborRepository>(
      `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}`
    );
  }

  async deleteRepository(
    projectName: string,
    repositoryName: string
  ): Promise<void> {
    await this.request(
      `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}`,
      { method: 'DELETE' }
    );
  }

  // Artifact methods
  async listArtifacts(
    projectName: string,
    repositoryName: string,
    options?: {
      page?: number;
      pageSize?: number;
      query?: string;
      sort?: string;
      withTag?: boolean;
      withLabel?: boolean;
      withScanOverview?: boolean;
      withSignature?: boolean;
      withImmutableStatus?: boolean;
    }
  ): Promise<HarborArtifact[]> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.pageSize) params.append('page_size', options.pageSize.toString());
    if (options?.query) params.append('q', options.query);
    if (options?.sort) params.append('sort', options.sort);
    if (options?.withTag) params.append('with_tag', 'true');
    if (options?.withLabel) params.append('with_label', 'true');
    if (options?.withScanOverview) params.append('with_scan_overview', 'true');
    if (options?.withSignature) params.append('with_signature', 'true');
    if (options?.withImmutableStatus) params.append('with_immutable_status', 'true');

    return this.request<HarborArtifact[]>(
      `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts?${params}`
    );
  }

  async getArtifact(
    projectName: string,
    repositoryName: string,
    reference: string, // Can be digest or tag
    options?: {
      withTag?: boolean;
      withLabel?: boolean;
      withScanOverview?: boolean;
      withSignature?: boolean;
      withImmutableStatus?: boolean;
    }
  ): Promise<HarborArtifact> {
    const params = new URLSearchParams();
    if (options?.withTag) params.append('with_tag', 'true');
    if (options?.withLabel) params.append('with_label', 'true');
    if (options?.withScanOverview) params.append('with_scan_overview', 'true');
    if (options?.withSignature) params.append('with_signature', 'true');
    if (options?.withImmutableStatus) params.append('with_immutable_status', 'true');

    return this.request<HarborArtifact>(
      `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}?${params}`
    );
  }

  async scanArtifact(
    projectName: string,
    repositoryName: string,
    reference: string
  ): Promise<void> {
    await this.request(
      `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}/scan`,
      { method: 'POST' }
    );
  }

  async getScanReport(
    projectName: string,
    repositoryName: string,
    reference: string,
    reportId: string,
    mimeType: string = 'application/vnd.security.vulnerability.report; version=1.1'
  ): Promise<HarborScanReport> {
    return this.request<HarborScanReport>(
      `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}/reports/${reportId}`,
      {
        headers: {
          'Accept': mimeType,
        },
      }
    );
  }

  // Tag methods
  async createTag(
    projectName: string,
    repositoryName: string,
    reference: string,
    tag: { name: string }
  ): Promise<void> {
    await this.request(
      `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}/tags`,
      {
        method: 'POST',
        body: JSON.stringify(tag),
      }
    );
  }

  async deleteTag(
    projectName: string,
    repositoryName: string,
    reference: string,
    tagName: string
  ): Promise<void> {
    await this.request(
      `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}/tags/${tagName}`,
      { method: 'DELETE' }
    );
  }

  // User methods
  async listUsers(options?: {
    page?: number;
    pageSize?: number;
    username?: string;
    email?: string;
    sort?: string;
  }): Promise<HarborUser[]> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.pageSize) params.append('page_size', options.pageSize.toString());
    if (options?.username) params.append('username', options.username);
    if (options?.email) params.append('email', options.email);
    if (options?.sort) params.append('sort', options.sort);

    return this.request<HarborUser[]>(`/users?${params}`);
  }

  async getCurrentUser(): Promise<HarborUser> {
    return this.request<HarborUser>('/users/current');
  }

  // Quota methods
  async getProjectQuota(projectId: number): Promise<HarborQuota> {
    const quotas = await this.request<HarborQuota[]>(`/quotas?reference=project&reference_id=${projectId}`);
    return quotas[0];
  }

  // Replication methods
  async listReplicationPolicies(options?: {
    page?: number;
    pageSize?: number;
    name?: string;
    sort?: string;
  }): Promise<HarborReplicationPolicy[]> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.pageSize) params.append('page_size', options.pageSize.toString());
    if (options?.name) params.append('name', options.name);
    if (options?.sort) params.append('sort', options.sort);

    return this.request<HarborReplicationPolicy[]>(`/replication/policies?${params}`);
  }

  async triggerReplication(policyId: number): Promise<void> {
    await this.request('/replication/executions', {
      method: 'POST',
      body: JSON.stringify({ policy_id: policyId }),
    });
  }

  // System info
  async getSystemInfo(): Promise<any> {
    return this.request('/systeminfo');
  }

  async getHealth(): Promise<{ status: string }> {
    return this.request('/health');
  }

  // Statistics
  async getStatistics(): Promise<{
    private_project_count: number;
    private_repo_count: number;
    public_project_count: number;
    public_repo_count: number;
    total_project_count: number;
    total_repo_count: number;
    total_storage_consumption: number;
  }> {
    return this.request('/statistics');
  }

  // Search
  async search(query: string): Promise<{
    project: any[];
    repository: any[];
    chart?: any[];
  }> {
    return this.request(`/search?q=${encodeURIComponent(query)}`);
  }
}
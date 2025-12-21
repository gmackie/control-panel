/**
 * Clerk API Client
 * Monitor users, sessions, and authentication metrics
 */

export interface ClerkUser {
  id: string;
  object: 'user';
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  has_image: boolean;
  primary_email_address_id: string | null;
  primary_phone_number_id: string | null;
  primary_web3_wallet_id: string | null;
  password_enabled: boolean;
  two_factor_enabled: boolean;
  totp_enabled: boolean;
  backup_code_enabled: boolean;
  email_addresses: Array<{
    id: string;
    object: 'email_address';
    email_address: string;
    verification: { status: string; strategy: string } | null;
    linked_to: Array<{ id: string; type: string }>;
  }>;
  phone_numbers: Array<{
    id: string;
    object: 'phone_number';
    phone_number: string;
    verification: { status: string; strategy: string } | null;
  }>;
  external_accounts: Array<{
    id: string;
    object: 'external_account';
    provider: string;
    identification_id: string;
    provider_user_id: string;
    email_address: string;
    first_name: string | null;
    last_name: string | null;
  }>;
  public_metadata: Record<string, any>;
  private_metadata: Record<string, any>;
  unsafe_metadata: Record<string, any>;
  created_at: number;
  updated_at: number;
  last_sign_in_at: number | null;
  banned: boolean;
  locked: boolean;
}

export interface ClerkSession {
  id: string;
  object: 'session';
  client_id: string;
  user_id: string;
  status: 'active' | 'ended' | 'expired' | 'removed' | 'replaced' | 'abandoned';
  last_active_at: number;
  expire_at: number;
  abandon_at: number;
  created_at: number;
  updated_at: number;
}

export interface ClerkOrganization {
  id: string;
  object: 'organization';
  name: string;
  slug: string;
  image_url: string;
  has_image: boolean;
  members_count: number;
  max_allowed_memberships: number;
  admin_delete_enabled: boolean;
  public_metadata: Record<string, any>;
  private_metadata: Record<string, any>;
  created_at: number;
  updated_at: number;
}

export interface ClerkInstance {
  id: string;
  environment_type: 'production' | 'development';
  allowed_origins: string[];
  home_url: string;
  sign_in_url: string;
  sign_up_url: string;
  user_profile_url: string;
}

export class ClerkClient {
  private baseUrl = 'https://api.clerk.com/v1';
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Clerk API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Users
  async listUsers(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    query?: string;
  }): Promise<ClerkUser[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.orderBy) params.set('order_by', options.orderBy);
    if (options?.query) params.set('query', options.query);

    return this.request<ClerkUser[]>(`/users?${params}`);
  }

  async getUser(userId: string): Promise<ClerkUser> {
    return this.request<ClerkUser>(`/users/${userId}`);
  }

  async getUserCount(): Promise<{ object: 'total_count'; total_count: number }> {
    return this.request('/users/count');
  }

  async banUser(userId: string): Promise<ClerkUser> {
    return this.request<ClerkUser>(`/users/${userId}/ban`, { method: 'POST' });
  }

  async unbanUser(userId: string): Promise<ClerkUser> {
    return this.request<ClerkUser>(`/users/${userId}/unban`, { method: 'POST' });
  }

  async deleteUser(userId: string): Promise<{ id: string; object: 'user'; deleted: boolean }> {
    return this.request(`/users/${userId}`, { method: 'DELETE' });
  }

  // Sessions
  async listSessions(options?: {
    userId?: string;
    clientId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ClerkSession[]> {
    const params = new URLSearchParams();
    if (options?.userId) params.set('user_id', options.userId);
    if (options?.clientId) params.set('client_id', options.clientId);
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    return this.request<ClerkSession[]>(`/sessions?${params}`);
  }

  async getSession(sessionId: string): Promise<ClerkSession> {
    return this.request<ClerkSession>(`/sessions/${sessionId}`);
  }

  async revokeSession(sessionId: string): Promise<ClerkSession> {
    return this.request<ClerkSession>(`/sessions/${sessionId}/revoke`, { method: 'POST' });
  }

  // Organizations
  async listOrganizations(options?: {
    limit?: number;
    offset?: number;
    includeMembersCount?: boolean;
  }): Promise<ClerkOrganization[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.includeMembersCount) params.set('include_members_count', 'true');

    return this.request<ClerkOrganization[]>(`/organizations?${params}`);
  }

  async getOrganization(orgId: string): Promise<ClerkOrganization> {
    return this.request<ClerkOrganization>(`/organizations/${orgId}`);
  }

  // Clients (active sessions/devices)
  async listClients(): Promise<Array<{ id: string; sessions: ClerkSession[] }>> {
    return this.request('/clients');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.getUserCount();
      return true;
    } catch {
      return false;
    }
  }
}

// Service layer
export class ClerkService {
  private client: ClerkClient;

  constructor() {
    this.client = new ClerkClient(
      process.env.CLERK_SECRET_KEY || ''
    );
  }

  async getUsers(options?: { limit?: number; query?: string }) {
    return this.client.listUsers(options);
  }

  async getUser(userId: string) {
    return this.client.getUser(userId);
  }

  async getUserCount() {
    const result = await this.client.getUserCount();
    return result.total_count;
  }

  async getActiveSessions() {
    return this.client.listSessions({ status: 'active', limit: 100 });
  }

  async getOrganizations() {
    return this.client.listOrganizations({ includeMembersCount: true });
  }

  async getDashboardStats() {
    const [userCountResult, users, sessions, orgs] = await Promise.all([
      this.client.getUserCount(),
      this.client.listUsers({ limit: 100, orderBy: '-created_at' }),
      this.client.listSessions({ status: 'active', limit: 100 }),
      this.client.listOrganizations({ includeMembersCount: true }).catch(() => []),
    ]);

    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7d = now - 7 * 24 * 60 * 60 * 1000;
    const last30d = now - 30 * 24 * 60 * 60 * 1000;

    // Calculate user metrics
    const newUsersLast24h = users.filter(u => u.created_at > last24h).length;
    const newUsersLast7d = users.filter(u => u.created_at > last7d).length;
    const newUsersLast30d = users.filter(u => u.created_at > last30d).length;

    // Calculate active users (signed in within timeframe)
    const activeUsersLast24h = users.filter(u => u.last_sign_in_at && u.last_sign_in_at > last24h).length;
    const activeUsersLast7d = users.filter(u => u.last_sign_in_at && u.last_sign_in_at > last7d).length;

    // Auth method breakdown
    const passwordUsers = users.filter(u => u.password_enabled).length;
    const socialUsers = users.filter(u => u.external_accounts.length > 0).length;
    const mfaUsers = users.filter(u => u.two_factor_enabled).length;

    // Provider breakdown
    const providerCounts: Record<string, number> = {};
    users.forEach(user => {
      user.external_accounts.forEach(account => {
        providerCounts[account.provider] = (providerCounts[account.provider] || 0) + 1;
      });
    });

    return {
      totalUsers: userCountResult.total_count,
      activeSessions: sessions.length,
      organizations: orgs.length,
      newUsersLast24h,
      newUsersLast7d,
      newUsersLast30d,
      activeUsersLast24h,
      activeUsersLast7d,
      passwordUsers,
      socialUsers,
      mfaUsers,
      mfaAdoptionRate: userCountResult.total_count > 0 
        ? ((mfaUsers / userCountResult.total_count) * 100).toFixed(1)
        : 0,
      providerBreakdown: providerCounts,
    };
  }

  async banUser(userId: string) {
    return this.client.banUser(userId);
  }

  async unbanUser(userId: string) {
    return this.client.unbanUser(userId);
  }

  async revokeSession(sessionId: string) {
    return this.client.revokeSession(sessionId);
  }

  async healthCheck() {
    return this.client.healthCheck();
  }
}

export const clerkService = new ClerkService();

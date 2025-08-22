import { HetznerServer, ServerType, Location } from '@/types/cluster';

const HETZNER_API_BASE = 'https://api.hetzner.cloud/v1';

export class HetznerClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${HETZNER_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Hetzner API error');
    }

    return response.json();
  }

  async listServers(labelSelector?: string): Promise<HetznerServer[]> {
    const params = new URLSearchParams();
    if (labelSelector) {
      params.append('label_selector', labelSelector);
    }

    const data = await this.request<{ servers: HetznerServer[] }>(
      `/servers?${params.toString()}`
    );
    return data.servers;
  }

  async getServer(id: number): Promise<HetznerServer> {
    const data = await this.request<{ server: HetznerServer }>(
      `/servers/${id}`
    );
    return data.server;
  }

  async createServer(options: {
    name: string;
    server_type: string;
    image: string;
    location?: string;
    ssh_keys?: string[];
    user_data?: string;
    labels?: Record<string, string>;
  }): Promise<HetznerServer> {
    const data = await this.request<{
      server: HetznerServer;
      action: any;
      next_actions: any[];
      root_password?: string;
    }>('/servers', {
      method: 'POST',
      body: JSON.stringify(options),
    });
    return data.server;
  }

  async deleteServer(id: number): Promise<void> {
    await this.request(`/servers/${id}`, {
      method: 'DELETE',
    });
  }

  async powerOnServer(id: number): Promise<void> {
    await this.request(`/servers/${id}/actions/poweron`, {
      method: 'POST',
    });
  }

  async powerOffServer(id: number): Promise<void> {
    await this.request(`/servers/${id}/actions/poweroff`, {
      method: 'POST',
    });
  }

  async rebootServer(id: number): Promise<void> {
    await this.request(`/servers/${id}/actions/reboot`, {
      method: 'POST',
    });
  }

  async listServerTypes(): Promise<ServerType[]> {
    const data = await this.request<{ server_types: ServerType[] }>(
      '/server_types'
    );
    return data.server_types;
  }

  async listLocations(): Promise<Location[]> {
    const data = await this.request<{ locations: Location[] }>('/locations');
    return data.locations;
  }

  async listSSHKeys(): Promise<Array<{ id: number; name: string; public_key: string }>> {
    const data = await this.request<{
      ssh_keys: Array<{ id: number; name: string; public_key: string }>;
    }>('/ssh_keys');
    return data.ssh_keys;
  }

  async getMetrics(
    serverId: number,
    type: 'cpu' | 'disk' | 'network',
    start: Date,
    end: Date
  ): Promise<any> {
    const params = new URLSearchParams({
      type,
      start: start.toISOString(),
      end: end.toISOString(),
    });

    const data = await this.request<{ metrics: any }>(
      `/servers/${serverId}/metrics?${params.toString()}`
    );
    return data.metrics;
  }
}
/**
 * Enhanced Hetzner Client
 * 
 * Comprehensive Hetzner Cloud integration with:
 * - Per-application cost allocation via labels
 * - Full resource management (servers, volumes, load balancers, etc.)
 * - Real-time metrics and health monitoring
 * - Cost tracking and optimization recommendations
 */

import { HetznerServer, ServerType, Location } from '@/types/cluster';

const HETZNER_API_BASE = 'https://api.hetzner.cloud/v1';

// ===================================
// Types
// ===================================

export interface HetznerVolume {
  id: number;
  name: string;
  size: number;
  server: number | null;
  location: { id: number; name: string; description: string; country: string; city: string };
  status: 'creating' | 'available' | 'deleting';
  linux_device: string;
  protection: { delete: boolean };
  labels: Record<string, string>;
  created: string;
}

export interface HetznerLoadBalancer {
  id: number;
  name: string;
  public_net: {
    enabled: boolean;
    ipv4: { ip: string };
    ipv6: { ip: string };
  };
  private_net: Array<{ network: number; ip: string }>;
  location: { id: number; name: string };
  load_balancer_type: {
    id: number;
    name: string;
    description: string;
    max_connections: number;
    max_services: number;
    max_targets: number;
    prices: Array<{
      location: string;
      price_hourly: { net: string; gross: string };
      price_monthly: { net: string; gross: string };
    }>;
  };
  protection: { delete: boolean };
  labels: Record<string, string>;
  targets: Array<{
    type: 'server' | 'label_selector' | 'ip';
    server?: { id: number };
    label_selector?: { selector: string };
    ip?: { ip: string };
    health_status: Array<{ listen_port: number; status: 'healthy' | 'unhealthy' | 'unknown' }>;
  }>;
  services: Array<{
    protocol: 'tcp' | 'http' | 'https';
    listen_port: number;
    destination_port: number;
    proxyprotocol: boolean;
  }>;
  created: string;
}

export interface HetznerFloatingIP {
  id: number;
  name: string;
  description: string;
  ip: string;
  type: 'ipv4' | 'ipv6';
  server: number | null;
  home_location: { id: number; name: string };
  blocked: boolean;
  labels: Record<string, string>;
  created: string;
}

export interface HetznerNetwork {
  id: number;
  name: string;
  ip_range: string;
  subnets: Array<{
    type: 'cloud' | 'vswitch';
    ip_range: string;
    network_zone: string;
    gateway: string;
  }>;
  routes: Array<{
    destination: string;
    gateway: string;
  }>;
  servers: number[];
  labels: Record<string, string>;
  created: string;
}

export interface HetznerSnapshot {
  id: number;
  description: string;
  created_from: { id: number; name: string };
  disk_size: number;
  status: 'creating' | 'available';
  labels: Record<string, string>;
  created: string;
}

export interface ResourceCost {
  resourceId: number;
  resourceType: 'server' | 'volume' | 'load_balancer' | 'floating_ip' | 'snapshot' | 'network';
  resourceName: string;
  hourlyGross: number;
  monthlyGross: number;
  application?: string;
  environment?: string;
  labels: Record<string, string>;
  location: string;
  created: string;
  runTimeHours: number;
  totalCost: number;
}

export interface ApplicationCostSummary {
  application: string;
  totalMonthlyCost: number;
  totalHourlyCost: number;
  resources: ResourceCost[];
  byResourceType: Record<string, number>;
  currency: string;
}

export interface HetznerCostSummary {
  totalMonthlyCost: number;
  totalHourlyCost: number;
  byApplication: ApplicationCostSummary[];
  byResourceType: Record<string, number>;
  byLocation: Record<string, number>;
  untaggedCost: number;
  currency: string;
  timestamp: Date;
}

export interface HetznerHealthStatus {
  healthy: boolean;
  servers: {
    total: number;
    running: number;
    stopped: number;
    error: number;
  };
  loadBalancers: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  volumes: {
    total: number;
    available: number;
    attached: number;
  };
  issues: Array<{
    type: 'server_down' | 'lb_unhealthy' | 'volume_unattached' | 'high_utilization';
    resourceId: number;
    resourceName: string;
    message: string;
    severity: 'warning' | 'critical';
  }>;
}

// Standard labels for application tagging
export const APP_LABEL_KEY = 'app';
export const ENV_LABEL_KEY = 'environment';
export const MANAGED_BY_LABEL = 'managed-by';

// ===================================
// Enhanced Hetzner Client
// ===================================

export class EnhancedHetznerClient {
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
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `Hetzner API error: ${response.status}`);
    }

    return response.json();
  }

  // ===================================
  // Server Management
  // ===================================

  async listServers(labelSelector?: string): Promise<HetznerServer[]> {
    const params = new URLSearchParams();
    if (labelSelector) {
      params.append('label_selector', labelSelector);
    }
    const query = params.toString();
    const endpoint = query ? `/servers?${query}` : '/servers';
    
    const data = await this.request<{ servers: HetznerServer[] }>(endpoint);
    return data.servers;
  }

  async listServersByApplication(application: string): Promise<HetznerServer[]> {
    return this.listServers(`${APP_LABEL_KEY}=${application}`);
  }

  async listServersByEnvironment(environment: string): Promise<HetznerServer[]> {
    return this.listServers(`${ENV_LABEL_KEY}=${environment}`);
  }

  async getServer(id: number): Promise<HetznerServer> {
    const data = await this.request<{ server: HetznerServer }>(`/servers/${id}`);
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
    networks?: number[];
    volumes?: number[];
    automount?: boolean;
  }): Promise<HetznerServer> {
    // Ensure managed-by label is set
    const labels = {
      [MANAGED_BY_LABEL]: 'control-panel',
      ...options.labels,
    };

    const data = await this.request<{
      server: HetznerServer;
      action: unknown;
      root_password?: string;
    }>('/servers', {
      method: 'POST',
      body: JSON.stringify({ ...options, labels }),
    });
    return data.server;
  }

  async updateServerLabels(id: number, labels: Record<string, string>): Promise<HetznerServer> {
    const data = await this.request<{ server: HetznerServer }>(`/servers/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ labels }),
    });
    return data.server;
  }

  async tagServerWithApplication(id: number, application: string, environment?: string): Promise<HetznerServer> {
    const server = await this.getServer(id);
    const labels: Record<string, string> = {
      ...server.labels,
      [APP_LABEL_KEY]: application,
    };
    if (environment) {
      labels[ENV_LABEL_KEY] = environment;
    }
    return this.updateServerLabels(id, labels);
  }

  async deleteServer(id: number): Promise<void> {
    await this.request(`/servers/${id}`, { method: 'DELETE' });
  }

  async powerOnServer(id: number): Promise<void> {
    await this.request(`/servers/${id}/actions/poweron`, { method: 'POST' });
  }

  async powerOffServer(id: number): Promise<void> {
    await this.request(`/servers/${id}/actions/poweroff`, { method: 'POST' });
  }

  async rebootServer(id: number): Promise<void> {
    await this.request(`/servers/${id}/actions/reboot`, { method: 'POST' });
  }

  async rebuildServer(id: number, image: string): Promise<void> {
    await this.request(`/servers/${id}/actions/rebuild`, {
      method: 'POST',
      body: JSON.stringify({ image }),
    });
  }

  async resizeServer(id: number, serverType: string, upgradeDisk: boolean = true): Promise<void> {
    await this.request(`/servers/${id}/actions/change_type`, {
      method: 'POST',
      body: JSON.stringify({ server_type: serverType, upgrade_disk: upgradeDisk }),
    });
  }

  // ===================================
  // Volume Management
  // ===================================

  async listVolumes(labelSelector?: string): Promise<HetznerVolume[]> {
    const params = new URLSearchParams();
    if (labelSelector) {
      params.append('label_selector', labelSelector);
    }
    const query = params.toString();
    const endpoint = query ? `/volumes?${query}` : '/volumes';
    
    const data = await this.request<{ volumes: HetznerVolume[] }>(endpoint);
    return data.volumes;
  }

  async listVolumesByApplication(application: string): Promise<HetznerVolume[]> {
    return this.listVolumes(`${APP_LABEL_KEY}=${application}`);
  }

  async createVolume(options: {
    name: string;
    size: number;
    location?: string;
    server?: number;
    automount?: boolean;
    format?: string;
    labels?: Record<string, string>;
  }): Promise<HetznerVolume> {
    const labels = {
      [MANAGED_BY_LABEL]: 'control-panel',
      ...options.labels,
    };

    const data = await this.request<{ volume: HetznerVolume }>('/volumes', {
      method: 'POST',
      body: JSON.stringify({ ...options, labels }),
    });
    return data.volume;
  }

  async deleteVolume(id: number): Promise<void> {
    await this.request(`/volumes/${id}`, { method: 'DELETE' });
  }

  async attachVolume(id: number, serverId: number, automount: boolean = true): Promise<void> {
    await this.request(`/volumes/${id}/actions/attach`, {
      method: 'POST',
      body: JSON.stringify({ server: serverId, automount }),
    });
  }

  async detachVolume(id: number): Promise<void> {
    await this.request(`/volumes/${id}/actions/detach`, { method: 'POST' });
  }

  async resizeVolume(id: number, size: number): Promise<void> {
    await this.request(`/volumes/${id}/actions/resize`, {
      method: 'POST',
      body: JSON.stringify({ size }),
    });
  }

  // ===================================
  // Load Balancer Management
  // ===================================

  async listLoadBalancers(labelSelector?: string): Promise<HetznerLoadBalancer[]> {
    const params = new URLSearchParams();
    if (labelSelector) {
      params.append('label_selector', labelSelector);
    }
    const query = params.toString();
    const endpoint = query ? `/load_balancers?${query}` : '/load_balancers';
    
    const data = await this.request<{ load_balancers: HetznerLoadBalancer[] }>(endpoint);
    return data.load_balancers;
  }

  async listLoadBalancersByApplication(application: string): Promise<HetznerLoadBalancer[]> {
    return this.listLoadBalancers(`${APP_LABEL_KEY}=${application}`);
  }

  async getLoadBalancer(id: number): Promise<HetznerLoadBalancer> {
    const data = await this.request<{ load_balancer: HetznerLoadBalancer }>(`/load_balancers/${id}`);
    return data.load_balancer;
  }

  async createLoadBalancer(options: {
    name: string;
    load_balancer_type: string;
    location?: string;
    network_zone?: string;
    labels?: Record<string, string>;
    targets?: Array<{ type: string; server?: { id: number } }>;
    services?: Array<{
      protocol: string;
      listen_port: number;
      destination_port: number;
    }>;
  }): Promise<HetznerLoadBalancer> {
    const labels = {
      [MANAGED_BY_LABEL]: 'control-panel',
      ...options.labels,
    };

    const data = await this.request<{ load_balancer: HetznerLoadBalancer }>('/load_balancers', {
      method: 'POST',
      body: JSON.stringify({ ...options, labels }),
    });
    return data.load_balancer;
  }

  async deleteLoadBalancer(id: number): Promise<void> {
    await this.request(`/load_balancers/${id}`, { method: 'DELETE' });
  }

  async addLoadBalancerTarget(id: number, target: { type: string; server?: { id: number } }): Promise<void> {
    await this.request(`/load_balancers/${id}/actions/add_target`, {
      method: 'POST',
      body: JSON.stringify(target),
    });
  }

  async removeLoadBalancerTarget(id: number, target: { type: string; server?: { id: number } }): Promise<void> {
    await this.request(`/load_balancers/${id}/actions/remove_target`, {
      method: 'POST',
      body: JSON.stringify(target),
    });
  }

  // ===================================
  // Floating IP Management
  // ===================================

  async listFloatingIPs(labelSelector?: string): Promise<HetznerFloatingIP[]> {
    const params = new URLSearchParams();
    if (labelSelector) {
      params.append('label_selector', labelSelector);
    }
    const query = params.toString();
    const endpoint = query ? `/floating_ips?${query}` : '/floating_ips';
    
    const data = await this.request<{ floating_ips: HetznerFloatingIP[] }>(endpoint);
    return data.floating_ips;
  }

  async createFloatingIP(options: {
    type: 'ipv4' | 'ipv6';
    home_location?: string;
    server?: number;
    description?: string;
    name?: string;
    labels?: Record<string, string>;
  }): Promise<HetznerFloatingIP> {
    const labels = {
      [MANAGED_BY_LABEL]: 'control-panel',
      ...options.labels,
    };

    const data = await this.request<{ floating_ip: HetznerFloatingIP }>('/floating_ips', {
      method: 'POST',
      body: JSON.stringify({ ...options, labels }),
    });
    return data.floating_ip;
  }

  async deleteFloatingIP(id: number): Promise<void> {
    await this.request(`/floating_ips/${id}`, { method: 'DELETE' });
  }

  async assignFloatingIP(id: number, serverId: number): Promise<void> {
    await this.request(`/floating_ips/${id}/actions/assign`, {
      method: 'POST',
      body: JSON.stringify({ server: serverId }),
    });
  }

  async unassignFloatingIP(id: number): Promise<void> {
    await this.request(`/floating_ips/${id}/actions/unassign`, { method: 'POST' });
  }

  // ===================================
  // Network Management
  // ===================================

  async listNetworks(labelSelector?: string): Promise<HetznerNetwork[]> {
    const params = new URLSearchParams();
    if (labelSelector) {
      params.append('label_selector', labelSelector);
    }
    const query = params.toString();
    const endpoint = query ? `/networks?${query}` : '/networks';
    
    const data = await this.request<{ networks: HetznerNetwork[] }>(endpoint);
    return data.networks;
  }

  async createNetwork(options: {
    name: string;
    ip_range: string;
    labels?: Record<string, string>;
    subnets?: Array<{ type: string; ip_range: string; network_zone: string }>;
  }): Promise<HetznerNetwork> {
    const labels = {
      [MANAGED_BY_LABEL]: 'control-panel',
      ...options.labels,
    };

    const data = await this.request<{ network: HetznerNetwork }>('/networks', {
      method: 'POST',
      body: JSON.stringify({ ...options, labels }),
    });
    return data.network;
  }

  async deleteNetwork(id: number): Promise<void> {
    await this.request(`/networks/${id}`, { method: 'DELETE' });
  }

  // ===================================
  // Snapshots
  // ===================================

  async listSnapshots(): Promise<HetznerSnapshot[]> {
    const data = await this.request<{ images: HetznerSnapshot[] }>('/images?type=snapshot');
    return data.images;
  }

  async createSnapshot(serverId: number, description?: string, labels?: Record<string, string>): Promise<HetznerSnapshot> {
    const enhancedLabels = {
      [MANAGED_BY_LABEL]: 'control-panel',
      ...labels,
    };

    const data = await this.request<{ image: HetznerSnapshot }>(`/servers/${serverId}/actions/create_image`, {
      method: 'POST',
      body: JSON.stringify({ type: 'snapshot', description, labels: enhancedLabels }),
    });
    return data.image;
  }

  async deleteSnapshot(id: number): Promise<void> {
    await this.request(`/images/${id}`, { method: 'DELETE' });
  }

  // ===================================
  // Server Types & Locations
  // ===================================

  async listServerTypes(): Promise<ServerType[]> {
    const data = await this.request<{ server_types: ServerType[] }>('/server_types');
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

  // ===================================
  // Metrics
  // ===================================

  async getServerMetrics(
    serverId: number,
    type: 'cpu' | 'disk' | 'network',
    start: Date,
    end: Date
  ): Promise<{
    timeseries: Array<{
      name: string;
      values: Array<[number, string]>;
    }>;
  }> {
    const params = new URLSearchParams({
      type,
      start: start.toISOString(),
      end: end.toISOString(),
    });

    const data = await this.request<{ metrics: { timeseries: Array<{ name: string; values: Array<[number, string]> }> } }>(
      `/servers/${serverId}/metrics?${params.toString()}`
    );
    return data.metrics;
  }

  async getLoadBalancerMetrics(
    lbId: number,
    type: 'open_connections' | 'connections_per_second' | 'requests_per_second' | 'bandwidth',
    start: Date,
    end: Date
  ): Promise<{
    timeseries: Array<{
      name: string;
      values: Array<[number, string]>;
    }>;
  }> {
    const params = new URLSearchParams({
      type,
      start: start.toISOString(),
      end: end.toISOString(),
    });

    const data = await this.request<{ metrics: { timeseries: Array<{ name: string; values: Array<[number, string]> }> } }>(
      `/load_balancers/${lbId}/metrics?${params.toString()}`
    );
    return data.metrics;
  }

  // ===================================
  // Cost Tracking
  // ===================================

  /**
   * Get comprehensive cost summary with per-application breakdown
   */
  async getCostSummary(): Promise<HetznerCostSummary> {
    const [servers, volumes, loadBalancers, floatingIPs, snapshots] = await Promise.all([
      this.listServers(),
      this.listVolumes(),
      this.listLoadBalancers(),
      this.listFloatingIPs(),
      this.listSnapshots(),
    ]);

    const resourceCosts: ResourceCost[] = [];
    const now = new Date();

    // Calculate server costs
    for (const server of servers) {
      const price = server.server_type.prices?.[0];
      const created = new Date(server.created);
      const runTimeHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      const hourlyGross = parseFloat(price?.price_hourly?.gross || '0');
      const monthlyGross = parseFloat(price?.price_monthly?.gross || '0');

      resourceCosts.push({
        resourceId: server.id,
        resourceType: 'server',
        resourceName: server.name,
        hourlyGross,
        monthlyGross,
        application: server.labels?.[APP_LABEL_KEY],
        environment: server.labels?.[ENV_LABEL_KEY],
        labels: server.labels || {},
        location: server.datacenter.location.name,
        created: server.created,
        runTimeHours,
        totalCost: runTimeHours * hourlyGross,
      });
    }

    // Calculate volume costs (€0.0476/GB/month)
    for (const volume of volumes) {
      const created = new Date(volume.created);
      const runTimeHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      const monthlyGross = volume.size * 0.0476;
      const hourlyGross = monthlyGross / (30 * 24);

      resourceCosts.push({
        resourceId: volume.id,
        resourceType: 'volume',
        resourceName: volume.name,
        hourlyGross,
        monthlyGross,
        application: volume.labels?.[APP_LABEL_KEY],
        environment: volume.labels?.[ENV_LABEL_KEY],
        labels: volume.labels || {},
        location: volume.location.name,
        created: volume.created,
        runTimeHours,
        totalCost: runTimeHours * hourlyGross,
      });
    }

    // Calculate load balancer costs
    for (const lb of loadBalancers) {
      const price = lb.load_balancer_type.prices?.[0];
      const created = new Date(lb.created);
      const runTimeHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      const hourlyGross = parseFloat(price?.price_hourly?.gross || '0');
      const monthlyGross = parseFloat(price?.price_monthly?.gross || '0');

      resourceCosts.push({
        resourceId: lb.id,
        resourceType: 'load_balancer',
        resourceName: lb.name,
        hourlyGross,
        monthlyGross,
        application: lb.labels?.[APP_LABEL_KEY],
        environment: lb.labels?.[ENV_LABEL_KEY],
        labels: lb.labels || {},
        location: lb.location.name,
        created: lb.created,
        runTimeHours,
        totalCost: runTimeHours * hourlyGross,
      });
    }

    // Calculate floating IP costs (€1.19/month)
    for (const ip of floatingIPs) {
      const created = new Date(ip.created);
      const runTimeHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      const monthlyGross = 1.19;
      const hourlyGross = monthlyGross / (30 * 24);

      resourceCosts.push({
        resourceId: ip.id,
        resourceType: 'floating_ip',
        resourceName: ip.name || ip.ip,
        hourlyGross,
        monthlyGross,
        application: ip.labels?.[APP_LABEL_KEY],
        environment: ip.labels?.[ENV_LABEL_KEY],
        labels: ip.labels || {},
        location: ip.home_location.name,
        created: ip.created,
        runTimeHours,
        totalCost: runTimeHours * hourlyGross,
      });
    }

    // Calculate snapshot costs (€0.0104/GB/month)
    for (const snapshot of snapshots) {
      const created = new Date(snapshot.created);
      const runTimeHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      const monthlyGross = snapshot.disk_size * 0.0104;
      const hourlyGross = monthlyGross / (30 * 24);

      resourceCosts.push({
        resourceId: snapshot.id,
        resourceType: 'snapshot',
        resourceName: snapshot.description || `Snapshot ${snapshot.id}`,
        hourlyGross,
        monthlyGross,
        application: snapshot.labels?.[APP_LABEL_KEY],
        environment: snapshot.labels?.[ENV_LABEL_KEY],
        labels: snapshot.labels || {},
        location: 'global',
        created: snapshot.created,
        runTimeHours,
        totalCost: runTimeHours * hourlyGross,
      });
    }

    // Aggregate by application
    const appCosts = new Map<string, ApplicationCostSummary>();
    let untaggedCost = 0;

    for (const cost of resourceCosts) {
      const app = cost.application || 'untagged';
      
      if (app === 'untagged') {
        untaggedCost += cost.monthlyGross;
      }

      if (!appCosts.has(app)) {
        appCosts.set(app, {
          application: app,
          totalMonthlyCost: 0,
          totalHourlyCost: 0,
          resources: [],
          byResourceType: {},
          currency: 'EUR',
        });
      }

      const appCost = appCosts.get(app)!;
      appCost.totalMonthlyCost += cost.monthlyGross;
      appCost.totalHourlyCost += cost.hourlyGross;
      appCost.resources.push(cost);
      appCost.byResourceType[cost.resourceType] = (appCost.byResourceType[cost.resourceType] || 0) + cost.monthlyGross;
    }

    // Calculate totals
    const totalMonthlyCost = resourceCosts.reduce((sum, c) => sum + c.monthlyGross, 0);
    const totalHourlyCost = resourceCosts.reduce((sum, c) => sum + c.hourlyGross, 0);

    // By resource type
    const byResourceType: Record<string, number> = {};
    for (const cost of resourceCosts) {
      byResourceType[cost.resourceType] = (byResourceType[cost.resourceType] || 0) + cost.monthlyGross;
    }

    // By location
    const byLocation: Record<string, number> = {};
    for (const cost of resourceCosts) {
      byLocation[cost.location] = (byLocation[cost.location] || 0) + cost.monthlyGross;
    }

    return {
      totalMonthlyCost,
      totalHourlyCost,
      byApplication: Array.from(appCosts.values()).sort((a, b) => b.totalMonthlyCost - a.totalMonthlyCost),
      byResourceType,
      byLocation,
      untaggedCost,
      currency: 'EUR',
      timestamp: now,
    };
  }

  /**
   * Get costs for a specific application
   */
  async getApplicationCost(application: string): Promise<ApplicationCostSummary> {
    const summary = await this.getCostSummary();
    const appCost = summary.byApplication.find(a => a.application === application);
    
    if (!appCost) {
      return {
        application,
        totalMonthlyCost: 0,
        totalHourlyCost: 0,
        resources: [],
        byResourceType: {},
        currency: 'EUR',
      };
    }

    return appCost;
  }

  // ===================================
  // Health Status
  // ===================================

  /**
   * Get overall health status of Hetzner resources
   */
  async getHealthStatus(): Promise<HetznerHealthStatus> {
    const [servers, loadBalancers, volumes] = await Promise.all([
      this.listServers(),
      this.listLoadBalancers(),
      this.listVolumes(),
    ]);

    const issues: HetznerHealthStatus['issues'] = [];

    // Check server status
    const serverStats = {
      total: servers.length,
      running: servers.filter(s => s.status === 'running').length,
      stopped: servers.filter(s => s.status === 'off').length,
      error: servers.filter(s => !['running', 'off', 'initializing'].includes(s.status)).length,
    };

    for (const server of servers) {
      if (server.status !== 'running' && server.status !== 'off') {
        issues.push({
          type: 'server_down',
          resourceId: server.id,
          resourceName: server.name,
          message: `Server is in ${server.status} state`,
          severity: 'critical',
        });
      }
    }

    // Check load balancer health
    const lbStats = {
      total: loadBalancers.length,
      healthy: 0,
      unhealthy: 0,
    };

    for (const lb of loadBalancers) {
      const unhealthyTargets = lb.targets.filter(t => 
        t.health_status.some(hs => hs.status === 'unhealthy')
      );
      
      if (unhealthyTargets.length > 0) {
        lbStats.unhealthy++;
        issues.push({
          type: 'lb_unhealthy',
          resourceId: lb.id,
          resourceName: lb.name,
          message: `${unhealthyTargets.length} targets are unhealthy`,
          severity: unhealthyTargets.length === lb.targets.length ? 'critical' : 'warning',
        });
      } else {
        lbStats.healthy++;
      }
    }

    // Check volume status
    const volumeStats = {
      total: volumes.length,
      available: volumes.filter(v => v.status === 'available' && v.server === null).length,
      attached: volumes.filter(v => v.server !== null).length,
    };

    for (const volume of volumes) {
      if (volume.status === 'available' && volume.server === null) {
        issues.push({
          type: 'volume_unattached',
          resourceId: volume.id,
          resourceName: volume.name,
          message: 'Volume is not attached to any server',
          severity: 'warning',
        });
      }
    }

    return {
      healthy: issues.filter(i => i.severity === 'critical').length === 0,
      servers: serverStats,
      loadBalancers: lbStats,
      volumes: volumeStats,
      issues,
    };
  }

  /**
   * Test connection to Hetzner API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.listLocations();
      return { success: true, message: 'Hetzner connection successful' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Hetzner connection failed' };
    }
  }
}

// Factory function
export function createEnhancedHetznerClient(apiToken?: string): EnhancedHetznerClient | null {
  const token = apiToken || process.env.HETZNER_API_TOKEN;
  if (!token) {
    console.warn('Hetzner API token not configured');
    return null;
  }
  return new EnhancedHetznerClient(token);
}

export default EnhancedHetznerClient;

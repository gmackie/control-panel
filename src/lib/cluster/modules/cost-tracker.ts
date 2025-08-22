import { ClusterModule } from './base';
import { HetznerClient } from '@/lib/hetzner/client';

export interface CostMetrics {
  timestamp: Date;
  hourly: number;
  daily: number;
  monthly: number;
  projected: number;
  currency: string;
  breakdown: {
    servers: ServerCost[];
    volumes: VolumeCost[];
    snapshots: SnapshotCost[];
    loadBalancers: LoadBalancerCost[];
    floatingIps: FloatingIpCost[];
    traffic: TrafficCost;
  };
}

export interface ServerCost {
  id: number;
  name: string;
  type: string;
  location: string;
  status: string;
  hourly: number;
  monthly: number;
  created: Date;
  runtime: number; // hours
  totalCost: number;
}

export interface VolumeCost {
  id: number;
  name: string;
  size: number; // GB
  location: string;
  hourly: number;
  monthly: number;
}

export interface SnapshotCost {
  id: number;
  description: string;
  size: number; // GB
  hourly: number;
  monthly: number;
}

export interface LoadBalancerCost {
  id: number;
  name: string;
  type: string;
  location: string;
  hourly: number;
  monthly: number;
}

export interface FloatingIpCost {
  id: number;
  ip: string;
  location: string;
  hourly: number;
  monthly: number;
}

export interface TrafficCost {
  included: number; // TB
  used: number; // TB
  overage: number; // TB
  pricePerTB: number;
  totalCost: number;
}

export interface CostOptimization {
  type: 'server' | 'volume' | 'snapshot' | 'unused' | 'oversized';
  resource: string;
  currentCost: number;
  optimizedCost: number;
  savings: number;
  recommendation: string;
  impact: 'low' | 'medium' | 'high';
}

export interface CostTrackerConfig {
  hetznerApiToken: string;
  checkInterval: number; // seconds
  historyRetention: number; // days
  enableOptimizations: boolean;
  alertThresholds: {
    daily: number;
    monthly: number;
    unusualSpike: number; // percentage
  };
}

export class CostTracker implements ClusterModule {
  name = 'CostTracker';
  version = '1.0.0';
  description = 'Tracks and optimizes infrastructure costs';

  private hetznerClient: HetznerClient;
  private config: CostTrackerConfig;
  private checkInterval?: NodeJS.Timeout;
  private costHistory: CostMetrics[] = [];
  private lastCheck?: Date;

  constructor(config: CostTrackerConfig) {
    this.config = config;
    this.hetznerClient = new HetznerClient(config.hetznerApiToken);
  }

  async initialize(): Promise<void> {
    console.log('Cost Tracker initialized');
    await this.loadHistoricalData();
  }

  async startTracking(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Initial check
    await this.collectCosts();

    // Schedule periodic checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.collectCosts();
      } catch (error) {
        console.error('Cost collection failed:', error);
      }
    }, this.config.checkInterval * 1000);

    console.log(`Cost tracking started with interval: ${this.config.checkInterval}s`);
  }

  async stopTracking(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    console.log('Cost tracking stopped');
  }

  private async collectCosts(): Promise<void> {
    const [servers, volumes, snapshots, loadBalancers, floatingIps] = await Promise.all([
      this.collectServerCosts(),
      this.collectVolumeCosts(),
      this.collectSnapshotCosts(),
      this.collectLoadBalancerCosts(),
      this.collectFloatingIpCosts(),
    ]);

    const traffic = await this.collectTrafficCosts();

    const metrics: CostMetrics = {
      timestamp: new Date(),
      hourly: this.calculateHourlyCost(servers, volumes, snapshots, loadBalancers, floatingIps),
      daily: 0,
      monthly: 0,
      projected: 0,
      currency: 'EUR',
      breakdown: {
        servers,
        volumes,
        snapshots,
        loadBalancers,
        floatingIps,
        traffic,
      },
    };

    // Calculate aggregated costs
    metrics.daily = metrics.hourly * 24;
    metrics.monthly = this.calculateMonthlyCost(servers, volumes, snapshots, loadBalancers, floatingIps, traffic);
    metrics.projected = this.projectMonthlyCost(metrics);

    // Store metrics
    this.costHistory.push(metrics);
    await this.persistMetrics(metrics);

    // Check for alerts
    await this.checkCostAlerts(metrics);

    // Clean up old data
    this.cleanupOldData();

    this.lastCheck = new Date();
  }

  private async collectServerCosts(): Promise<ServerCost[]> {
    const servers = await this.hetznerClient.listServers();
    
    return servers.map(server => {
      const price = server.server_type.prices?.[0];
      const created = new Date(server.created);
      const runtime = (Date.now() - created.getTime()) / (1000 * 60 * 60); // hours
      
      return {
        id: server.id,
        name: server.name,
        type: server.server_type.name,
        location: server.datacenter.location.name,
        status: server.status,
        hourly: parseFloat(price?.price_hourly.gross || '0'),
        monthly: parseFloat(price?.price_monthly.gross || '0'),
        created,
        runtime,
        totalCost: runtime * parseFloat(price?.price_hourly.gross || '0'),
      };
    });
  }

  private async collectVolumeCosts(): Promise<VolumeCost[]> {
    try {
      const response = await fetch('https://api.hetzner.cloud/v1/volumes', {
        headers: {
          'Authorization': `Bearer ${this.config.hetznerApiToken}`,
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      
      return data.volumes.map((volume: any) => ({
        id: volume.id,
        name: volume.name,
        size: volume.size,
        location: volume.location.name,
        hourly: volume.size * 0.0000595, // €0.0476/month per GB
        monthly: volume.size * 0.0476,
      }));
    } catch (error) {
      console.error('Error collecting volume costs:', error);
      return [];
    }
  }

  private async collectSnapshotCosts(): Promise<SnapshotCost[]> {
    try {
      const response = await fetch('https://api.hetzner.cloud/v1/images?type=snapshot', {
        headers: {
          'Authorization': `Bearer ${this.config.hetznerApiToken}`,
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      
      return data.images.map((snapshot: any) => ({
        id: snapshot.id,
        description: snapshot.description || 'Unnamed snapshot',
        size: snapshot.disk_size,
        hourly: snapshot.disk_size * 0.0000130, // €0.0104/month per GB
        monthly: snapshot.disk_size * 0.0104,
      }));
    } catch (error) {
      console.error('Error collecting snapshot costs:', error);
      return [];
    }
  }

  private async collectLoadBalancerCosts(): Promise<LoadBalancerCost[]> {
    try {
      const response = await fetch('https://api.hetzner.cloud/v1/load_balancers', {
        headers: {
          'Authorization': `Bearer ${this.config.hetznerApiToken}`,
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      
      return data.load_balancers.map((lb: any) => ({
        id: lb.id,
        name: lb.name,
        type: lb.load_balancer_type.name,
        location: lb.location.name,
        hourly: lb.load_balancer_type.prices[0].price_hourly.gross,
        monthly: lb.load_balancer_type.prices[0].price_monthly.gross,
      }));
    } catch (error) {
      console.error('Error collecting load balancer costs:', error);
      return [];
    }
  }

  private async collectFloatingIpCosts(): Promise<FloatingIpCost[]> {
    try {
      const response = await fetch('https://api.hetzner.cloud/v1/floating_ips', {
        headers: {
          'Authorization': `Bearer ${this.config.hetznerApiToken}`,
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      
      return data.floating_ips.map((ip: any) => ({
        id: ip.id,
        ip: ip.ip,
        location: ip.home_location.name,
        hourly: 0.00149, // €1.19/month
        monthly: 1.19,
      }));
    } catch (error) {
      console.error('Error collecting floating IP costs:', error);
      return [];
    }
  }

  private async collectTrafficCosts(): Promise<TrafficCost> {
    // Hetzner includes 20TB per server, additional traffic costs €1/TB
    const servers = await this.hetznerClient.listServers();
    const includedTraffic = servers.length * 20; // TB
    
    // This would need actual traffic metrics from Hetzner
    // For now, return estimated values
    return {
      included: includedTraffic,
      used: 0, // Would need to query actual usage
      overage: 0,
      pricePerTB: 1.0,
      totalCost: 0,
    };
  }

  private calculateHourlyCost(
    servers: ServerCost[],
    volumes: VolumeCost[],
    snapshots: SnapshotCost[],
    loadBalancers: LoadBalancerCost[],
    floatingIps: FloatingIpCost[]
  ): number {
    const serverCost = servers.reduce((sum, s) => sum + s.hourly, 0);
    const volumeCost = volumes.reduce((sum, v) => sum + v.hourly, 0);
    const snapshotCost = snapshots.reduce((sum, s) => sum + s.hourly, 0);
    const lbCost = loadBalancers.reduce((sum, lb) => sum + lb.hourly, 0);
    const ipCost = floatingIps.reduce((sum, ip) => sum + ip.hourly, 0);
    
    return serverCost + volumeCost + snapshotCost + lbCost + ipCost;
  }

  private calculateMonthlyCost(
    servers: ServerCost[],
    volumes: VolumeCost[],
    snapshots: SnapshotCost[],
    loadBalancers: LoadBalancerCost[],
    floatingIps: FloatingIpCost[],
    traffic: TrafficCost
  ): number {
    const serverCost = servers.reduce((sum, s) => sum + s.monthly, 0);
    const volumeCost = volumes.reduce((sum, v) => sum + v.monthly, 0);
    const snapshotCost = snapshots.reduce((sum, s) => sum + s.monthly, 0);
    const lbCost = loadBalancers.reduce((sum, lb) => sum + lb.monthly, 0);
    const ipCost = floatingIps.reduce((sum, ip) => sum + ip.monthly, 0);
    
    return serverCost + volumeCost + snapshotCost + lbCost + ipCost + traffic.totalCost;
  }

  private projectMonthlyCost(current: CostMetrics): number {
    // Simple projection based on current run rate
    const daysInMonth = 30;
    const hoursSoFar = this.costHistory.length * (this.config.checkInterval / 3600);
    const hoursInMonth = daysInMonth * 24;
    
    if (hoursSoFar === 0) return current.monthly;
    
    const averageHourly = this.costHistory
      .slice(-24) // Last 24 data points
      .reduce((sum, m) => sum + m.hourly, 0) / Math.min(this.costHistory.length, 24);
    
    return averageHourly * hoursInMonth;
  }

  async getOptimizationRecommendations(): Promise<CostOptimization[]> {
    const recommendations: CostOptimization[] = [];
    const latestMetrics = this.costHistory[this.costHistory.length - 1];
    
    if (!latestMetrics || !this.config.enableOptimizations) return recommendations;

    // Check for idle servers
    for (const server of latestMetrics.breakdown.servers) {
      if (server.status === 'off') {
        recommendations.push({
          type: 'unused',
          resource: `Server: ${server.name}`,
          currentCost: server.monthly,
          optimizedCost: 0,
          savings: server.monthly,
          recommendation: `Server has been off. Consider deleting it to save €${server.monthly.toFixed(2)}/month`,
          impact: 'low',
        });
      }
    }

    // Check for old snapshots
    const oldSnapshots = latestMetrics.breakdown.snapshots.filter(s => {
      // Assume snapshots older than 30 days might be unnecessary
      return true; // Would need creation date from API
    });

    if (oldSnapshots.length > 3) {
      const snapshotCost = oldSnapshots.reduce((sum, s) => sum + s.monthly, 0);
      recommendations.push({
        type: 'snapshot',
        resource: 'Old Snapshots',
        currentCost: snapshotCost,
        optimizedCost: snapshotCost * 0.3, // Keep 30% of snapshots
        savings: snapshotCost * 0.7,
        recommendation: `Review and delete old snapshots. You have ${oldSnapshots.length} snapshots costing €${snapshotCost.toFixed(2)}/month`,
        impact: 'medium',
      });
    }

    // Check for unattached volumes
    for (const volume of latestMetrics.breakdown.volumes) {
      // Would need to check if volume is attached
      // This is a placeholder
    }

    // Check for oversized servers with low utilization
    // This would require metrics integration

    return recommendations;
  }

  async getCostHistory(days: number = 7): Promise<CostMetrics[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return this.costHistory.filter(m => m.timestamp > cutoff);
  }

  async getCostSummary(): Promise<{
    current: CostMetrics | null;
    trends: {
      daily: { value: number; change: number };
      weekly: { value: number; change: number };
      monthly: { value: number; change: number };
    };
    topSpenders: Array<{ name: string; type: string; cost: number }>;
  }> {
    const current = this.costHistory[this.costHistory.length - 1] || null;
    
    if (!current) {
      return {
        current: null,
        trends: {
          daily: { value: 0, change: 0 },
          weekly: { value: 0, change: 0 },
          monthly: { value: 0, change: 0 },
        },
        topSpenders: [],
      };
    }

    // Calculate trends
    const dayAgo = this.costHistory.find(m => 
      m.timestamp.getTime() < Date.now() - 24 * 60 * 60 * 1000
    );
    const weekAgo = this.costHistory.find(m => 
      m.timestamp.getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    const trends = {
      daily: {
        value: current.daily,
        change: dayAgo ? ((current.daily - dayAgo.daily) / dayAgo.daily) * 100 : 0,
      },
      weekly: {
        value: current.daily * 7,
        change: weekAgo ? ((current.daily - weekAgo.daily) / weekAgo.daily) * 100 : 0,
      },
      monthly: {
        value: current.monthly,
        change: 0, // Would need historical monthly data
      },
    };

    // Top spenders
    const topSpenders = current.breakdown.servers
      .map(s => ({ name: s.name, type: 'Server', cost: s.monthly }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    return { current, trends, topSpenders };
  }

  private async checkCostAlerts(metrics: CostMetrics): Promise<void> {
    // Check daily threshold
    if (metrics.daily > this.config.alertThresholds.daily) {
      console.warn(`Daily cost alert: €${metrics.daily.toFixed(2)} exceeds threshold of €${this.config.alertThresholds.daily}`);
    }

    // Check monthly threshold
    if (metrics.projected > this.config.alertThresholds.monthly) {
      console.warn(`Monthly cost alert: Projected €${metrics.projected.toFixed(2)} exceeds threshold of €${this.config.alertThresholds.monthly}`);
    }

    // Check for unusual spikes
    if (this.costHistory.length > 2) {
      const previous = this.costHistory[this.costHistory.length - 2];
      const increase = ((metrics.hourly - previous.hourly) / previous.hourly) * 100;
      
      if (increase > this.config.alertThresholds.unusualSpike) {
        console.warn(`Cost spike alert: ${increase.toFixed(1)}% increase in hourly costs`);
      }
    }
  }

  private async persistMetrics(metrics: CostMetrics): Promise<void> {
    try {
      // Store in database if available
      // TODO: Implement when database is enabled
      // For now, metrics are stored in memory only
    } catch (error) {
      console.error('Error persisting cost metrics:', error);
    }
  }

  private async loadHistoricalData(): Promise<void> {
    try {
      // TODO: Implement when database is enabled
      // For now, start with empty history
      this.costHistory = [];
    } catch (error) {
      console.error('Error loading historical cost data:', error);
    }
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - (this.config.historyRetention * 24 * 60 * 60 * 1000);
    this.costHistory = this.costHistory.filter(m => m.timestamp.getTime() > cutoff);
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const timeSinceLastCheck = this.lastCheck 
        ? (Date.now() - this.lastCheck.getTime()) / 1000
        : Infinity;
      
      if (timeSinceLastCheck > this.config.checkInterval * 2) {
        return { healthy: false, message: 'Cost tracking is behind schedule' };
      }

      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, message: error.message };
    }
  }

  async cleanup(): Promise<void> {
    await this.stopTracking();
  }
}
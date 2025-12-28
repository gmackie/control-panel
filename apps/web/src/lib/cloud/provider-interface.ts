/**
 * Unified Cloud Provider Interface
 * 
 * Abstract interface for multi-cloud resource management and cost tracking.
 * Implementations: Hetzner, AWS, GCP, Azure
 */

// ===================================
// Core Types
// ===================================

export type ProviderType = 'hetzner' | 'aws' | 'gcp' | 'azure';
export type ResourceCategory = 'compute' | 'storage' | 'network' | 'database' | 'serverless' | 'messaging' | 'iot' | 'monitoring' | 'other';
export type ResourceStatus = 'running' | 'stopped' | 'pending' | 'error' | 'unknown';

export interface ResourceTag {
  key: string;
  value: string;
}

export interface CloudResource {
  id: string;
  name: string;
  type: string;
  category: ResourceCategory;
  provider: ProviderType;
  region: string;
  status: ResourceStatus;
  tags: ResourceTag[];
  application?: string;
  environment?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface ResourceCost {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  category: ResourceCategory;
  provider: ProviderType;
  
  // Cost data
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  currency: string;
  
  // Attribution
  application?: string;
  environment?: string;
  
  // Usage
  usageQuantity?: number;
  usageUnit?: string;
  
  // Time tracking
  createdAt: Date;
  runTimeHours: number;
  totalCostToDate: number;
}

export interface ApplicationCostBreakdown {
  application: string;
  totalMonthly: number;
  totalDaily: number;
  currency: string;
  
  byProvider: Record<ProviderType, number>;
  byCategory: Record<ResourceCategory, number>;
  byEnvironment: Record<string, number>;
  
  resources: ResourceCost[];
  trend: {
    previousMonth: number;
    changePercent: number;
  };
}

export interface ProviderCostSummary {
  provider: ProviderType;
  totalMonthly: number;
  totalDaily: number;
  currency: string;
  
  byApplication: Record<string, number>;
  byCategory: Record<ResourceCategory, number>;
  
  resources: ResourceCost[];
  untaggedCost: number;
}

export interface MultiCloudCostSummary {
  totalMonthly: number;
  totalDaily: number;
  currency: string;
  
  byProvider: Record<ProviderType, ProviderCostSummary>;
  byApplication: ApplicationCostBreakdown[];
  byCategory: Record<ResourceCategory, number>;
  
  untaggedCost: number;
  timestamp: Date;
}

export interface HealthStatus {
  healthy: boolean;
  provider: ProviderType;
  
  resources: {
    total: number;
    healthy: number;
    unhealthy: number;
    unknown: number;
  };
  
  issues: Array<{
    resourceId: string;
    resourceName: string;
    type: string;
    message: string;
    severity: 'warning' | 'critical';
  }>;
}

// ===================================
// Cloud Provider Interface
// ===================================

export interface CloudProvider {
  readonly providerType: ProviderType;
  readonly name: string;
  
  // Connection
  testConnection(): Promise<{ success: boolean; message: string }>;
  
  // Resource listing
  listResources(options?: { 
    category?: ResourceCategory;
    application?: string;
    environment?: string;
  }): Promise<CloudResource[]>;
  
  // Cost tracking
  getCostSummary(): Promise<ProviderCostSummary>;
  getResourceCosts(): Promise<ResourceCost[]>;
  getApplicationCost(application: string): Promise<ApplicationCostBreakdown>;
  
  // Health monitoring
  getHealthStatus(): Promise<HealthStatus>;
  
  // Resource tagging
  tagResource(resourceId: string, tags: ResourceTag[]): Promise<void>;
  tagResourceWithApplication(resourceId: string, application: string, environment?: string): Promise<void>;
}

// ===================================
// Multi-Cloud Manager
// ===================================

export class MultiCloudManager {
  private providers: Map<ProviderType, CloudProvider> = new Map();
  
  registerProvider(provider: CloudProvider): void {
    this.providers.set(provider.providerType, provider);
  }
  
  unregisterProvider(providerType: ProviderType): void {
    this.providers.delete(providerType);
  }
  
  getProvider(providerType: ProviderType): CloudProvider | undefined {
    return this.providers.get(providerType);
  }
  
  getRegisteredProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Test connections to all registered providers
   */
  async testAllConnections(): Promise<Record<ProviderType, { success: boolean; message: string }>> {
    const results: Record<string, { success: boolean; message: string }> = {};
    
    for (const [type, provider] of this.providers) {
      results[type] = await provider.testConnection();
    }
    
    return results as Record<ProviderType, { success: boolean; message: string }>;
  }
  
  /**
   * Get comprehensive cost summary across all providers
   */
  async getMultiCloudCostSummary(): Promise<MultiCloudCostSummary> {
    const providerSummaries: Record<string, ProviderCostSummary> = {};
    const appCosts = new Map<string, ApplicationCostBreakdown>();
    const categoryCosts: Record<string, number> = {};
    let totalMonthly = 0;
    let totalDaily = 0;
    let untaggedCost = 0;
    
    for (const [type, provider] of this.providers) {
      const summary = await provider.getCostSummary();
      providerSummaries[type] = summary;
      
      totalMonthly += summary.totalMonthly;
      totalDaily += summary.totalDaily;
      untaggedCost += summary.untaggedCost;
      
      // Aggregate by category
      for (const [category, cost] of Object.entries(summary.byCategory)) {
        categoryCosts[category] = (categoryCosts[category] || 0) + cost;
      }
      
      // Aggregate by application
      for (const [app, cost] of Object.entries(summary.byApplication)) {
        if (!appCosts.has(app)) {
          appCosts.set(app, {
            application: app,
            totalMonthly: 0,
            totalDaily: 0,
            currency: summary.currency,
            byProvider: {} as Record<ProviderType, number>,
            byCategory: {} as Record<ResourceCategory, number>,
            byEnvironment: {},
            resources: [],
            trend: { previousMonth: 0, changePercent: 0 },
          });
        }
        
        const appCost = appCosts.get(app)!;
        appCost.totalMonthly += cost;
        appCost.byProvider[type] = cost;
        
        // Add resources for this app
        const appResources = summary.resources.filter(r => r.application === app);
        appCost.resources.push(...appResources);
        
        // Aggregate categories
        for (const resource of appResources) {
          appCost.byCategory[resource.category] = 
            (appCost.byCategory[resource.category] || 0) + resource.monthlyRate;
        }
      }
    }
    
    // Calculate daily rates for apps
    for (const appCost of appCosts.values()) {
      appCost.totalDaily = appCost.totalMonthly / 30;
    }
    
    return {
      totalMonthly,
      totalDaily,
      currency: 'USD',
      byProvider: providerSummaries as Record<ProviderType, ProviderCostSummary>,
      byApplication: Array.from(appCosts.values()).sort((a, b) => b.totalMonthly - a.totalMonthly),
      byCategory: categoryCosts as Record<ResourceCategory, number>,
      untaggedCost,
      timestamp: new Date(),
    };
  }
  
  /**
   * Get all resources across providers
   */
  async getAllResources(options?: {
    category?: ResourceCategory;
    application?: string;
    environment?: string;
  }): Promise<CloudResource[]> {
    const allResources: CloudResource[] = [];
    
    for (const provider of this.providers.values()) {
      const resources = await provider.listResources(options);
      allResources.push(...resources);
    }
    
    return allResources;
  }
  
  /**
   * Get health status across all providers
   */
  async getAllHealthStatus(): Promise<Record<ProviderType, HealthStatus>> {
    const statuses: Record<string, HealthStatus> = {};
    
    for (const [type, provider] of this.providers) {
      statuses[type] = await provider.getHealthStatus();
    }
    
    return statuses as Record<ProviderType, HealthStatus>;
  }
  
  /**
   * Get aggregated health status
   */
  async getAggregatedHealthStatus(): Promise<{
    healthy: boolean;
    byProvider: Record<ProviderType, boolean>;
    totalResources: number;
    healthyResources: number;
    allIssues: Array<{
      provider: ProviderType;
      resourceId: string;
      resourceName: string;
      type: string;
      message: string;
      severity: 'warning' | 'critical';
    }>;
  }> {
    const statuses = await this.getAllHealthStatus();
    
    const byProvider: Record<string, boolean> = {};
    let totalResources = 0;
    let healthyResources = 0;
    const allIssues: Array<{
      provider: ProviderType;
      resourceId: string;
      resourceName: string;
      type: string;
      message: string;
      severity: 'warning' | 'critical';
    }> = [];
    
    for (const [type, status] of Object.entries(statuses)) {
      byProvider[type] = status.healthy;
      totalResources += status.resources.total;
      healthyResources += status.resources.healthy;
      
      for (const issue of status.issues) {
        allIssues.push({
          provider: type as ProviderType,
          ...issue,
        });
      }
    }
    
    const healthy = allIssues.filter(i => i.severity === 'critical').length === 0;
    
    return {
      healthy,
      byProvider: byProvider as Record<ProviderType, boolean>,
      totalResources,
      healthyResources,
      allIssues: allIssues.sort((a, b) => 
        a.severity === 'critical' && b.severity !== 'critical' ? -1 : 1
      ),
    };
  }
  
  /**
   * Get cost breakdown for a specific application across all providers
   */
  async getApplicationCostBreakdown(application: string): Promise<ApplicationCostBreakdown> {
    const breakdown: ApplicationCostBreakdown = {
      application,
      totalMonthly: 0,
      totalDaily: 0,
      currency: 'USD',
      byProvider: {} as Record<ProviderType, number>,
      byCategory: {} as Record<ResourceCategory, number>,
      byEnvironment: {},
      resources: [],
      trend: { previousMonth: 0, changePercent: 0 },
    };
    
    for (const [type, provider] of this.providers) {
      const appCost = await provider.getApplicationCost(application);
      
      breakdown.totalMonthly += appCost.totalMonthly;
      breakdown.totalDaily += appCost.totalDaily;
      breakdown.byProvider[type] = appCost.totalMonthly;
      breakdown.resources.push(...appCost.resources);
      
      // Merge categories
      for (const [cat, cost] of Object.entries(appCost.byCategory)) {
        breakdown.byCategory[cat as ResourceCategory] = 
          (breakdown.byCategory[cat as ResourceCategory] || 0) + cost;
      }
      
      // Merge environments
      for (const [env, cost] of Object.entries(appCost.byEnvironment)) {
        breakdown.byEnvironment[env] = (breakdown.byEnvironment[env] || 0) + cost;
      }
    }
    
    return breakdown;
  }
  
  /**
   * Tag a resource with application across the appropriate provider
   */
  async tagResourceWithApplication(
    provider: ProviderType,
    resourceId: string,
    application: string,
    environment?: string
  ): Promise<void> {
    const cloudProvider = this.providers.get(provider);
    if (!cloudProvider) {
      throw new Error(`Provider ${provider} not registered`);
    }
    
    await cloudProvider.tagResourceWithApplication(resourceId, application, environment);
  }
}

// ===================================
// Singleton Instance
// ===================================

export const multiCloudManager = new MultiCloudManager();

export default multiCloudManager;

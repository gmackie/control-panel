import { z } from 'zod';

// Cost categories
export const CostCategory = z.enum(['compute', 'storage', 'network', 'database', 'monitoring', 'security', 'other']);
export type CostCategory = z.infer<typeof CostCategory>;

// Cost period types
export const CostPeriod = z.enum(['hourly', 'daily', 'weekly', 'monthly', 'yearly']);
export type CostPeriod = z.infer<typeof CostPeriod>;

// Resource types
export const ResourceType = z.enum(['server', 'database', 'storage', 'load_balancer', 'domain', 'certificate', 'backup']);
export type ResourceType = z.infer<typeof ResourceType>;

// Cost entry schema
export const CostEntrySchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  provider: z.string(), // hetzner, aws, gcp, azure, etc.
  service: z.string(), // specific service name
  category: CostCategory,
  resourceType: ResourceType,
  resourceId: z.string(),
  resourceName: z.string(),
  namespace: z.string().optional(),
  application: z.string().optional(),
  amount: z.number(), // cost in base currency (EUR/USD)
  currency: z.string().default('EUR'),
  period: CostPeriod,
  usage: z.object({
    value: z.number(),
    unit: z.string(), // hours, GB, requests, etc.
  }).optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
});

export type CostEntry = z.infer<typeof CostEntrySchema>;

// Budget schema
export const BudgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  amount: z.number(),
  currency: z.string().default('EUR'),
  period: CostPeriod,
  categories: z.array(CostCategory).optional(),
  applications: z.array(z.string()).optional(),
  namespaces: z.array(z.string()).optional(),
  providers: z.array(z.string()).optional(),
  alertThresholds: z.array(z.object({
    percentage: z.number(), // 0-100
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })).default([
    { percentage: 80, severity: 'medium' },
    { percentage: 95, severity: 'high' },
    { percentage: 100, severity: 'critical' },
  ]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Budget = z.infer<typeof BudgetSchema>;

// Cost optimization recommendation
export const RecommendationSchema = z.object({
  id: z.string(),
  type: z.enum(['rightsizing', 'unused_resources', 'reserved_instances', 'spot_instances', 'storage_optimization', 'network_optimization']),
  title: z.string(),
  description: z.string(),
  impact: z.enum(['low', 'medium', 'high']),
  potential_savings: z.number(),
  confidence: z.number(), // 0-1
  resourceId: z.string(),
  resourceName: z.string(),
  provider: z.string(),
  category: CostCategory,
  status: z.enum(['pending', 'accepted', 'rejected', 'implemented']),
  actions: z.array(z.object({
    title: z.string(),
    description: z.string(),
    automated: z.boolean(),
  })),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

export class CostManager {
  private costEntries = new Map<string, CostEntry>();
  private budgets = new Map<string, Budget>();
  private recommendations = new Map<string, Recommendation>();

  // Cost tracking
  async addCostEntry(entry: Omit<CostEntry, 'id'>): Promise<CostEntry> {
    const costEntry: CostEntry = {
      ...entry,
      id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.costEntries.set(costEntry.id, costEntry);
    await this.checkBudgetAlerts(costEntry);
    await this.generateRecommendations();
    
    return costEntry;
  }

  getCostEntries(filters?: {
    provider?: string;
    category?: CostCategory;
    application?: string;
    namespace?: string;
    startDate?: Date;
    endDate?: Date;
  }): CostEntry[] {
    let entries = Array.from(this.costEntries.values());

    if (filters) {
      entries = entries.filter(entry => {
        if (filters.provider && entry.provider !== filters.provider) return false;
        if (filters.category && entry.category !== filters.category) return false;
        if (filters.application && entry.application !== filters.application) return false;
        if (filters.namespace && entry.namespace !== filters.namespace) return false;
        if (filters.startDate && entry.timestamp < filters.startDate) return false;
        if (filters.endDate && entry.timestamp > filters.endDate) return false;
        return true;
      });
    }

    return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Cost analytics
  getCostAnalytics(period: CostPeriod = 'monthly') {
    const entries = Array.from(this.costEntries.values());
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'hourly':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const periodEntries = entries.filter(entry => entry.timestamp >= startDate);

    const totalCost = periodEntries.reduce((sum, entry) => sum + entry.amount, 0);

    const byCategory = periodEntries.reduce((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + entry.amount;
      return acc;
    }, {} as Record<CostCategory, number>);

    const byProvider = periodEntries.reduce((acc, entry) => {
      acc[entry.provider] = (acc[entry.provider] || 0) + entry.amount;
      return acc;
    }, {} as Record<string, number>);

    const byApplication = periodEntries.reduce((acc, entry) => {
      if (entry.application) {
        acc[entry.application] = (acc[entry.application] || 0) + entry.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const topCosts = periodEntries
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return {
      period,
      startDate,
      endDate: now,
      totalCost,
      entryCount: periodEntries.length,
      byCategory,
      byProvider,
      byApplication,
      topCosts,
      averageCost: totalCost / Math.max(periodEntries.length, 1),
      currency: periodEntries[0]?.currency || 'EUR',
    };
  }

  // Budget management
  async createBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget> {
    const newBudget: Budget = {
      ...budget,
      id: `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.budgets.set(newBudget.id, newBudget);
    return newBudget;
  }

  getBudgets(): Budget[] {
    return Array.from(this.budgets.values());
  }

  getBudgetStatus(budgetId: string, period: CostPeriod = 'monthly') {
    const budget = this.budgets.get(budgetId);
    if (!budget) return null;

    const analytics = this.getCostAnalytics(period);
    let relevantCost = analytics.totalCost;

    // Filter costs based on budget criteria
    if (budget.categories || budget.applications || budget.namespaces || budget.providers) {
      const entries = this.getCostEntries();
      relevantCost = entries
        .filter(entry => {
          if (budget.categories && !budget.categories.includes(entry.category)) return false;
          if (budget.applications && entry.application && !budget.applications.includes(entry.application)) return false;
          if (budget.namespaces && entry.namespace && !budget.namespaces.includes(entry.namespace)) return false;
          if (budget.providers && !budget.providers.includes(entry.provider)) return false;
          return true;
        })
        .reduce((sum, entry) => sum + entry.amount, 0);
    }

    const usedPercentage = (relevantCost / budget.amount) * 100;
    const remainingAmount = budget.amount - relevantCost;
    const remainingPercentage = Math.max(0, 100 - usedPercentage);

    // Check alert thresholds
    const triggeredAlerts = budget.alertThresholds
      .filter(threshold => usedPercentage >= threshold.percentage)
      .sort((a, b) => b.percentage - a.percentage);

    return {
      budget,
      used: relevantCost,
      usedPercentage,
      remaining: remainingAmount,
      remainingPercentage,
      isOverBudget: usedPercentage > 100,
      triggeredAlerts,
      highestAlert: triggeredAlerts[0] || null,
    };
  }

  // Optimization recommendations
  async generateRecommendations(): Promise<void> {
    const entries = this.getCostEntries();
    const analytics = this.getCostAnalytics('monthly');

    // Unused resources recommendation
    const unusedResources = this.findUnusedResources(entries);
    if (unusedResources.length > 0) {
      const potentialSavings = unusedResources.reduce((sum, resource) => sum + resource.monthlyCost, 0);
      
      const recommendation: Recommendation = {
        id: `rec_unused_${Date.now()}`,
        type: 'unused_resources',
        title: `${unusedResources.length} Unused Resources Detected`,
        description: `Found ${unusedResources.length} resources with no usage in the last 30 days. Consider removing these resources to save costs.`,
        impact: potentialSavings > 100 ? 'high' : potentialSavings > 50 ? 'medium' : 'low',
        potential_savings: potentialSavings,
        confidence: 0.9,
        resourceId: 'multiple',
        resourceName: 'Multiple Resources',
        provider: 'multiple',
        category: 'compute',
        status: 'pending',
        actions: [
          {
            title: 'Review Resource Usage',
            description: 'Analyze usage patterns for the identified resources',
            automated: false,
          },
          {
            title: 'Remove Unused Resources',
            description: 'Delete or stop resources with no activity',
            automated: true,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.recommendations.set(recommendation.id, recommendation);
    }

    // Right-sizing recommendations
    const oversizedResources = this.findOversizedResources(entries);
    if (oversizedResources.length > 0) {
      const potentialSavings = oversizedResources.reduce((sum, resource) => sum + resource.potentialSavings, 0);
      
      const recommendation: Recommendation = {
        id: `rec_rightsize_${Date.now()}`,
        type: 'rightsizing',
        title: `${oversizedResources.length} Resources Can Be Right-Sized`,
        description: `Found ${oversizedResources.length} resources that appear oversized based on usage patterns.`,
        impact: potentialSavings > 200 ? 'high' : potentialSavings > 100 ? 'medium' : 'low',
        potential_savings: potentialSavings,
        confidence: 0.8,
        resourceId: 'multiple',
        resourceName: 'Multiple Resources',
        provider: 'multiple',
        category: 'compute',
        status: 'pending',
        actions: [
          {
            title: 'Analyze Usage Patterns',
            description: 'Review CPU, memory, and storage utilization',
            automated: false,
          },
          {
            title: 'Resize Resources',
            description: 'Downgrade to appropriate instance sizes',
            automated: false,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.recommendations.set(recommendation.id, recommendation);
    }

    // Storage optimization
    const storageOptimizations = this.findStorageOptimizations(entries);
    if (storageOptimizations.length > 0) {
      const potentialSavings = storageOptimizations.reduce((sum, opt) => sum + opt.monthlySavings, 0);
      
      const recommendation: Recommendation = {
        id: `rec_storage_${Date.now()}`,
        type: 'storage_optimization',
        title: 'Storage Optimization Opportunities',
        description: `Found opportunities to optimize storage costs through compression, archival, and cleanup.`,
        impact: potentialSavings > 50 ? 'high' : potentialSavings > 25 ? 'medium' : 'low',
        potential_savings: potentialSavings,
        confidence: 0.7,
        resourceId: 'multiple',
        resourceName: 'Storage Resources',
        provider: 'multiple',
        category: 'storage',
        status: 'pending',
        actions: [
          {
            title: 'Clean Up Old Data',
            description: 'Remove outdated backups and logs',
            automated: true,
          },
          {
            title: 'Enable Compression',
            description: 'Enable compression on storage volumes',
            automated: false,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.recommendations.set(recommendation.id, recommendation);
    }
  }

  getRecommendations(status?: 'pending' | 'accepted' | 'rejected' | 'implemented'): Recommendation[] {
    let recommendations = Array.from(this.recommendations.values());

    if (status) {
      recommendations = recommendations.filter(rec => rec.status === status);
    }

    return recommendations.sort((a, b) => b.potential_savings - a.potential_savings);
  }

  async updateRecommendation(id: string, updates: Partial<Recommendation>): Promise<Recommendation | null> {
    const recommendation = this.recommendations.get(id);
    if (!recommendation) return null;

    const updated = {
      ...recommendation,
      ...updates,
      updatedAt: new Date(),
    };

    this.recommendations.set(id, updated);
    return updated;
  }

  // Private helper methods
  private async checkBudgetAlerts(entry: CostEntry): Promise<void> {
    const budgets = Array.from(this.budgets.values());
    
    for (const budget of budgets) {
      const status = this.getBudgetStatus(budget.id);
      if (!status) continue;

      const triggeredAlert = status.triggeredAlerts[0];
      if (triggeredAlert && !this.hasRecentAlert(budget.id, triggeredAlert.severity)) {
        // Send budget alert
        console.log(`Budget Alert: ${budget.name} is at ${status.usedPercentage.toFixed(1)}% (${triggeredAlert.severity})`);
        // Here you would integrate with the alert manager
      }
    }
  }

  private hasRecentAlert(budgetId: string, severity: string): boolean {
    // Check if we've sent an alert for this budget and severity in the last hour
    // This is a simplified implementation
    return false;
  }

  private findUnusedResources(entries: CostEntry[]) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEntries = entries.filter(entry => entry.timestamp >= thirtyDaysAgo);
    
    // Group by resource
    const resourceUsage = new Map<string, { totalCost: number; usageRecords: number }>();
    
    for (const entry of recentEntries) {
      const key = `${entry.provider}:${entry.resourceId}`;
      const existing = resourceUsage.get(key) || { totalCost: 0, usageRecords: 0 };
      
      existing.totalCost += entry.amount;
      if (entry.usage && entry.usage.value > 0) {
        existing.usageRecords++;
      }
      
      resourceUsage.set(key, existing);
    }

    return Array.from(resourceUsage.entries())
      .filter(([_, usage]) => usage.usageRecords === 0 && usage.totalCost > 0)
      .map(([resourceKey, usage]) => ({
        resourceKey,
        monthlyCost: usage.totalCost,
      }));
  }

  private findOversizedResources(entries: CostEntry[]) {
    // This is a simplified implementation
    // In practice, you'd analyze CPU, memory, and storage utilization
    return entries
      .filter(entry => entry.category === 'compute' && entry.amount > 100)
      .map(entry => ({
        resourceId: entry.resourceId,
        currentCost: entry.amount,
        potentialSavings: entry.amount * 0.3, // Assume 30% savings from right-sizing
      }))
      .slice(0, 5); // Top 5 candidates
  }

  private findStorageOptimizations(entries: CostEntry[]) {
    return entries
      .filter(entry => entry.category === 'storage' && entry.amount > 20)
      .map(entry => ({
        resourceId: entry.resourceId,
        monthlySavings: entry.amount * 0.2, // Assume 20% savings from optimization
      }))
      .slice(0, 3); // Top 3 candidates
  }

  // Utility methods
  getCostSummary() {
    const entries = Array.from(this.costEntries.values());
    const totalCost = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const budgets = Array.from(this.budgets.values());
    const recommendations = Array.from(this.recommendations.values());
    const potentialSavings = recommendations
      .filter(rec => rec.status === 'pending')
      .reduce((sum, rec) => sum + rec.potential_savings, 0);

    return {
      totalCost,
      entryCount: entries.length,
      budgetCount: budgets.length,
      recommendationCount: recommendations.length,
      potentialSavings,
      currency: entries[0]?.currency || 'EUR',
    };
  }
}

// Singleton instance
export const costManager = new CostManager();
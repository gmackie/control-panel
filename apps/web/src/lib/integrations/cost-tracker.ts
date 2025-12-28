/**
 * Integration Cost Tracker
 * 
 * Comprehensive cost tracking for third-party services with two levels:
 * 1. Application-level: Costs attributable to specific apps (database per-app, API calls per app)
 * 2. Global/Platform-level: Shared services (Clerk, Expo, Vercel, etc.)
 * 
 * Supported integrations:
 * - Databases: PlanetScale, Turso, Supabase, Neon
 * - Auth: Clerk
 * - Hosting: Vercel
 * - Mobile: Expo
 * - Payments: Stripe
 * - AI: OpenRouter, OpenAI, ElevenLabs
 * - Email: SendGrid, Resend
 * - Analytics: PostHog
 * - Messaging: Twilio
 */

// ===================================
// Types
// ===================================

export type IntegrationType = 
  // Databases (can be per-app or shared)
  | 'planetscale'
  | 'turso'
  | 'supabase'
  | 'neon'
  // Auth (typically global)
  | 'clerk'
  // Hosting (can be per-app)
  | 'vercel'
  // Mobile (typically global)
  | 'expo'
  // Payments (per-app)
  | 'stripe'
  // AI Services (per-app)
  | 'openrouter'
  | 'openai'
  | 'elevenlabs'
  | 'anthropic'
  // Email (can be per-app)
  | 'sendgrid'
  | 'resend'
  // Analytics (can be global or per-app)
  | 'posthog'
  // Messaging (per-app)
  | 'twilio'
  // Storage (per-app)
  | 'cloudflare'
  | 'uploadthing';

export type CostScope = 'global' | 'application';

export interface UsageMetric {
  name: string;
  value: number;
  unit: string;
  limit?: number;
  percentUsed?: number;
}

export interface IntegrationCostEntry {
  integrationId: string;
  integrationType: IntegrationType;
  scope: CostScope;
  
  // Application attribution (null for global)
  applicationId?: string;
  applicationName?: string;
  
  // Cost data
  amount: number;
  currency: string;
  
  // Billing period
  periodStart: Date;
  periodEnd: Date;
  billingCycle: 'monthly' | 'usage' | 'annual';
  
  // Plan info
  planName?: string;
  planTier?: string;
  
  // Usage metrics
  usage: UsageMetric[];
  
  // Breakdown
  breakdown: {
    base: number;       // Fixed subscription cost
    usage: number;      // Usage-based cost
    overage: number;    // Over-limit charges
    addons: number;     // Add-on features
  };
  
  // Status
  status: 'active' | 'trial' | 'past_due' | 'cancelled';
  
  // Metadata
  lastUpdated: Date;
  apiSource: boolean;  // true if fetched from API, false if manual/estimated
}

export interface IntegrationConfig {
  type: IntegrationType;
  name: string;
  enabled: boolean;
  scope: CostScope;
  
  // API credentials
  apiKey?: string;
  apiSecret?: string;
  accountId?: string;
  
  // For per-app tracking
  applicationMappings?: {
    applicationId: string;
    integrationIdentifier: string;  // e.g., database name, project ID
  }[];
  
  // Pricing info for estimation when API not available
  pricing?: {
    baseCost: number;
    currency: string;
    billingCycle: 'monthly' | 'annual';
    usageRates?: Record<string, { rate: number; unit: string }>;
  };
}

export interface GlobalCostSummary {
  totalMonthly: number;
  currency: string;
  
  byIntegration: Record<IntegrationType, {
    name: string;
    amount: number;
    usage: UsageMetric[];
    status: string;
  }>;
  
  byCategory: {
    databases: number;
    auth: number;
    hosting: number;
    mobile: number;
    payments: number;
    ai: number;
    email: number;
    analytics: number;
    messaging: number;
    storage: number;
    other: number;
  };
  
  trend: {
    previousMonth: number;
    changePercent: number;
  };
}

export interface ApplicationIntegrationCosts {
  applicationId: string;
  applicationName: string;
  
  totalMonthly: number;
  currency: string;
  
  integrations: IntegrationCostEntry[];
  
  byCategory: Record<string, number>;
}

// ===================================
// Integration Cost Fetchers
// ===================================

/**
 * PlanetScale Database Cost Tracker
 */
export class PlanetScaleCostTracker {
  private apiToken: string;
  private orgId: string;

  constructor(apiToken: string, orgId: string) {
    this.apiToken = apiToken;
    this.orgId = orgId;
  }

  async getDatabaseCosts(): Promise<IntegrationCostEntry[]> {
    try {
      // PlanetScale API: https://api.planetscale.com/v1/organizations/{org}/databases
      const response = await fetch(
        `https://api.planetscale.com/v1/organizations/${this.orgId}/databases`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`PlanetScale API error: ${response.status}`);
      }

      const data = await response.json();
      const costs: IntegrationCostEntry[] = [];

      for (const db of data.databases || []) {
        // Get usage for each database
        const usageResponse = await fetch(
          `https://api.planetscale.com/v1/organizations/${this.orgId}/databases/${db.name}/usage`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
            },
          }
        );

        const usage = usageResponse.ok ? await usageResponse.json() : {};

        // PlanetScale pricing (approximate):
        // Scaler: $29/mo + $0.25/million rows read + $1/million rows written
        // Scaler Pro: $39/mo + $0.15/million rows read + $0.50/million rows written
        const rowsRead = usage.rows_read || 0;
        const rowsWritten = usage.rows_written || 0;
        const storageMB = usage.storage_mb || 0;

        const baseCost = db.plan === 'scaler_pro' ? 39 : 29;
        const readCost = (rowsRead / 1000000) * (db.plan === 'scaler_pro' ? 0.15 : 0.25);
        const writeCost = (rowsWritten / 1000000) * (db.plan === 'scaler_pro' ? 0.50 : 1.00);
        const storageCost = Math.max(0, (storageMB - 5000) / 1000) * 2.50; // $2.50/GB over 5GB

        costs.push({
          integrationId: `planetscale-${db.name}`,
          integrationType: 'planetscale',
          scope: 'application',
          applicationId: db.name, // Use database name as app identifier
          applicationName: db.name,
          amount: baseCost + readCost + writeCost + storageCost,
          currency: 'USD',
          periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
          billingCycle: 'monthly',
          planName: db.plan,
          planTier: db.plan,
          usage: [
            { name: 'Rows Read', value: rowsRead, unit: 'rows' },
            { name: 'Rows Written', value: rowsWritten, unit: 'rows' },
            { name: 'Storage', value: storageMB, unit: 'MB', limit: 5000, percentUsed: (storageMB / 5000) * 100 },
          ],
          breakdown: {
            base: baseCost,
            usage: readCost + writeCost,
            overage: storageCost,
            addons: 0,
          },
          status: 'active',
          lastUpdated: new Date(),
          apiSource: true,
        });
      }

      return costs;
    } catch (error) {
      console.error('Error fetching PlanetScale costs:', error);
      return [];
    }
  }
}

/**
 * Turso Database Cost Tracker
 */
export class TursoCostTracker {
  private apiToken: string;
  private orgSlug: string;

  constructor(apiToken: string, orgSlug: string) {
    this.apiToken = apiToken;
    this.orgSlug = orgSlug;
  }

  async getDatabaseCosts(): Promise<IntegrationCostEntry[]> {
    try {
      // Turso API: https://api.turso.tech/v1/organizations/{org}/databases
      const response = await fetch(
        `https://api.turso.tech/v1/organizations/${this.orgSlug}/databases`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Turso API error: ${response.status}`);
      }

      const data = await response.json();
      const costs: IntegrationCostEntry[] = [];

      // Get org billing info
      const billingResponse = await fetch(
        `https://api.turso.tech/v1/organizations/${this.orgSlug}/billing`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
          },
        }
      );
      const billing = billingResponse.ok ? await billingResponse.json() : {};

      // Turso pricing:
      // Starter: Free (500 databases, 9GB storage, 1B rows read/mo)
      // Scaler: $29/mo (10k databases, 24GB storage, 100B rows read/mo)
      // Enterprise: Custom

      const plan = billing.plan || 'starter';
      const totalRows = billing.rows_read || 0;
      const totalStorage = billing.storage_bytes || 0;
      const dbCount = data.databases?.length || 0;

      // Distribute cost across databases based on usage
      for (const db of data.databases || []) {
        const dbUsage = db.usage || {};
        const dbRows = dbUsage.rows_read || totalRows / dbCount;
        const dbStorage = dbUsage.storage_bytes || totalStorage / dbCount;

        // Estimate per-database cost based on proportion of total usage
        const usageProportion = totalRows > 0 ? dbRows / totalRows : 1 / dbCount;
        const planCost = plan === 'scaler' ? 29 : 0;
        const dbCost = planCost * usageProportion;

        costs.push({
          integrationId: `turso-${db.name}`,
          integrationType: 'turso',
          scope: 'application',
          applicationId: db.name,
          applicationName: db.name,
          amount: dbCost,
          currency: 'USD',
          periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
          billingCycle: 'monthly',
          planName: plan,
          planTier: plan,
          usage: [
            { name: 'Rows Read', value: dbRows, unit: 'rows' },
            { name: 'Storage', value: dbStorage / (1024 * 1024), unit: 'MB' },
            { name: 'Regions', value: db.regions?.length || 1, unit: 'regions' },
          ],
          breakdown: {
            base: dbCost,
            usage: 0,
            overage: 0,
            addons: 0,
          },
          status: 'active',
          lastUpdated: new Date(),
          apiSource: true,
        });
      }

      return costs;
    } catch (error) {
      console.error('Error fetching Turso costs:', error);
      return [];
    }
  }
}

/**
 * Clerk Authentication Cost Tracker (Global)
 */
export class ClerkCostTracker {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getCosts(): Promise<IntegrationCostEntry> {
    try {
      // Get user count for cost estimation
      const response = await fetch(
        'https://api.clerk.com/v1/users/count',
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      const data = response.ok ? await response.json() : { total_count: 0 };
      const userCount = data.total_count || 0;

      // Clerk pricing (2024):
      // Free: 10,000 MAU
      // Pro: $25/mo + $0.02/MAU over 10,000
      // Enterprise: Custom

      let planCost = 0;
      let overageCost = 0;
      let plan = 'free';

      if (userCount > 10000) {
        plan = 'pro';
        planCost = 25;
        overageCost = (userCount - 10000) * 0.02;
      }

      return {
        integrationId: 'clerk-global',
        integrationType: 'clerk',
        scope: 'global',
        amount: planCost + overageCost,
        currency: 'USD',
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        billingCycle: 'monthly',
        planName: plan,
        planTier: plan,
        usage: [
          { name: 'Monthly Active Users', value: userCount, unit: 'users', limit: 10000, percentUsed: (userCount / 10000) * 100 },
        ],
        breakdown: {
          base: planCost,
          usage: 0,
          overage: overageCost,
          addons: 0,
        },
        status: 'active',
        lastUpdated: new Date(),
        apiSource: true,
      };
    } catch (error) {
      console.error('Error fetching Clerk costs:', error);
      return this.getEstimatedCost();
    }
  }

  private getEstimatedCost(): IntegrationCostEntry {
    return {
      integrationId: 'clerk-global',
      integrationType: 'clerk',
      scope: 'global',
      amount: 25,
      currency: 'USD',
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      billingCycle: 'monthly',
      planName: 'pro',
      planTier: 'pro',
      usage: [],
      breakdown: { base: 25, usage: 0, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: new Date(),
      apiSource: false,
    };
  }
}

/**
 * Vercel Hosting Cost Tracker
 */
export class VercelCostTracker {
  private apiToken: string;
  private teamId?: string;

  constructor(apiToken: string, teamId?: string) {
    this.apiToken = apiToken;
    this.teamId = teamId;
  }

  async getCosts(): Promise<IntegrationCostEntry[]> {
    try {
      const teamParam = this.teamId ? `?teamId=${this.teamId}` : '';
      
      // Get all projects
      const projectsResponse = await fetch(
        `https://api.vercel.com/v9/projects${teamParam}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
          },
        }
      );

      if (!projectsResponse.ok) {
        throw new Error(`Vercel API error: ${projectsResponse.status}`);
      }

      const projectsData = await projectsResponse.json();
      const costs: IntegrationCostEntry[] = [];

      // Get usage data
      const usageResponse = await fetch(
        `https://api.vercel.com/v1/usage${teamParam}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
          },
        }
      );

      const usageData = usageResponse.ok ? await usageResponse.json() : {};

      // Vercel pricing:
      // Hobby: Free (100GB bandwidth, 100 hours serverless)
      // Pro: $20/member/mo (1TB bandwidth, 1000 hours serverless)
      // Enterprise: Custom

      // Distribute costs across projects
      const totalProjects = projectsData.projects?.length || 1;
      const bandwidth = usageData.bandwidth?.value || 0;
      const serverlessHours = usageData.serverlessFunctionExecution?.value || 0;

      for (const project of projectsData.projects || []) {
        // Estimate per-project cost (simplified)
        const projectCost = 20 / totalProjects; // Split team cost

        // Get project-specific analytics if available
        const projectUsage = {
          bandwidth: bandwidth / totalProjects,
          serverlessHours: serverlessHours / totalProjects,
        };

        costs.push({
          integrationId: `vercel-${project.id}`,
          integrationType: 'vercel',
          scope: 'application',
          applicationId: project.name,
          applicationName: project.name,
          amount: projectCost,
          currency: 'USD',
          periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
          billingCycle: 'monthly',
          planName: 'pro',
          planTier: 'pro',
          usage: [
            { name: 'Bandwidth', value: projectUsage.bandwidth / (1024 * 1024 * 1024), unit: 'GB' },
            { name: 'Serverless Hours', value: projectUsage.serverlessHours, unit: 'hours' },
          ],
          breakdown: {
            base: projectCost,
            usage: 0,
            overage: 0,
            addons: 0,
          },
          status: 'active',
          lastUpdated: new Date(),
          apiSource: true,
        });
      }

      return costs;
    } catch (error) {
      console.error('Error fetching Vercel costs:', error);
      return [];
    }
  }
}

/**
 * Expo (React Native) Cost Tracker (Global)
 */
export class ExpoCostTracker {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getCosts(): Promise<IntegrationCostEntry> {
    try {
      // Get account info
      const response = await fetch(
        'https://api.expo.dev/v2/users/me',
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      const data = response.ok ? await response.json() : {};

      // Expo EAS pricing:
      // Free: 30 builds/mo, 1 update/mo
      // Production: $99/mo (unlimited builds, 10k updates)
      // Enterprise: Custom

      const plan = data.account?.plan || 'free';
      const builds = data.usage?.builds || 0;
      const updates = data.usage?.updates || 0;

      const planCost = plan === 'production' ? 99 : 0;

      return {
        integrationId: 'expo-global',
        integrationType: 'expo',
        scope: 'global',
        amount: planCost,
        currency: 'USD',
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        billingCycle: 'monthly',
        planName: plan,
        planTier: plan,
        usage: [
          { name: 'Builds', value: builds, unit: 'builds', limit: plan === 'free' ? 30 : undefined },
          { name: 'Updates', value: updates, unit: 'updates', limit: plan === 'free' ? 1 : 10000 },
        ],
        breakdown: {
          base: planCost,
          usage: 0,
          overage: 0,
          addons: 0,
        },
        status: 'active',
        lastUpdated: new Date(),
        apiSource: true,
      };
    } catch (error) {
      console.error('Error fetching Expo costs:', error);
      return {
        integrationId: 'expo-global',
        integrationType: 'expo',
        scope: 'global',
        amount: 99,
        currency: 'USD',
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        billingCycle: 'monthly',
        planName: 'production',
        planTier: 'production',
        usage: [],
        breakdown: { base: 99, usage: 0, overage: 0, addons: 0 },
        status: 'active',
        lastUpdated: new Date(),
        apiSource: false,
      };
    }
  }
}

/**
 * Stripe Payment Processing Cost Tracker (Per-App)
 */
export class StripeCostTracker {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getCosts(applicationId?: string): Promise<IntegrationCostEntry[]> {
    try {
      // Get balance transactions for the current period
      const startOfMonth = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
      
      const response = await fetch(
        `https://api.stripe.com/v1/balance_transactions?created[gte]=${startOfMonth}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Stripe API error: ${response.status}`);
      }

      const data = await response.json();

      // Calculate fees from transactions
      let totalFees = 0;
      let totalVolume = 0;
      let transactionCount = 0;

      for (const txn of data.data || []) {
        if (txn.type === 'charge') {
          totalFees += Math.abs(txn.fee) / 100; // Convert from cents
          totalVolume += txn.amount / 100;
          transactionCount++;
        }
      }

      const entry: IntegrationCostEntry = {
        integrationId: applicationId ? `stripe-${applicationId}` : 'stripe-global',
        integrationType: 'stripe',
        scope: applicationId ? 'application' : 'global',
        applicationId,
        applicationName: applicationId,
        amount: totalFees,
        currency: 'USD',
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        billingCycle: 'usage',
        planName: 'standard',
        planTier: 'standard',
        usage: [
          { name: 'Transaction Volume', value: totalVolume, unit: 'USD' },
          { name: 'Transactions', value: transactionCount, unit: 'transactions' },
          { name: 'Average Fee Rate', value: totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0, unit: '%' },
        ],
        breakdown: {
          base: 0,
          usage: totalFees,
          overage: 0,
          addons: 0,
        },
        status: 'active',
        lastUpdated: new Date(),
        apiSource: true,
      };

      return [entry];
    } catch (error) {
      console.error('Error fetching Stripe costs:', error);
      return [];
    }
  }
}

/**
 * OpenRouter/AI API Cost Tracker (Per-App)
 */
export class OpenRouterCostTracker {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getCosts(applicationId?: string): Promise<IntegrationCostEntry> {
    try {
      // Get usage from OpenRouter
      const response = await fetch(
        'https://openrouter.ai/api/v1/auth/key',
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const usage = data.data?.usage || 0;
      const limit = data.data?.limit || 0;
      const cost = usage; // Usage is in USD

      return {
        integrationId: applicationId ? `openrouter-${applicationId}` : 'openrouter-global',
        integrationType: 'openrouter',
        scope: applicationId ? 'application' : 'global',
        applicationId,
        applicationName: applicationId,
        amount: cost,
        currency: 'USD',
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        billingCycle: 'usage',
        planName: 'pay-as-you-go',
        planTier: 'standard',
        usage: [
          { name: 'API Usage', value: usage, unit: 'USD', limit: limit > 0 ? limit : undefined },
        ],
        breakdown: {
          base: 0,
          usage: cost,
          overage: 0,
          addons: 0,
        },
        status: 'active',
        lastUpdated: new Date(),
        apiSource: true,
      };
    } catch (error) {
      console.error('Error fetching OpenRouter costs:', error);
      return {
        integrationId: 'openrouter-global',
        integrationType: 'openrouter',
        scope: 'global',
        amount: 0,
        currency: 'USD',
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        billingCycle: 'usage',
        planName: 'pay-as-you-go',
        planTier: 'standard',
        usage: [],
        breakdown: { base: 0, usage: 0, overage: 0, addons: 0 },
        status: 'active',
        lastUpdated: new Date(),
        apiSource: false,
      };
    }
  }
}

// ===================================
// Main Integration Cost Manager
// ===================================

export class IntegrationCostManager {
  private configs: Map<IntegrationType, IntegrationConfig> = new Map();
  private cachedCosts: IntegrationCostEntry[] = [];
  private lastFetch: Date | null = null;
  private cacheDurationMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Register an integration for cost tracking
   */
  registerIntegration(config: IntegrationConfig): void {
    this.configs.set(config.type, config);
  }

  /**
   * Get all registered integrations
   */
  getRegisteredIntegrations(): IntegrationConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Fetch all costs (global and per-app)
   */
  async fetchAllCosts(forceRefresh = false): Promise<IntegrationCostEntry[]> {
    if (!forceRefresh && this.lastFetch && Date.now() - this.lastFetch.getTime() < this.cacheDurationMs) {
      return this.cachedCosts;
    }

    const costs: IntegrationCostEntry[] = [];

    for (const [type, config] of this.configs) {
      if (!config.enabled) continue;

      try {
        const typeCosts = await this.fetchCostsForType(type, config);
        costs.push(...typeCosts);
      } catch (error) {
        console.error(`Error fetching costs for ${type}:`, error);
      }
    }

    this.cachedCosts = costs;
    this.lastFetch = new Date();
    return costs;
  }

  private async fetchCostsForType(type: IntegrationType, config: IntegrationConfig): Promise<IntegrationCostEntry[]> {
    switch (type) {
      case 'planetscale':
        if (config.apiKey && config.accountId) {
          const tracker = new PlanetScaleCostTracker(config.apiKey, config.accountId);
          return tracker.getDatabaseCosts();
        }
        break;

      case 'turso':
        if (config.apiKey && config.accountId) {
          const tracker = new TursoCostTracker(config.apiKey, config.accountId);
          return tracker.getDatabaseCosts();
        }
        break;

      case 'clerk':
        if (config.apiKey) {
          const tracker = new ClerkCostTracker(config.apiKey);
          return [await tracker.getCosts()];
        }
        break;

      case 'vercel':
        if (config.apiKey) {
          const tracker = new VercelCostTracker(config.apiKey, config.accountId);
          return tracker.getCosts();
        }
        break;

      case 'expo':
        if (config.apiKey) {
          const tracker = new ExpoCostTracker(config.apiKey);
          return [await tracker.getCosts()];
        }
        break;

      case 'stripe':
        if (config.apiKey) {
          const tracker = new StripeCostTracker(config.apiKey);
          return tracker.getCosts();
        }
        break;

      case 'openrouter':
        if (config.apiKey) {
          const tracker = new OpenRouterCostTracker(config.apiKey);
          return [await tracker.getCosts()];
        }
        break;
    }

    // Return estimated cost if no API available
    if (config.pricing) {
      return [this.createEstimatedCost(type, config)];
    }

    return [];
  }

  private createEstimatedCost(type: IntegrationType, config: IntegrationConfig): IntegrationCostEntry {
    return {
      integrationId: `${type}-estimated`,
      integrationType: type,
      scope: config.scope,
      amount: config.pricing?.baseCost || 0,
      currency: config.pricing?.currency || 'USD',
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      billingCycle: config.pricing?.billingCycle || 'monthly',
      planName: 'estimated',
      planTier: 'unknown',
      usage: [],
      breakdown: {
        base: config.pricing?.baseCost || 0,
        usage: 0,
        overage: 0,
        addons: 0,
      },
      status: 'active',
      lastUpdated: new Date(),
      apiSource: false,
    };
  }

  /**
   * Get global platform costs (services shared across all apps)
   */
  async getGlobalCosts(): Promise<GlobalCostSummary> {
    const allCosts = await this.fetchAllCosts();
    const globalCosts = allCosts.filter(c => c.scope === 'global');

    const byIntegration: GlobalCostSummary['byIntegration'] = {} as any;
    const byCategory: GlobalCostSummary['byCategory'] = {
      databases: 0,
      auth: 0,
      hosting: 0,
      mobile: 0,
      payments: 0,
      ai: 0,
      email: 0,
      analytics: 0,
      messaging: 0,
      storage: 0,
      other: 0,
    };

    let totalMonthly = 0;

    for (const cost of globalCosts) {
      totalMonthly += cost.amount;
      
      byIntegration[cost.integrationType] = {
        name: cost.integrationType,
        amount: cost.amount,
        usage: cost.usage,
        status: cost.status,
      };

      const category = this.getCategory(cost.integrationType);
      byCategory[category] += cost.amount;
    }

    return {
      totalMonthly,
      currency: 'USD',
      byIntegration,
      byCategory,
      trend: {
        previousMonth: totalMonthly * 0.95, // Mock trend
        changePercent: 5,
      },
    };
  }

  /**
   * Get costs for a specific application
   */
  async getApplicationCosts(applicationId: string): Promise<ApplicationIntegrationCosts> {
    const allCosts = await this.fetchAllCosts();
    const appCosts = allCosts.filter(c => 
      c.scope === 'application' && c.applicationId === applicationId
    );

    const byCategory: Record<string, number> = {};
    let totalMonthly = 0;

    for (const cost of appCosts) {
      totalMonthly += cost.amount;
      const category = this.getCategory(cost.integrationType);
      byCategory[category] = (byCategory[category] || 0) + cost.amount;
    }

    return {
      applicationId,
      applicationName: applicationId,
      totalMonthly,
      currency: 'USD',
      integrations: appCosts,
      byCategory,
    };
  }

  /**
   * Get all application costs (for dashboard)
   */
  async getAllApplicationCosts(): Promise<ApplicationIntegrationCosts[]> {
    const allCosts = await this.fetchAllCosts();
    const appCosts = allCosts.filter(c => c.scope === 'application');

    const byApp = new Map<string, IntegrationCostEntry[]>();
    for (const cost of appCosts) {
      const appId = cost.applicationId || 'unknown';
      if (!byApp.has(appId)) {
        byApp.set(appId, []);
      }
      byApp.get(appId)!.push(cost);
    }

    const results: ApplicationIntegrationCosts[] = [];
    for (const [appId, costs] of byApp) {
      const byCategory: Record<string, number> = {};
      let totalMonthly = 0;

      for (const cost of costs) {
        totalMonthly += cost.amount;
        const category = this.getCategory(cost.integrationType);
        byCategory[category] = (byCategory[category] || 0) + cost.amount;
      }

      results.push({
        applicationId: appId,
        applicationName: appId,
        totalMonthly,
        currency: 'USD',
        integrations: costs,
        byCategory,
      });
    }

    return results.sort((a, b) => b.totalMonthly - a.totalMonthly);
  }

  private getCategory(type: IntegrationType): keyof GlobalCostSummary['byCategory'] {
    const categoryMap: Record<IntegrationType, keyof GlobalCostSummary['byCategory']> = {
      planetscale: 'databases',
      turso: 'databases',
      supabase: 'databases',
      neon: 'databases',
      clerk: 'auth',
      vercel: 'hosting',
      expo: 'mobile',
      stripe: 'payments',
      openrouter: 'ai',
      openai: 'ai',
      elevenlabs: 'ai',
      anthropic: 'ai',
      sendgrid: 'email',
      resend: 'email',
      posthog: 'analytics',
      twilio: 'messaging',
      cloudflare: 'storage',
      uploadthing: 'storage',
    };
    return categoryMap[type] || 'other';
  }
}

// Singleton instance
export const integrationCostManager = new IntegrationCostManager();

export default integrationCostManager;

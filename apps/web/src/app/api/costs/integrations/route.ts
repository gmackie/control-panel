/**
 * Integration Costs API
 * 
 * GET /api/costs/integrations - Get all integration costs
 * 
 * Query params:
 * - scope: 'global' | 'application' | 'all' (default: 'all')
 * - applicationId: string (filter by specific app)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { integrationCostManager, IntegrationCostEntry, GlobalCostSummary } from '@/lib/integrations/cost-tracker';

interface IntegrationCostsResponse {
  success: boolean;
  
  // Summary
  summary: {
    totalMonthly: number;
    globalCosts: number;
    applicationCosts: number;
    currency: string;
  };
  
  // Global platform costs
  global: GlobalCostSummary;
  
  // Per-application costs
  applications: Array<{
    applicationId: string;
    applicationName: string;
    totalMonthly: number;
    integrations: IntegrationCostEntry[];
  }>;
  
  // All entries (for detailed view)
  entries: IntegrationCostEntry[];
  
  // Metadata
  lastUpdated: string;
  dataSource: string;
}

// Initialize integrations from environment variables
function initializeIntegrations(): void {
  // Only initialize once
  if (integrationCostManager.getRegisteredIntegrations().length > 0) {
    return;
  }

  // Register integrations based on available env vars
  if (process.env.CLERK_SECRET_KEY) {
    integrationCostManager.registerIntegration({
      type: 'clerk',
      name: 'Clerk Authentication',
      enabled: true,
      scope: 'global',
      apiKey: process.env.CLERK_SECRET_KEY,
    });
  }

  if (process.env.VERCEL_TOKEN) {
    integrationCostManager.registerIntegration({
      type: 'vercel',
      name: 'Vercel Hosting',
      enabled: true,
      scope: 'application',
      apiKey: process.env.VERCEL_TOKEN,
      accountId: process.env.VERCEL_TEAM_ID,
    });
  }

  if (process.env.EXPO_ACCESS_TOKEN) {
    integrationCostManager.registerIntegration({
      type: 'expo',
      name: 'Expo (EAS)',
      enabled: true,
      scope: 'global',
      apiKey: process.env.EXPO_ACCESS_TOKEN,
    });
  }

  if (process.env.STRIPE_SECRET_KEY) {
    integrationCostManager.registerIntegration({
      type: 'stripe',
      name: 'Stripe Payments',
      enabled: true,
      scope: 'application',
      apiKey: process.env.STRIPE_SECRET_KEY,
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    integrationCostManager.registerIntegration({
      type: 'openrouter',
      name: 'OpenRouter AI',
      enabled: true,
      scope: 'application',
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  if (process.env.TURSO_AUTH_TOKEN) {
    integrationCostManager.registerIntegration({
      type: 'turso',
      name: 'Turso Database',
      enabled: true,
      scope: 'application',
      apiKey: process.env.TURSO_AUTH_TOKEN,
      accountId: process.env.TURSO_ORG_SLUG || 'default',
    });
  }

  if (process.env.PLANETSCALE_TOKEN) {
    integrationCostManager.registerIntegration({
      type: 'planetscale',
      name: 'PlanetScale Database',
      enabled: true,
      scope: 'application',
      apiKey: process.env.PLANETSCALE_TOKEN,
      accountId: process.env.PLANETSCALE_ORG || 'default',
    });
  }

  // Add estimated costs for common services without API access
  integrationCostManager.registerIntegration({
    type: 'sendgrid',
    name: 'SendGrid Email',
    enabled: true,
    scope: 'global',
    pricing: {
      baseCost: 14.95,
      currency: 'USD',
      billingCycle: 'monthly',
    },
  });

  integrationCostManager.registerIntegration({
    type: 'posthog',
    name: 'PostHog Analytics',
    enabled: true,
    scope: 'global',
    pricing: {
      baseCost: 0, // Free tier
      currency: 'USD',
      billingCycle: 'monthly',
    },
  });
}

// Generate mock data for demo purposes when APIs aren't configured
function generateMockData(): IntegrationCostsResponse {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const mockEntries: IntegrationCostEntry[] = [
    // Global services
    {
      integrationId: 'clerk-global',
      integrationType: 'clerk',
      scope: 'global',
      amount: 25.00,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'monthly',
      planName: 'Pro',
      planTier: 'pro',
      usage: [
        { name: 'Monthly Active Users', value: 1250, unit: 'users', limit: 10000, percentUsed: 12.5 },
      ],
      breakdown: { base: 25, usage: 0, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
    {
      integrationId: 'expo-global',
      integrationType: 'expo',
      scope: 'global',
      amount: 99.00,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'monthly',
      planName: 'Production',
      planTier: 'production',
      usage: [
        { name: 'Builds', value: 45, unit: 'builds' },
        { name: 'Updates', value: 1200, unit: 'updates', limit: 10000, percentUsed: 12 },
      ],
      breakdown: { base: 99, usage: 0, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
    {
      integrationId: 'sendgrid-global',
      integrationType: 'sendgrid',
      scope: 'global',
      amount: 14.95,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'monthly',
      planName: 'Essentials',
      planTier: 'essentials',
      usage: [
        { name: 'Emails Sent', value: 8500, unit: 'emails', limit: 40000, percentUsed: 21.25 },
      ],
      breakdown: { base: 14.95, usage: 0, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
    {
      integrationId: 'posthog-global',
      integrationType: 'posthog',
      scope: 'global',
      amount: 0,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'monthly',
      planName: 'Free',
      planTier: 'free',
      usage: [
        { name: 'Events', value: 850000, unit: 'events', limit: 1000000, percentUsed: 85 },
      ],
      breakdown: { base: 0, usage: 0, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
    
    // Per-app: control-panel
    {
      integrationId: 'turso-control-panel',
      integrationType: 'turso',
      scope: 'application',
      applicationId: 'control-panel',
      applicationName: 'Control Panel',
      amount: 29.00,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'monthly',
      planName: 'Scaler',
      planTier: 'scaler',
      usage: [
        { name: 'Rows Read', value: 45000000, unit: 'rows' },
        { name: 'Storage', value: 2.5, unit: 'GB', limit: 24, percentUsed: 10.4 },
      ],
      breakdown: { base: 29, usage: 0, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
    {
      integrationId: 'vercel-control-panel',
      integrationType: 'vercel',
      scope: 'application',
      applicationId: 'control-panel',
      applicationName: 'Control Panel',
      amount: 20.00,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'monthly',
      planName: 'Pro',
      planTier: 'pro',
      usage: [
        { name: 'Bandwidth', value: 45.2, unit: 'GB', limit: 1000, percentUsed: 4.5 },
        { name: 'Serverless Hours', value: 125, unit: 'hours', limit: 1000, percentUsed: 12.5 },
      ],
      breakdown: { base: 20, usage: 0, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
    
    // Per-app: mobile-app
    {
      integrationId: 'planetscale-mobile-app',
      integrationType: 'planetscale',
      scope: 'application',
      applicationId: 'mobile-app',
      applicationName: 'Mobile App',
      amount: 39.00,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'monthly',
      planName: 'Scaler Pro',
      planTier: 'scaler_pro',
      usage: [
        { name: 'Rows Read', value: 125000000, unit: 'rows' },
        { name: 'Rows Written', value: 8500000, unit: 'rows' },
        { name: 'Storage', value: 8.2, unit: 'GB', limit: 10, percentUsed: 82 },
      ],
      breakdown: { base: 39, usage: 0, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
    {
      integrationId: 'stripe-mobile-app',
      integrationType: 'stripe',
      scope: 'application',
      applicationId: 'mobile-app',
      applicationName: 'Mobile App',
      amount: 145.80,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'usage',
      planName: 'Standard',
      planTier: 'standard',
      usage: [
        { name: 'Transaction Volume', value: 4860, unit: 'USD' },
        { name: 'Transactions', value: 162, unit: 'transactions' },
        { name: 'Average Fee Rate', value: 3.0, unit: '%' },
      ],
      breakdown: { base: 0, usage: 145.80, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
    {
      integrationId: 'openrouter-mobile-app',
      integrationType: 'openrouter',
      scope: 'application',
      applicationId: 'mobile-app',
      applicationName: 'Mobile App',
      amount: 75.50,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'usage',
      planName: 'Pay as you go',
      planTier: 'payg',
      usage: [
        { name: 'Tokens Used', value: 2500000, unit: 'tokens' },
        { name: 'API Calls', value: 8500, unit: 'calls' },
      ],
      breakdown: { base: 0, usage: 75.50, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },

    // Per-app: web-store
    {
      integrationId: 'supabase-web-store',
      integrationType: 'supabase',
      scope: 'application',
      applicationId: 'web-store',
      applicationName: 'Web Store',
      amount: 25.00,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'monthly',
      planName: 'Pro',
      planTier: 'pro',
      usage: [
        { name: 'Database Size', value: 4.2, unit: 'GB', limit: 8, percentUsed: 52.5 },
        { name: 'Bandwidth', value: 125, unit: 'GB', limit: 250, percentUsed: 50 },
        { name: 'Storage', value: 85, unit: 'GB', limit: 100, percentUsed: 85 },
      ],
      breakdown: { base: 25, usage: 0, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
    {
      integrationId: 'stripe-web-store',
      integrationType: 'stripe',
      scope: 'application',
      applicationId: 'web-store',
      applicationName: 'Web Store',
      amount: 892.40,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'usage',
      planName: 'Standard',
      planTier: 'standard',
      usage: [
        { name: 'Transaction Volume', value: 29747, unit: 'USD' },
        { name: 'Transactions', value: 486, unit: 'transactions' },
        { name: 'Average Fee Rate', value: 3.0, unit: '%' },
      ],
      breakdown: { base: 0, usage: 892.40, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
    {
      integrationId: 'twilio-web-store',
      integrationType: 'twilio',
      scope: 'application',
      applicationId: 'web-store',
      applicationName: 'Web Store',
      amount: 45.60,
      currency: 'USD',
      periodStart,
      periodEnd,
      billingCycle: 'usage',
      planName: 'Pay as you go',
      planTier: 'payg',
      usage: [
        { name: 'SMS Sent', value: 3800, unit: 'messages' },
      ],
      breakdown: { base: 0, usage: 45.60, overage: 0, addons: 0 },
      status: 'active',
      lastUpdated: now,
      apiSource: false,
    },
  ];

  // Calculate summaries
  const globalEntries = mockEntries.filter(e => e.scope === 'global');
  const appEntries = mockEntries.filter(e => e.scope === 'application');

  const globalTotal = globalEntries.reduce((sum, e) => sum + e.amount, 0);
  const appTotal = appEntries.reduce((sum, e) => sum + e.amount, 0);

  // Group by app
  const appGroups = new Map<string, IntegrationCostEntry[]>();
  for (const entry of appEntries) {
    const appId = entry.applicationId || 'unknown';
    if (!appGroups.has(appId)) {
      appGroups.set(appId, []);
    }
    appGroups.get(appId)!.push(entry);
  }

  const applications = Array.from(appGroups.entries()).map(([appId, entries]) => ({
    applicationId: appId,
    applicationName: entries[0]?.applicationName || appId,
    totalMonthly: entries.reduce((sum, e) => sum + e.amount, 0),
    integrations: entries,
  })).sort((a, b) => b.totalMonthly - a.totalMonthly);

  // Build global summary
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

  for (const entry of globalEntries) {
    byIntegration[entry.integrationType] = {
      name: entry.integrationType,
      amount: entry.amount,
      usage: entry.usage,
      status: entry.status,
    };

    // Categorize
    const categoryMap: Record<string, keyof typeof byCategory> = {
      clerk: 'auth',
      expo: 'mobile',
      sendgrid: 'email',
      posthog: 'analytics',
    };
    const cat = categoryMap[entry.integrationType] || 'other';
    byCategory[cat] += entry.amount;
  }

  return {
    success: true,
    summary: {
      totalMonthly: globalTotal + appTotal,
      globalCosts: globalTotal,
      applicationCosts: appTotal,
      currency: 'USD',
    },
    global: {
      totalMonthly: globalTotal,
      currency: 'USD',
      byIntegration,
      byCategory,
      trend: {
        previousMonth: globalTotal * 0.92,
        changePercent: 8.7,
      },
    },
    applications,
    entries: mockEntries,
    lastUpdated: now.toISOString(),
    dataSource: 'mock',
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'all';
    const applicationId = searchParams.get('applicationId');

    // Initialize integrations
    initializeIntegrations();

    // Check if we have any real integrations configured
    const registeredIntegrations = integrationCostManager.getRegisteredIntegrations();
    const hasRealIntegrations = registeredIntegrations.some(i => i.apiKey);

    if (!hasRealIntegrations) {
      // Return mock data for demo
      const mockData = generateMockData();
      
      // Filter by scope if requested
      if (scope === 'global') {
        mockData.applications = [];
        mockData.entries = mockData.entries.filter(e => e.scope === 'global');
      } else if (scope === 'application') {
        mockData.entries = mockData.entries.filter(e => e.scope === 'application');
        if (applicationId) {
          mockData.applications = mockData.applications.filter(a => a.applicationId === applicationId);
          mockData.entries = mockData.entries.filter(e => e.applicationId === applicationId);
        }
      }
      
      return NextResponse.json(mockData);
    }

    // Fetch real data
    const allCosts = await integrationCostManager.fetchAllCosts();
    const globalCosts = await integrationCostManager.getGlobalCosts();
    const appCosts = await integrationCostManager.getAllApplicationCosts();

    let filteredEntries = allCosts;
    let filteredApps = appCosts;

    if (scope === 'global') {
      filteredEntries = allCosts.filter(c => c.scope === 'global');
      filteredApps = [];
    } else if (scope === 'application') {
      filteredEntries = allCosts.filter(c => c.scope === 'application');
      if (applicationId) {
        filteredEntries = filteredEntries.filter(c => c.applicationId === applicationId);
        filteredApps = appCosts.filter(a => a.applicationId === applicationId);
      }
    }

    const globalTotal = allCosts.filter(c => c.scope === 'global').reduce((sum, c) => sum + c.amount, 0);
    const appTotal = allCosts.filter(c => c.scope === 'application').reduce((sum, c) => sum + c.amount, 0);

    const response: IntegrationCostsResponse = {
      success: true,
      summary: {
        totalMonthly: globalTotal + appTotal,
        globalCosts: globalTotal,
        applicationCosts: appTotal,
        currency: 'USD',
      },
      global: globalCosts,
      applications: filteredApps.map(a => ({
        applicationId: a.applicationId,
        applicationName: a.applicationName,
        totalMonthly: a.totalMonthly,
        integrations: a.integrations,
      })),
      entries: filteredEntries,
      lastUpdated: new Date().toISOString(),
      dataSource: 'api',
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching integration costs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch integration costs' },
      { status: 500 }
    );
  }
}

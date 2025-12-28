import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { costManager, CostPeriod } from '@/lib/cost-tracking/cost-manager';
import { z } from 'zod';

const CreateCostEntrySchema = z.object({
  provider: z.enum(['hetzner', 'aws', 'gcp', 'azure', 'other']),
  category: z.enum(['compute', 'storage', 'network', 'database', 'monitoring', 'backup', 'other']),
  application: z.string().optional(),
  namespace: z.string().optional(),
  resource: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
});

interface CostData {
  provider: string;
  service: string;
  category: 'compute' | 'storage' | 'network' | 'database' | 'api' | 'other';
  amount: number;
  usage: number;
  unit: string;
  period: Date;
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
}

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  alertThreshold: number;
  status: 'under' | 'warning' | 'over';
  services: string[];
  notifications?: {
    email: boolean;
    sms: boolean;
    webhook: boolean;
  };
}

interface Forecast {
  period: string;
  projected: number;
  confidence: number;
  basedOn: string;
}

const generateCostData = (period: string): CostData[] => {
  const now = new Date();
  const baseData = [
    {
      provider: 'Hetzner',
      service: 'VPS Hosting',
      category: 'compute' as const,
      amount: 89.50,
      usage: 4,
      unit: 'servers',
      trend: 'stable' as const,
      percentChange: 0
    },
    {
      provider: 'Hetzner',
      service: 'Storage',
      category: 'storage' as const,
      amount: 25.30,
      usage: 500,
      unit: 'GB',
      trend: 'up' as const,
      percentChange: 12
    },
    {
      provider: 'Cloudflare',
      service: 'CDN & DNS',
      category: 'network' as const,
      amount: 20.00,
      usage: 1000000,
      unit: 'requests',
      trend: 'down' as const,
      percentChange: -5
    },
    {
      provider: 'Turso',
      service: 'Database',
      category: 'database' as const,
      amount: 29.00,
      usage: 50,
      unit: 'GB',
      trend: 'up' as const,
      percentChange: 8
    },
    {
      provider: 'Stripe',
      service: 'Payment Processing',
      category: 'api' as const,
      amount: 145.80,
      usage: 486,
      unit: 'transactions',
      trend: 'up' as const,
      percentChange: 25
    },
    {
      provider: 'SendGrid',
      service: 'Email Service',
      category: 'api' as const,
      amount: 14.95,
      usage: 15000,
      unit: 'emails',
      trend: 'stable' as const,
      percentChange: 2
    },
    {
      provider: 'OpenRouter',
      service: 'AI API',
      category: 'api' as const,
      amount: 75.00,
      usage: 500000,
      unit: 'tokens',
      trend: 'up' as const,
      percentChange: 35
    },
    {
      provider: 'Twilio',
      service: 'SMS Service',
      category: 'api' as const,
      amount: 8.50,
      usage: 850,
      unit: 'messages',
      trend: 'down' as const,
      percentChange: -10
    }
  ];

  // Adjust amounts based on period
  const multiplier = period === 'yearly' ? 12 : period === 'quarterly' ? 3 : period === 'weekly' ? 0.25 : 1;
  
  return baseData.map(item => ({
    ...item,
    amount: item.amount * multiplier,
    period: now
  }));
};

const generateBudgets = (): Budget[] => {
  return [
    {
      id: 'budget-001',
      name: 'Infrastructure',
      amount: 200,
      spent: 134.80,
      period: 'monthly',
      alertThreshold: 80,
      status: 'under',
      services: ['Hetzner', 'Cloudflare'],
      notifications: {
        email: true,
        sms: false,
        webhook: true
      }
    },
    {
      id: 'budget-002',
      name: 'Third-party APIs',
      amount: 300,
      spent: 273.25,
      period: 'monthly',
      alertThreshold: 90,
      status: 'warning',
      services: ['Stripe', 'SendGrid', 'OpenRouter', 'Twilio'],
      notifications: {
        email: true,
        sms: true,
        webhook: true
      }
    },
    {
      id: 'budget-003',
      name: 'Database & Storage',
      amount: 100,
      spent: 54.30,
      period: 'monthly',
      alertThreshold: 75,
      status: 'under',
      services: ['Turso', 'Hetzner Storage'],
      notifications: {
        email: true,
        sms: false,
        webhook: false
      }
    }
  ];
};

const generateForecasts = (): Forecast[] => {
  return [
    {
      period: 'Next Month',
      projected: 465.50,
      confidence: 85,
      basedOn: '3-month trend'
    },
    {
      period: 'Q2 2024',
      projected: 1450.00,
      confidence: 75,
      basedOn: '6-month average'
    },
    {
      period: 'End of Year',
      projected: 5800.00,
      confidence: 65,
      basedOn: 'YTD growth rate'
    }
  ];
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as CostPeriod) || 'monthly';
    const provider = searchParams.get('provider');
    const category = searchParams.get('category');
    const application = searchParams.get('application');
    const includeAnalytics = searchParams.get('analytics') === 'true';
    const includeRecommendations = searchParams.get('recommendations') === 'true';
    const includeBudgets = searchParams.get('budgets') === 'true';

    // Mock cost data
    let costs = [
      {
        id: 'cost_1',
        date: new Date().toISOString(),
        amount: 123.45,
        category: 'compute',
        provider: 'hetzner',
        application: 'control-panel',
        description: 'VPS hosting costs'
      },
      {
        id: 'cost_2',
        date: new Date().toISOString(),
        amount: 56.78,
        category: 'storage',
        provider: 'hetzner',
        application: 'database',
        description: 'Storage costs'
      }
    ];

    // Apply filters
    if (provider) {
      costs = costs.filter(cost => cost.provider === provider);
    }
    if (category) {
      costs = costs.filter(cost => cost.category === category);
    }
    if (application) {
      costs = costs.filter(cost => cost.application === application);
    }

    const response: any = {
      success: true,
      costs,
      period,
      total: costs.length,
      lastUpdated: new Date().toISOString()
    };

    if (includeAnalytics) {
      response.analytics = costManager.getCostAnalytics(period);
    }

    if (includeRecommendations) {
      response.recommendations = [
        { id: 'rec_1', type: 'rightsizing', estimatedSavings: 120.50 },
        { id: 'rec_2', type: 'scheduling', estimatedSavings: 85.30 }
      ];
    }

    if (includeBudgets) {
      response.budgets = [
        { id: 'budget_1', name: 'Monthly Infrastructure', amount: 1000, spent: 800 },
        { id: 'budget_2', name: 'Development Costs', amount: 500, spent: 300 }
      ];
    }

    // Legacy compatibility - keep existing mock data structure
    const legacyCosts = generateCostData(period);
    const legacyBudgets = generateBudgets();
    const legacyForecasts = generateForecasts();

    response.legacy = {
      costs: legacyCosts,
      budgets: legacyBudgets,
      forecasts: legacyForecasts,
      summary: {
        totalCost: legacyCosts.reduce((sum, cost) => sum + cost.amount, 0),
        costByProvider: legacyCosts.reduce((acc, cost) => {
          acc[cost.provider] = (acc[cost.provider] || 0) + cost.amount;
          return acc;
        }, {} as Record<string, number>),
        period
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching cost data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cost data' },
      { status: 500 }
    );
  }
}

// POST /api/costs - Create a new cost entry
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const costData = CreateCostEntrySchema.parse(body);

    // Mock add cost entry
    const costEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      period: 'monthly',
      service: 'infrastructure',
      resourceType: 'compute',
      resourceId: 'resource-' + Math.random().toString(36).substring(7),
      ...costData,
    };

    return NextResponse.json({
      success: true,
      costEntry,
      message: 'Cost entry created successfully'
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid cost data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating cost entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create cost entry' },
      { status: 500 }
    );
  }
}

// Mock initialization function (simplified to avoid API mismatch)
async function initializeMockCostData() {
  // This would normally initialize cost data with the cost manager
  // but we're using static mock data above to avoid API schema mismatches
  console.log('Mock cost data initialization skipped');

  // Budget creation also skipped to avoid schema mismatch
}
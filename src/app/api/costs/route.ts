import { NextRequest, NextResponse } from "next/server";

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
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly';
    
    const costs = generateCostData(period);
    const budgets = generateBudgets();
    const forecasts = generateForecasts();

    // Calculate summary statistics
    const totalCost = costs.reduce((sum, cost) => sum + cost.amount, 0);
    const costByProvider = costs.reduce((acc, cost) => {
      acc[cost.provider] = (acc[cost.provider] || 0) + cost.amount;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      costs,
      budgets,
      forecasts,
      summary: {
        totalCost,
        costByProvider,
        period
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching cost data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cost data' },
      { status: 500 }
    );
  }
}
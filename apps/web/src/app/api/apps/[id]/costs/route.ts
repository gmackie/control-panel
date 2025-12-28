/**
 * Per-Application Cost API
 * 
 * GET /api/apps/[id]/costs - Get comprehensive cost breakdown for an application
 * 
 * Query params:
 * - period: 'daily' | 'monthly' | 'yearly' (default: 'monthly')
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - includeProjection: boolean (default: false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createEnhancedHetznerClient } from '@/lib/hetzner/enhanced-client';
import { createAWSClient } from '@/lib/aws/client';

interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

interface ResourceCostDetail {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  provider: string;
  monthlyRate: number;
  dailyRate: number;
  category: string;
  environment?: string;
}

interface ApplicationCostResponse {
  applicationId: string;
  applicationName: string;
  
  // Summary
  totalMonthly: number;
  totalDaily: number;
  totalYearly: number;
  currency: string;
  
  // Breakdowns
  byProvider: Record<string, number>;
  byCategory: CostBreakdown[];
  byEnvironment: Record<string, number>;
  byResourceType: Record<string, number>;
  
  // Detailed resources
  resources: ResourceCostDetail[];
  
  // Trends
  trend: {
    currentMonth: number;
    previousMonth: number;
    changePercent: number;
    direction: 'up' | 'down' | 'stable';
  };
  
  // Projections
  projection?: {
    nextMonth: number;
    nextQuarter: number;
    confidence: number;
  };
  
  // Third-party service costs
  integrationCosts: {
    provider: string;
    service: string;
    monthlyAmount: number;
    usageDescription: string;
  }[];
  
  // Budget status
  budget?: {
    amount: number;
    spent: number;
    remaining: number;
    percentUsed: number;
    status: 'under' | 'warning' | 'over';
  };
  
  // Metadata
  lastUpdated: string;
  dataSource: string[];
}

// Mock integration costs for demo
function getMockIntegrationCosts(appName: string): ApplicationCostResponse['integrationCosts'] {
  // Simulate different costs based on app name
  const baseCosts = [
    {
      provider: 'Stripe',
      service: 'Payment Processing',
      monthlyAmount: 45.80,
      usageDescription: '153 transactions @ 2.9% + $0.30',
    },
    {
      provider: 'Turso',
      service: 'Database',
      monthlyAmount: 29.00,
      usageDescription: 'Pro plan - 50GB storage',
    },
    {
      provider: 'OpenRouter',
      service: 'AI API',
      monthlyAmount: 25.50,
      usageDescription: '~250k tokens',
    },
    {
      provider: 'SendGrid',
      service: 'Email',
      monthlyAmount: 14.95,
      usageDescription: '~15,000 emails',
    },
  ];

  // Vary costs slightly by app
  const multiplier = (appName.length % 3) * 0.3 + 0.7;
  return baseCosts.map(cost => ({
    ...cost,
    monthlyAmount: parseFloat((cost.monthlyAmount * multiplier).toFixed(2)),
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = id;
    const { searchParams } = new URL(request.url);
    const _period = searchParams.get('period') || 'monthly'; // Reserved for future use
    const includeProjection = searchParams.get('includeProjection') === 'true';

    // Initialize response
    const response: ApplicationCostResponse = {
      applicationId,
      applicationName: applicationId, // Will be updated from app data
      totalMonthly: 0,
      totalDaily: 0,
      totalYearly: 0,
      currency: 'USD',
      byProvider: {},
      byCategory: [],
      byEnvironment: {},
      byResourceType: {},
      resources: [],
      trend: {
        currentMonth: 0,
        previousMonth: 0,
        changePercent: 0,
        direction: 'stable',
      },
      integrationCosts: [],
      lastUpdated: new Date().toISOString(),
      dataSource: [],
    };

    // Fetch from Hetzner
    const hetznerClient = createEnhancedHetznerClient();
    if (hetznerClient) {
      try {
        const appCost = await hetznerClient.getApplicationCost(applicationId);
        
        if (appCost.resources.length > 0) {
          response.dataSource.push('hetzner');
          response.byProvider['Hetzner'] = appCost.totalMonthlyCost;
          response.totalMonthly += appCost.totalMonthlyCost;
          
          // Add resources
          for (const resource of appCost.resources) {
            response.resources.push({
              resourceId: resource.resourceId.toString(),
              resourceName: resource.resourceName,
              resourceType: resource.resourceType,
              provider: 'Hetzner',
              monthlyRate: resource.monthlyGross,
              dailyRate: resource.monthlyGross / 30,
              category: getCategoryFromType(resource.resourceType),
              environment: resource.environment,
            });
            
            // Aggregate by type
            response.byResourceType[resource.resourceType] = 
              (response.byResourceType[resource.resourceType] || 0) + resource.monthlyGross;
            
            // Aggregate by environment
            if (resource.environment) {
              response.byEnvironment[resource.environment] = 
                (response.byEnvironment[resource.environment] || 0) + resource.monthlyGross;
            }
          }
          
          // Add category breakdown
          for (const [type, amount] of Object.entries(appCost.byResourceType)) {
            response.byCategory.push({
              category: getCategoryFromType(type),
              amount,
              percentage: (amount / appCost.totalMonthlyCost) * 100,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching Hetzner costs:', error);
      }
    }

    // Fetch from AWS
    const awsClient = createAWSClient();
    if (awsClient) {
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const awsCosts = await awsClient.getCostsByApplication(startOfMonth, endOfMonth);
        const appAWSCost = awsCosts.find(c => c.application === applicationId);
        
        if (appAWSCost) {
          response.dataSource.push('aws');
          response.byProvider['AWS'] = appAWSCost.cost;
          response.totalMonthly += appAWSCost.cost;
          
          for (const service of appAWSCost.services) {
            response.resources.push({
              resourceId: `aws-${service.service.toLowerCase().replace(/\s+/g, '-')}`,
              resourceName: service.service,
              resourceType: 'aws-service',
              provider: 'AWS',
              monthlyRate: service.cost,
              dailyRate: service.cost / 30,
              category: getAWSServiceCategory(service.service),
            });
            
            response.byResourceType[service.service] = 
              (response.byResourceType[service.service] || 0) + service.cost;
          }
        }
      } catch (error) {
        console.error('Error fetching AWS costs:', error);
      }
    }

    // Add integration costs (third-party services)
    response.integrationCosts = getMockIntegrationCosts(applicationId);
    const integrationTotal = response.integrationCosts.reduce((sum, ic) => sum + ic.monthlyAmount, 0);
    response.byProvider['Third-party Services'] = integrationTotal;
    response.totalMonthly += integrationTotal;

    // Calculate derived values
    response.totalDaily = response.totalMonthly / 30;
    response.totalYearly = response.totalMonthly * 12;

    // Recalculate category percentages
    if (response.totalMonthly > 0) {
      response.byCategory = response.byCategory.map(cat => ({
        ...cat,
        percentage: (cat.amount / response.totalMonthly) * 100,
      }));
    }

    // Calculate trend (mock for now - would query historical data)
    const previousMonthCost = response.totalMonthly * (0.85 + Math.random() * 0.3);
    response.trend = {
      currentMonth: response.totalMonthly,
      previousMonth: previousMonthCost,
      changePercent: ((response.totalMonthly - previousMonthCost) / previousMonthCost) * 100,
      direction: response.totalMonthly > previousMonthCost ? 'up' : 
                 response.totalMonthly < previousMonthCost ? 'down' : 'stable',
    };

    // Add projection if requested
    if (includeProjection) {
      const growthRate = 1 + (response.trend.changePercent / 100);
      response.projection = {
        nextMonth: response.totalMonthly * growthRate,
        nextQuarter: response.totalMonthly * Math.pow(growthRate, 3),
        confidence: 0.75,
      };
    }

    // Mock budget status
    response.budget = {
      amount: 500,
      spent: response.totalMonthly,
      remaining: Math.max(0, 500 - response.totalMonthly),
      percentUsed: (response.totalMonthly / 500) * 100,
      status: response.totalMonthly > 500 ? 'over' : 
              response.totalMonthly > 400 ? 'warning' : 'under',
    };

    // Add data source info
    if (response.dataSource.length === 0) {
      response.dataSource.push('mock');
    }

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error('Error fetching application costs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch application costs' },
      { status: 500 }
    );
  }
}

// Helper functions
function getCategoryFromType(resourceType: string): string {
  const categoryMap: Record<string, string> = {
    server: 'compute',
    volume: 'storage',
    load_balancer: 'network',
    floating_ip: 'network',
    snapshot: 'storage',
    network: 'network',
    database: 'database',
  };
  return categoryMap[resourceType] || 'other';
}

function getAWSServiceCategory(service: string): string {
  const serviceLower = service.toLowerCase();
  if (serviceLower.includes('ec2') || serviceLower.includes('lambda') || serviceLower.includes('ecs')) {
    return 'compute';
  }
  if (serviceLower.includes('s3') || serviceLower.includes('ebs') || serviceLower.includes('glacier')) {
    return 'storage';
  }
  if (serviceLower.includes('rds') || serviceLower.includes('dynamodb') || serviceLower.includes('redshift')) {
    return 'database';
  }
  if (serviceLower.includes('cloudfront') || serviceLower.includes('vpc') || serviceLower.includes('elb')) {
    return 'network';
  }
  if (serviceLower.includes('sqs') || serviceLower.includes('sns') || serviceLower.includes('ses')) {
    return 'messaging';
  }
  if (serviceLower.includes('iot')) {
    return 'iot';
  }
  return 'other';
}

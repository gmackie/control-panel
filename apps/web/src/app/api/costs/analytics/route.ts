import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { costManager, CostPeriod } from '@/lib/cost-tracking/cost-manager';

// GET /api/costs/analytics - Get comprehensive cost analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as CostPeriod) || 'monthly';
    const includeForecasts = searchParams.get('forecasts') === 'true';
    const includeTrends = searchParams.get('trends') === 'true';
    const includeComparisons = searchParams.get('comparisons') === 'true';

    // Get core analytics
    const analytics = costManager.getCostAnalytics(period);
    
    const response: any = {
      success: true,
      period,
      analytics,
      lastUpdated: new Date().toISOString()
    };

    // Add placeholder data for trends if requested
    if (includeTrends) {
      const trends = {
        monthly: { trend: 'increasing', changePercent: 15, data: [] },
        weekly: { trend: 'stable', changePercent: 2, data: [] },
        daily: { trend: 'decreasing', changePercent: -5, data: [] }
      };
      response.trends = trends;
    }

    // Add placeholder forecasts if requested
    if (includeForecasts) {
      const forecasts = {
        nextMonth: { projected: 520, confidence: 85 },
        nextQuarter: { projected: 1650, confidence: 75 },
        nextYear: { projected: 6800, confidence: 65 }
      };
      response.forecasts = forecasts;
    }

    // Add placeholder comparisons if requested
    if (includeComparisons) {
      const comparisons = {
        monthOverMonth: { change: 12.5, direction: 'increase' },
        quarterOverQuarter: { change: 8.2, direction: 'increase' },
        yearOverYear: { change: 25.7, direction: 'increase' }
      };
      response.comparisons = comparisons;
    }

    // Additional insights
    response.insights = {
      topCostDrivers: [
        { name: 'Compute', cost: 234.50, percentage: 45 },
        { name: 'Storage', cost: 156.30, percentage: 30 },
        { name: 'Network', cost: 89.20, percentage: 17 },
        { name: 'Database', cost: 41.75, percentage: 8 }
      ],
      unusualSpending: [],
      efficiencyScore: 78,
      totalOptimizationPotential: 145.30
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching cost analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cost analytics' },
      { status: 500 }
    );
  }
}

// POST /api/costs/analytics/report - Generate detailed cost report
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      period = 'monthly',
      startDate,
      endDate,
      groupBy = ['provider', 'category'],
      includeRecommendations = true,
      format = 'json' // json, csv, pdf
    } = body;

    // Generate comprehensive report (placeholder implementation)
    const report = {
      period,
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: endDate || new Date(),
      groupBy,
      includeRecommendations,
      format,
      data: format === 'csv' ? 'Provider,Category,Cost\nHetzner,Compute,234.50\nHetzner,Storage,156.30' : {
        totalCost: 521.80,
        breakdown: { compute: 234.50, storage: 156.30, network: 89.20, database: 41.75 },
        recommendations: includeRecommendations ? [] : []
      }
    };

    if (format === 'csv') {
      return new NextResponse(report.data as string, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="cost-report-${period}-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      report,
      generatedAt: new Date().toISOString(),
      format
    });
  } catch (error) {
    console.error('Error generating cost report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate cost report' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { costManager } from '@/lib/cost-tracking/cost-manager';
import { z } from 'zod';

const ImplementRecommendationSchema = z.object({
  recommendationId: z.string(),
  notes: z.string().optional(),
});

// GET /api/costs/recommendations - Get cost optimization recommendations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'rightsizing', 'unused_resources', 'storage_optimization'
    const impact = searchParams.get('impact'); // 'high', 'medium', 'low'
    const includeImplemented = searchParams.get('include_implemented') === 'true';

    // Mock optimization recommendations
    let recommendations = [
      {
        id: 'rec_1',
        type: 'rightsizing',
        category: 'compute',
        severity: 'high',
        impact: 'high',
        title: 'Right-size over-provisioned instances',
        description: 'Several instances are running at low CPU utilization',
        estimatedSavings: 120.50,
        effort: 'low',
        implemented: false
      },
      {
        id: 'rec_2',
        type: 'scheduling',
        category: 'compute',
        severity: 'medium',
        impact: 'medium',
        title: 'Schedule non-production workloads',
        description: 'Development and staging environments can be scheduled',
        estimatedSavings: 85.30,
        effort: 'medium',
        implemented: false
      }
    ];

    // Apply filters
    if (type) {
      recommendations = recommendations.filter(rec => rec.type === type);
    }

    if (impact) {
      recommendations = recommendations.filter(rec => rec.impact === impact);
    }

    if (!includeImplemented) {
      recommendations = recommendations.filter(rec => !rec.implemented);
    }

    // Calculate potential savings
    const totalPotentialSavings = recommendations
      .filter(rec => !rec.implemented)
      .reduce((sum, rec) => sum + rec.estimatedSavings, 0);

    const alreadySaved = recommendations
      .filter(rec => rec.implemented)
      .reduce((sum, rec) => sum + rec.estimatedSavings, 0);

    // Group by category for analytics
    const byCategory = recommendations.reduce((acc, rec) => {
      if (!acc[rec.type]) {
        acc[rec.type] = { count: 0, savings: 0 };
      }
      acc[rec.type].count++;
      if (!rec.implemented) {
        acc[rec.type].savings += rec.estimatedSavings;
      }
      return acc;
    }, {} as Record<string, { count: number; savings: number }>);

    return NextResponse.json({
      success: true,
      recommendations,
      analytics: {
        totalRecommendations: recommendations.length,
        pendingRecommendations: recommendations.filter(r => !r.implemented).length,
        totalPotentialSavings,
        alreadySaved,
        byCategory,
        byImpact: {
          high: recommendations.filter(r => r.impact === 'high').length,
          medium: recommendations.filter(r => r.impact === 'medium').length,
          low: recommendations.filter(r => r.impact === 'low').length,
        }
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

// POST /api/costs/recommendations - Implement a recommendation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recommendationId, notes } = ImplementRecommendationSchema.parse(body);

    // Mock implement recommendation
    const success = true;

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Recommendation not found or already implemented' },
        { status: 404 }
      );
    }

    // Mock get recommendation
    const recommendation = {
      id: recommendationId,
      title: 'Cost Optimization Recommendation',
      implemented: true,
      implementedBy: 'graeme@gmac.io',
      implementedAt: new Date(),
      notes: notes || 'Implemented successfully'
    };

    return NextResponse.json({
      success: true,
      recommendation,
      message: 'Recommendation marked as implemented successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error implementing recommendation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to implement recommendation' },
      { status: 500 }
    );
  }
}

// PUT /api/costs/recommendations - Refresh recommendations (regenerate)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Mock refresh optimization recommendations
    const recommendations = [
      {
        id: 'rec_1',
        type: 'rightsizing',
        estimatedSavings: 120.50,
        implemented: false
      },
      {
        id: 'rec_2', 
        type: 'scheduling',
        estimatedSavings: 85.30,
        implemented: false
      }
    ];
    const totalPotentialSavings = recommendations
      .filter(rec => !rec.implemented)
      .reduce((sum, rec) => sum + rec.estimatedSavings, 0);

    return NextResponse.json({
      success: true,
      recommendations,
      totalRecommendations: recommendations.length,
      totalPotentialSavings,
      message: 'Recommendations refreshed successfully',
      refreshedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh recommendations' },
      { status: 500 }
    );
  }
}
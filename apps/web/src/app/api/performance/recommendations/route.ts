import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { performanceOptimizer } from '@/lib/performance/performance-optimizer';
import { z } from 'zod';

const ImplementRecommendationSchema = z.object({
  recommendationId: z.string(),
  notes: z.string().optional(),
});

// GET /api/performance/recommendations - Get performance optimization recommendations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeStats = searchParams.get('stats') === 'true';

    const recommendations = performanceOptimizer.getOptimizationRecommendations({
      priority: priority || undefined,
      status: status || undefined,
      category: category || undefined,
      limit,
    });

    const response: any = {
      success: true,
      recommendations,
      total: recommendations.length,
      lastUpdated: new Date().toISOString(),
    };

    if (includeStats) {
      response.statistics = performanceOptimizer.getPerformanceStatistics().recommendations;
    }

    // Add summary analytics
    response.summary = {
      total: recommendations.length,
      pending: recommendations.filter(r => r.status === 'pending').length,
      implemented: recommendations.filter(r => r.status === 'completed').length,
      byPriority: {
        critical: recommendations.filter(r => r.priority === 'critical').length,
        high: recommendations.filter(r => r.priority === 'high').length,
        medium: recommendations.filter(r => r.priority === 'medium').length,
        low: recommendations.filter(r => r.priority === 'low').length,
      },
      byCategory: [
        'resource_allocation', 'scaling', 'caching', 'database', 
        'network', 'application_code', 'infrastructure'
      ].reduce((acc, category) => {
        acc[category] = recommendations.filter(r => r.category === category).length;
        return acc;
      }, {} as Record<string, number>),
      potentialSavings: recommendations
        .filter(r => r.status === 'pending')
        .reduce((sum, r) => sum + (r.impact.cost > 0 ? r.impact.cost : 0), 0),
      estimatedPerformanceGain: recommendations
        .filter(r => r.status === 'pending')
        .reduce((sum, r) => sum + r.impact.performance, 0) / Math.max(1, recommendations.filter(r => r.status === 'pending').length),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching performance recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance recommendations' },
      { status: 500 }
    );
  }
}

// POST /api/performance/recommendations - Implement a recommendation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recommendationId, notes } = ImplementRecommendationSchema.parse(body);

    const success = await performanceOptimizer.implementRecommendation(
      recommendationId,
      session.user.email || 'unknown'
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Recommendation not found or cannot be implemented' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Recommendation implemented successfully',
      implementedBy: session.user.email,
      implementedAt: new Date().toISOString(),
      notes,
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

// PUT /api/performance/recommendations - Bulk update recommendation status
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recommendationIds, action, notes } = body;

    if (!Array.isArray(recommendationIds) || recommendationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Recommendation IDs array is required' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    for (const recommendationId of recommendationIds) {
      try {
        let success = false;

        switch (action) {
          case 'implement':
            success = await performanceOptimizer.implementRecommendation(
              recommendationId,
              session.user.email || 'unknown'
            );
            break;
          
          case 'dismiss':
            // In a real implementation, you'd have a dismiss method
            success = true;
            break;
          
          case 'approve':
            // In a real implementation, you'd have an approve method
            success = true;
            break;
          
          default:
            errors.push({ recommendationId, error: 'Invalid action' });
            continue;
        }

        if (success) {
          results.push({ recommendationId, status: 'updated' });
        } else {
          errors.push({ recommendationId, error: 'Update failed' });
        }
      } catch (error) {
        errors.push({ recommendationId, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      updated: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${results.length} recommendations${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      updatedBy: session.user.email,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error bulk updating recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to bulk update recommendations' },
      { status: 500 }
    );
  }
}
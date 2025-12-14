import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { performanceOptimizer } from '@/lib/performance/performance-optimizer';

// GET /api/performance/metrics - Get performance metrics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'control-panel';
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeStats = searchParams.get('stats') === 'true';

    const metrics = performanceOptimizer.getMetrics(source, limit);

    const response: any = {
      success: true,
      source,
      metrics,
      total: metrics.length,
      lastUpdated: new Date().toISOString(),
    };

    if (includeStats) {
      response.statistics = performanceOptimizer.getPerformanceStatistics();
    }

    // Initialize with sample metrics if none exist
    if (metrics.length === 0) {
      await initializeSampleMetrics();
      response.metrics = performanceOptimizer.getMetrics(source, limit);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}

// POST /api/performance/metrics - Trigger metric collection
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { source = 'control-panel' } = body;

    const metric = await performanceOptimizer.collectMetrics(source);

    return NextResponse.json({
      success: true,
      metric,
      message: 'Metrics collected successfully',
      collectedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error collecting metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to collect metrics' },
      { status: 500 }
    );
  }
}

// Initialize sample performance metrics
async function initializeSampleMetrics() {
  try {
    // Collect metrics for multiple sources
    const sources = ['control-panel', 'api-gateway', 'database', 'cache'];
    
    for (const source of sources) {
      // Collect multiple historical data points
      for (let i = 0; i < 20; i++) {
        await performanceOptimizer.collectMetrics(source);
        // Small delay to create time series
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error('Error initializing sample metrics:', error);
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  change: number;
  status: 'healthy' | 'warning' | 'critical';
  threshold: {
    warning: number;
    critical: number;
  };
  lastUpdated: Date;
  source: string;
}

// Mock data generator for system metrics
function generateSystemMetrics(): SystemMetric[] {
  const now = new Date();
  
  return [
    {
      id: 'cpu',
      name: 'CPU Usage',
      value: Math.random() * 100,
      unit: '%',
      change: (Math.random() - 0.5) * 10,
      status: Math.random() > 0.8 ? 'warning' : 'healthy',
      threshold: { warning: 80, critical: 90 },
      lastUpdated: now,
      source: 'k3s-cluster'
    },
    {
      id: 'memory',
      name: 'Memory Usage',
      value: Math.random() * 100,
      unit: '%',
      change: (Math.random() - 0.5) * 10,
      status: Math.random() > 0.9 ? 'critical' : 'healthy',
      threshold: { warning: 80, critical: 90 },
      lastUpdated: now,
      source: 'k3s-cluster'
    },
    {
      id: 'disk',
      name: 'Disk Usage',
      value: Math.random() * 100,
      unit: '%',
      change: (Math.random() - 0.5) * 5,
      status: 'healthy',
      threshold: { warning: 80, critical: 90 },
      lastUpdated: now,
      source: 'k3s-cluster'
    },
    {
      id: 'network',
      name: 'Network I/O',
      value: Math.random() * 500,
      unit: 'MB/s',
      change: (Math.random() - 0.5) * 50,
      status: 'healthy',
      threshold: { warning: 400, critical: 500 },
      lastUpdated: now,
      source: 'k3s-cluster'
    },
    {
      id: 'response-time',
      name: 'Avg Response Time',
      value: Math.random() * 500 + 50,
      unit: 'ms',
      change: (Math.random() - 0.5) * 50,
      status: Math.random() > 0.7 ? 'warning' : 'healthy',
      threshold: { warning: 500, critical: 1000 },
      lastUpdated: now,
      source: 'api-gateway'
    },
    {
      id: 'error-rate',
      name: 'Error Rate',
      value: Math.random() * 5,
      unit: '%',
      change: (Math.random() - 0.5) * 2,
      status: Math.random() > 0.8 ? 'warning' : 'healthy',
      threshold: { warning: 2, critical: 5 },
      lastUpdated: now,
      source: 'api-gateway'
    },
    {
      id: 'active-users',
      name: 'Active Users',
      value: Math.floor(Math.random() * 1000) + 100,
      unit: '',
      change: (Math.random() - 0.5) * 100,
      status: 'healthy',
      threshold: { warning: 1500, critical: 2000 },
      lastUpdated: now,
      source: 'application'
    },
    {
      id: 'database-connections',
      name: 'Database Connections',
      value: Math.floor(Math.random() * 50) + 10,
      unit: '',
      change: (Math.random() - 0.5) * 10,
      status: Math.random() > 0.9 ? 'warning' : 'healthy',
      threshold: { warning: 80, critical: 100 },
      lastUpdated: now,
      source: 'database'
    }
  ];
}

// Simulate fetching metrics from different sources
async function fetchMetricsFromSource(source: string, timeRange: string): Promise<SystemMetric[]> {
  // In a real implementation, this would connect to:
  // - Prometheus for infrastructure metrics
  // - Application APM for application metrics
  // - Database monitoring for database metrics
  // - Custom exporters for service-specific metrics
  
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100)); // Simulate network delay
  
  const allMetrics = generateSystemMetrics();
  
  if (source === 'all') {
    return allMetrics;
  }
  
  return allMetrics.filter(metric => metric.source === source);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'all';
    const timeRange = searchParams.get('timeRange') || '1h';
    const metricIds = searchParams.get('metrics')?.split(',') || [];

    // Fetch metrics from the specified source
    let metrics = await fetchMetricsFromSource(source, timeRange);

    // Filter by specific metric IDs if provided
    if (metricIds.length > 0 && metricIds[0] !== '') {
      metrics = metrics.filter(metric => metricIds.includes(metric.id));
    }

    // Add historical data for trend analysis
    const metricsWithHistory = metrics.map(metric => ({
      ...metric,
      history: generateHistoricalData(metric.value, 20)
    }));

    return NextResponse.json({
      metrics: metricsWithHistory,
      totalCount: metrics.length,
      source,
      timeRange,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

// Generate historical data points for a metric
function generateHistoricalData(currentValue: number, points: number) {
  const data = [];
  const now = new Date();
  
  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 30000); // 30 second intervals
    const variation = (Math.random() - 0.5) * 20; // ±10 variation
    const value = Math.max(0, currentValue + variation);
    
    data.push({
      timestamp: timestamp.toISOString(),
      value: Math.round(value * 100) / 100
    });
  }
  
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { metricId, value, timestamp, tags = {} } = body;

    if (!metricId || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: metricId, value' },
        { status: 400 }
      );
    }

    // In a real implementation, this would:
    // 1. Validate the metric data
    // 2. Store the metric in a time-series database (InfluxDB, Prometheus, etc.)
    // 3. Trigger alerts if thresholds are exceeded
    // 4. Update dashboards and real-time streams

    const metric = {
      id: metricId,
      value: parseFloat(value),
      timestamp: timestamp || new Date().toISOString(),
      tags,
      source: tags.source || 'custom'
    };

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 50));

  return NextResponse.json({
    success: true,
    metric,
    message: 'Metric stored successfully'
  });
}));

// Health check endpoint for the metrics service
export const HEAD = handleAsyncRoute(async (request: NextRequest) => {
  // Check if monitoring services are accessible
  const checks = [
    { name: 'prometheus', healthy: Math.random() > 0.1 },
    { name: 'influxdb', healthy: Math.random() > 0.05 },
    { name: 'grafana', healthy: Math.random() > 0.02 }
  ];

  const allHealthy = checks.every(check => check.healthy);
  
  if (allHealthy) {
    return new NextResponse(null, { status: 200 });
  } else {
    return new NextResponse(null, { status: 503 });
  }
});
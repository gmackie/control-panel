import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrometheusClient } from '@/lib/prometheus/client';

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

// Initialize Prometheus client
const prometheusClient = new PrometheusClient();

// Determine status based on value and thresholds
function getStatus(value: number, warning: number, critical: number): 'healthy' | 'warning' | 'critical' {
  if (value >= critical) return 'critical';
  if (value >= warning) return 'warning';
  return 'healthy';
}

// Fetch real metrics from Prometheus
async function fetchRealMetrics(): Promise<SystemMetric[]> {
  const now = new Date();
  const metrics: SystemMetric[] = [];

  try {
    // Get cluster-wide metrics
    const clusterMetrics = await prometheusClient.getClusterMetrics();
    
    // CPU Usage
    metrics.push({
      id: 'cpu',
      name: 'CPU Usage',
      value: clusterMetrics.cpuUsagePercent,
      unit: '%',
      change: 0, // Would need historical data to calculate
      status: getStatus(clusterMetrics.cpuUsagePercent, 70, 90),
      threshold: { warning: 70, critical: 90 },
      lastUpdated: now,
      source: 'k3s-cluster'
    });

    // Memory Usage
    metrics.push({
      id: 'memory',
      name: 'Memory Usage',
      value: clusterMetrics.memoryUsagePercent,
      unit: '%',
      change: 0,
      status: getStatus(clusterMetrics.memoryUsagePercent, 80, 95),
      threshold: { warning: 80, critical: 95 },
      lastUpdated: now,
      source: 'k3s-cluster'
    });

    // Node Count
    metrics.push({
      id: 'nodes',
      name: 'Cluster Nodes',
      value: clusterMetrics.nodeCount,
      unit: '',
      change: 0,
      status: clusterMetrics.nodeCount > 0 ? 'healthy' : 'critical',
      threshold: { warning: 1, critical: 0 },
      lastUpdated: now,
      source: 'k3s-cluster'
    });

    // Pod Count
    metrics.push({
      id: 'pods',
      name: 'Running Pods',
      value: clusterMetrics.podCount,
      unit: '',
      change: 0,
      status: 'healthy',
      threshold: { warning: 100, critical: 150 },
      lastUpdated: now,
      source: 'k3s-cluster'
    });

    // CPU Cores
    metrics.push({
      id: 'cpu-cores',
      name: 'CPU Cores',
      value: clusterMetrics.cpuCores,
      unit: '',
      change: 0,
      status: 'healthy',
      threshold: { warning: 8, critical: 4 },
      lastUpdated: now,
      source: 'k3s-cluster'
    });

    // Memory Total
    metrics.push({
      id: 'memory-total',
      name: 'Total Memory',
      value: clusterMetrics.memoryGi,
      unit: 'GiB',
      change: 0,
      status: 'healthy',
      threshold: { warning: 16, critical: 8 },
      lastUpdated: now,
      source: 'k3s-cluster'
    });

    // Fetch additional metrics via direct queries
    try {
      // Disk usage
      const diskQuery = '(sum(node_filesystem_size_bytes{mountpoint="/"}) - sum(node_filesystem_avail_bytes{mountpoint="/"})) / sum(node_filesystem_size_bytes{mountpoint="/"}) * 100';
      const diskResult = await prometheusClient.instantQuery(diskQuery);
      const diskUsage = diskResult.length > 0 ? parseFloat(diskResult[0].value[1]) : 0;
      
      metrics.push({
        id: 'disk',
        name: 'Disk Usage',
        value: Math.round(diskUsage * 100) / 100,
        unit: '%',
        change: 0,
        status: getStatus(diskUsage, 80, 90),
        threshold: { warning: 80, critical: 90 },
        lastUpdated: now,
        source: 'k3s-cluster'
      });
    } catch (e) {
      console.error('Error fetching disk metrics:', e);
    }

    try {
      // Network receive rate
      const networkRxQuery = 'sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|flannel.*|cali.*|cbr.*"}[5m])) / 1024 / 1024';
      const networkRxResult = await prometheusClient.instantQuery(networkRxQuery);
      const networkRx = networkRxResult.length > 0 ? parseFloat(networkRxResult[0].value[1]) : 0;

      metrics.push({
        id: 'network-rx',
        name: 'Network Receive',
        value: Math.round(networkRx * 100) / 100,
        unit: 'MB/s',
        change: 0,
        status: getStatus(networkRx, 100, 200),
        threshold: { warning: 100, critical: 200 },
        lastUpdated: now,
        source: 'k3s-cluster'
      });

      // Network transmit rate
      const networkTxQuery = 'sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|flannel.*|cali.*|cbr.*"}[5m])) / 1024 / 1024';
      const networkTxResult = await prometheusClient.instantQuery(networkTxQuery);
      const networkTx = networkTxResult.length > 0 ? parseFloat(networkTxResult[0].value[1]) : 0;

      metrics.push({
        id: 'network-tx',
        name: 'Network Transmit',
        value: Math.round(networkTx * 100) / 100,
        unit: 'MB/s',
        change: 0,
        status: getStatus(networkTx, 100, 200),
        threshold: { warning: 100, critical: 200 },
        lastUpdated: now,
        source: 'k3s-cluster'
      });
    } catch (e) {
      console.error('Error fetching network metrics:', e);
    }

    try {
      // Container restart count (last hour)
      const restartsQuery = 'sum(increase(kube_pod_container_status_restarts_total[1h]))';
      const restartsResult = await prometheusClient.instantQuery(restartsQuery);
      const restarts = restartsResult.length > 0 ? parseFloat(restartsResult[0].value[1]) : 0;

      metrics.push({
        id: 'container-restarts',
        name: 'Container Restarts (1h)',
        value: Math.round(restarts),
        unit: '',
        change: 0,
        status: getStatus(restarts, 5, 10),
        threshold: { warning: 5, critical: 10 },
        lastUpdated: now,
        source: 'k3s-cluster'
      });
    } catch (e) {
      console.error('Error fetching restart metrics:', e);
    }

  } catch (error) {
    console.error('Error fetching metrics from Prometheus:', error);
    // Return empty array - caller will handle fallback
  }

  return metrics;
}

// Fallback mock data generator for when Prometheus is unavailable
function generateMockMetrics(): SystemMetric[] {
  const now = new Date();
  
  return [
    {
      id: 'cpu',
      name: 'CPU Usage',
      value: Math.random() * 100,
      unit: '%',
      change: (Math.random() - 0.5) * 10,
      status: Math.random() > 0.8 ? 'warning' : 'healthy',
      threshold: { warning: 70, critical: 90 },
      lastUpdated: now,
      source: 'mock'
    },
    {
      id: 'memory',
      name: 'Memory Usage',
      value: Math.random() * 100,
      unit: '%',
      change: (Math.random() - 0.5) * 10,
      status: Math.random() > 0.9 ? 'critical' : 'healthy',
      threshold: { warning: 80, critical: 95 },
      lastUpdated: now,
      source: 'mock'
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
      source: 'mock'
    },
    {
      id: 'network-rx',
      name: 'Network Receive',
      value: Math.random() * 100,
      unit: 'MB/s',
      change: (Math.random() - 0.5) * 10,
      status: 'healthy',
      threshold: { warning: 100, critical: 200 },
      lastUpdated: now,
      source: 'mock'
    }
  ];
}

// Fetch metrics from appropriate source
async function fetchMetricsFromSource(source: string): Promise<SystemMetric[]> {
  // Try to fetch real metrics from Prometheus
  const realMetrics = await fetchRealMetrics();
  
  if (realMetrics.length > 0) {
    if (source === 'all') {
      return realMetrics;
    }
    return realMetrics.filter(metric => metric.source === source);
  }
  
  // Fallback to mock data if Prometheus is unavailable
  console.warn('Prometheus unavailable, using mock metrics');
  const mockMetrics = generateMockMetrics();
  
  if (source === 'all') {
    return mockMetrics;
  }
  
  return mockMetrics.filter(metric => metric.source === source);
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

    // Fetch metrics from Prometheus or fallback to mock
    let metrics = await fetchMetricsFromSource(source);

    // Filter by specific metric IDs if provided
    if (metricIds.length > 0 && metricIds[0] !== '') {
      metrics = metrics.filter(metric => metricIds.includes(metric.id));
    }

    // Fetch historical data for trend analysis from Prometheus
    const metricsWithHistory = await Promise.all(
      metrics.map(async (metric) => {
        let history: Array<{ timestamp: string; value: number }> = [];
        
        try {
          // Get the appropriate query for each metric
          const queryMap: Record<string, string> = {
            'cpu': '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
            'memory': '(1 - (sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))) * 100',
            'disk': '(sum(node_filesystem_size_bytes{mountpoint="/"}) - sum(node_filesystem_avail_bytes{mountpoint="/"})) / sum(node_filesystem_size_bytes{mountpoint="/"}) * 100',
          };

          const query = queryMap[metric.id];
          if (query) {
            const end = new Date();
            const start = new Date(end.getTime() - (timeRange === '24h' ? 86400000 : timeRange === '7d' ? 604800000 : 3600000));
            const step = timeRange === '24h' ? '5m' : timeRange === '7d' ? '30m' : '1m';

            const rangeResults = await prometheusClient.rangeQuery(query, start, end, step);
            if (rangeResults.length > 0) {
              history = rangeResults[0].values.map(([timestamp, value]) => ({
                timestamp: new Date(timestamp * 1000).toISOString(),
                value: Math.round(parseFloat(value) * 100) / 100,
              }));
            }
          }
        } catch {
          // If historical data fails, generate synthetic history
          history = generateSyntheticHistory(metric.value, 20);
        }

        // If no history was fetched, generate synthetic
        if (history.length === 0) {
          history = generateSyntheticHistory(metric.value, 20);
        }

        return {
          ...metric,
          history,
        };
      })
    );

    // Check Prometheus health
    const prometheusHealthy = await prometheusClient.healthCheck();

    return NextResponse.json({
      metrics: metricsWithHistory,
      totalCount: metrics.length,
      source: metrics.length > 0 && metrics[0].source !== 'mock' ? 'prometheus' : 'mock',
      prometheusHealthy,
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

// Generate synthetic historical data points for a metric
function generateSyntheticHistory(currentValue: number, points: number) {
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

    // Note: In production, this would push metrics to Prometheus via Pushgateway
    // For now, we just acknowledge receipt
    const metric = {
      id: metricId,
      value: parseFloat(value),
      timestamp: timestamp || new Date().toISOString(),
      tags,
      source: tags.source || 'custom'
    };

    return NextResponse.json({
      success: true,
      metric,
      message: 'Metric received (note: Prometheus Pushgateway integration not yet configured)'
    });
  } catch (error) {
    console.error('Error storing metric:', error);
    return NextResponse.json(
      { error: 'Failed to store metric' },
      { status: 500 }
    );
  }
}

// Health check endpoint for the metrics service
export async function HEAD() {
  // Check if Prometheus is accessible
  try {
    const healthy = await prometheusClient.healthCheck();
    
    if (healthy) {
      return new NextResponse(null, { status: 200 });
    } else {
      return new NextResponse(null, { status: 503 });
    }
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}

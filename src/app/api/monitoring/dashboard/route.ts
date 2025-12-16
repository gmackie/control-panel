import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrometheusClient } from '@/lib/prometheus/client';
import { GrafanaClient } from '@/lib/grafana/client';

const prometheus = new PrometheusClient();
const grafana = new GrafanaClient();

interface DashboardMetrics {
  cluster: {
    nodes: number;
    pods: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    cpuCores: number;
    memoryTotal: number;
  };
  requests: {
    rate: number;
    errorRate: number;
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
  };
  network: {
    receiveRate: number;
    transmitRate: number;
  };
  health: {
    containerRestarts: number;
    failedPods: number;
    pendingPods: number;
    alerts: {
      firing: number;
      pending: number;
    };
  };
}

interface GrafanaDashboardInfo {
  name: string;
  uid: string;
  url: string;
  tags: string[];
}

interface DashboardResponse {
  metrics: DashboardMetrics;
  grafana: {
    available: boolean;
    url: string;
    dashboards: GrafanaDashboardInfo[];
    exploreUrl: string;
  };
  prometheus: {
    available: boolean;
    url: string;
  };
  source: 'prometheus' | 'mock';
  timestamp: string;
}

// Prometheus queries for dashboard metrics
const QUERIES = {
  // Cluster
  nodeCount: 'count(kube_node_info)',
  podCount: 'count(kube_pod_info{phase="Running"})',
  cpuUsage: '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
  memoryUsage: '(1 - (sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))) * 100',
  diskUsage: '(sum(node_filesystem_size_bytes{mountpoint="/"}) - sum(node_filesystem_avail_bytes{mountpoint="/"})) / sum(node_filesystem_size_bytes{mountpoint="/"}) * 100',
  cpuCores: 'sum(machine_cpu_cores)',
  memoryTotal: 'sum(node_memory_MemTotal_bytes) / 1024 / 1024 / 1024',
  
  // Requests (try nginx ingress first, then generic http metrics)
  requestRate: 'sum(rate(nginx_ingress_controller_requests[5m])) or sum(rate(http_requests_total[5m])) or vector(0)',
  errorRate: '(sum(rate(nginx_ingress_controller_requests{status=~"5.."}[5m])) / sum(rate(nginx_ingress_controller_requests[5m]))) * 100 or (sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100 or vector(0)',
  latencyP50: 'histogram_quantile(0.5, sum(rate(nginx_ingress_controller_request_duration_seconds_bucket[5m])) by (le)) * 1000 or histogram_quantile(0.5, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) * 1000 or vector(0)',
  latencyP95: 'histogram_quantile(0.95, sum(rate(nginx_ingress_controller_request_duration_seconds_bucket[5m])) by (le)) * 1000 or histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) * 1000 or vector(0)',
  latencyP99: 'histogram_quantile(0.99, sum(rate(nginx_ingress_controller_request_duration_seconds_bucket[5m])) by (le)) * 1000 or histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) * 1000 or vector(0)',
  
  // Network
  networkRx: 'sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|flannel.*|cali.*|cbr.*"}[5m])) / 1024 / 1024',
  networkTx: 'sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|flannel.*|cali.*|cbr.*"}[5m])) / 1024 / 1024',
  
  // Health
  containerRestarts: 'sum(increase(kube_pod_container_status_restarts_total[1h])) or vector(0)',
  failedPods: 'count(kube_pod_status_phase{phase="Failed"}) or vector(0)',
  pendingPods: 'count(kube_pod_status_phase{phase="Pending"}) or vector(0)',
};

async function fetchPrometheusMetrics(): Promise<DashboardMetrics | null> {
  try {
    // Execute all queries in parallel
    const results = await Promise.all([
      prometheus.instantQuery(QUERIES.nodeCount),
      prometheus.instantQuery(QUERIES.podCount),
      prometheus.instantQuery(QUERIES.cpuUsage),
      prometheus.instantQuery(QUERIES.memoryUsage),
      prometheus.instantQuery(QUERIES.diskUsage),
      prometheus.instantQuery(QUERIES.cpuCores),
      prometheus.instantQuery(QUERIES.memoryTotal),
      prometheus.instantQuery(QUERIES.requestRate),
      prometheus.instantQuery(QUERIES.errorRate),
      prometheus.instantQuery(QUERIES.latencyP50),
      prometheus.instantQuery(QUERIES.latencyP95),
      prometheus.instantQuery(QUERIES.latencyP99),
      prometheus.instantQuery(QUERIES.networkRx),
      prometheus.instantQuery(QUERIES.networkTx),
      prometheus.instantQuery(QUERIES.containerRestarts),
      prometheus.instantQuery(QUERIES.failedPods),
      prometheus.instantQuery(QUERIES.pendingPods),
      prometheus.getAlerts(),
    ]);

    const getValue = (result: typeof results[0], defaultValue = 0): number => {
      if (Array.isArray(result) && result.length > 0 && 'value' in result[0]) {
        const val = parseFloat(result[0].value[1]);
        return isNaN(val) ? defaultValue : val;
      }
      return defaultValue;
    };

    // Get alert counts
    const alerts = results[17] as Awaited<ReturnType<typeof prometheus.getAlerts>>;
    const firingAlerts = alerts.filter(a => a.state === 'firing').length;
    const pendingAlerts = alerts.filter(a => a.state === 'pending').length;

    return {
      cluster: {
        nodes: Math.round(getValue(results[0])),
        pods: Math.round(getValue(results[1])),
        cpuUsage: Math.round(getValue(results[2]) * 10) / 10,
        memoryUsage: Math.round(getValue(results[3]) * 10) / 10,
        diskUsage: Math.round(getValue(results[4]) * 10) / 10,
        cpuCores: Math.round(getValue(results[5])),
        memoryTotal: Math.round(getValue(results[6]) * 10) / 10,
      },
      requests: {
        rate: Math.round(getValue(results[7]) * 100) / 100,
        errorRate: Math.round(getValue(results[8]) * 100) / 100,
        latencyP50: Math.round(getValue(results[9])),
        latencyP95: Math.round(getValue(results[10])),
        latencyP99: Math.round(getValue(results[11])),
      },
      network: {
        receiveRate: Math.round(getValue(results[12]) * 100) / 100,
        transmitRate: Math.round(getValue(results[13]) * 100) / 100,
      },
      health: {
        containerRestarts: Math.round(getValue(results[14])),
        failedPods: Math.round(getValue(results[15])),
        pendingPods: Math.round(getValue(results[16])),
        alerts: {
          firing: firingAlerts,
          pending: pendingAlerts,
        },
      },
    };
  } catch (error) {
    console.error('Error fetching Prometheus metrics:', error);
    return null;
  }
}

function getMockMetrics(): DashboardMetrics {
  return {
    cluster: {
      nodes: 3,
      pods: 45,
      cpuUsage: 35 + Math.random() * 30,
      memoryUsage: 50 + Math.random() * 25,
      diskUsage: 40 + Math.random() * 20,
      cpuCores: 12,
      memoryTotal: 48,
    },
    requests: {
      rate: 150 + Math.random() * 100,
      errorRate: Math.random() * 2,
      latencyP50: 20 + Math.random() * 30,
      latencyP95: 80 + Math.random() * 50,
      latencyP99: 150 + Math.random() * 100,
    },
    network: {
      receiveRate: 5 + Math.random() * 10,
      transmitRate: 8 + Math.random() * 15,
    },
    health: {
      containerRestarts: Math.floor(Math.random() * 5),
      failedPods: Math.floor(Math.random() * 2),
      pendingPods: Math.floor(Math.random() * 3),
      alerts: {
        firing: Math.floor(Math.random() * 2),
        pending: Math.floor(Math.random() * 3),
      },
    },
  };
}

async function getGrafanaInfo(): Promise<DashboardResponse['grafana']> {
  const grafanaUrl = process.env.GRAFANA_URL || 'https://grafana.gmac.io';
  
  try {
    const healthy = await grafana.healthCheck();
    
    if (!healthy) {
      return {
        available: false,
        url: grafanaUrl,
        dashboards: [],
        exploreUrl: `${grafanaUrl}/explore`,
      };
    }

    // Get K8s related dashboards
    const dashboards = await grafana.getKubernetesDashboards();
    
    return {
      available: true,
      url: grafanaUrl,
      dashboards: dashboards.slice(0, 10).map(d => ({
        name: d.title,
        uid: d.uid,
        url: `${grafanaUrl}/d/${d.uid}`,
        tags: d.tags,
      })),
      exploreUrl: `${grafanaUrl}/explore`,
    };
  } catch (error) {
    console.error('Error connecting to Grafana:', error);
    return {
      available: false,
      url: grafanaUrl,
      dashboards: [],
      exploreUrl: `${grafanaUrl}/explore`,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // searchParams available for future use (e.g., refresh, timeRange)
    const _searchParams = new URL(request.url).searchParams;
    void _searchParams; // Available for future parameters

    // Check Prometheus health first
    const prometheusHealthy = await prometheus.healthCheck();
    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus.monitoring.svc.cluster.local:9090';

    // Fetch metrics from Prometheus or use mock
    let metrics: DashboardMetrics;
    let source: 'prometheus' | 'mock';

    if (prometheusHealthy) {
      const realMetrics = await fetchPrometheusMetrics();
      if (realMetrics) {
        metrics = realMetrics;
        source = 'prometheus';
      } else {
        metrics = getMockMetrics();
        source = 'mock';
      }
    } else {
      metrics = getMockMetrics();
      source = 'mock';
    }

    // Get Grafana info
    const grafanaInfo = await getGrafanaInfo();

    const response: DashboardResponse = {
      metrics,
      grafana: grafanaInfo,
      prometheus: {
        available: prometheusHealthy,
        url: prometheusUrl,
      },
      source,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

// Get metrics for a specific application
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { namespace, appName } = await request.json();

    if (!namespace || !appName) {
      return NextResponse.json(
        { error: 'namespace and appName are required' },
        { status: 400 }
      );
    }

    // Get application-specific metrics
    const appMetrics = await prometheus.getApplicationMetrics(namespace, appName);
    
    // Try to find app-specific dashboard in Grafana
    const appDashboard = await grafana.findApplicationDashboard(appName, namespace);
    
    // Generate explore URL for the app
    const exploreUrl = grafana.getExploreUrl(
      `container_cpu_usage_seconds_total{namespace="${namespace}",pod=~"${appName}.*"}`
    );

    return NextResponse.json({
      app: {
        name: appName,
        namespace,
      },
      metrics: appMetrics,
      grafana: {
        dashboard: appDashboard ? {
          name: appDashboard.title,
          uid: appDashboard.uid,
          url: `${process.env.GRAFANA_URL || 'https://grafana.gmac.io'}/d/${appDashboard.uid}`,
        } : null,
        exploreUrl,
      },
      source: appMetrics.cpu > 0 ? 'prometheus' : 'mock',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('App metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch application metrics' },
      { status: 500 }
    );
  }
}

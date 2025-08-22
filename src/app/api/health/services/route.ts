import { NextRequest, NextResponse } from "next/server";

interface ServiceHealth {
  id: string;
  name: string;
  type: 'application' | 'database' | 'external_api' | 'infrastructure';
  status: 'healthy' | 'degraded' | 'down' | 'maintenance';
  uptime: number;
  responseTime: number;
  errorRate: number;
  endpoints: Array<{
    name: string;
    status: 'passing' | 'failing' | 'unknown';
    responseTime: number;
  }>;
  lastChecked: Date;
  environment: 'production' | 'staging' | 'development';
  dependencies: string[];
  metrics: {
    availability: number;
    responseTime: {
      p50: number;
      p95: number;
      p99: number;
    };
    throughput: number;
    errorRate: number;
    alertsTriggered: number;
    lastDay: {
      requests: number;
      errors: number;
      availability: number;
    };
  };
  slo?: {
    target: number;
    current: number;
    period: '7d' | '30d' | '90d';
    errorBudget: {
      remaining: number;
      consumed: number;
      total: number;
    };
  };
}

const generateMockServices = (): ServiceHealth[] => {
  const services: ServiceHealth[] = [
    {
      id: 'gitea-server',
      name: 'Gitea Server',
      type: 'application',
      status: 'healthy',
      uptime: 99.95,
      responseTime: 120,
      errorRate: 0.01,
      environment: 'production',
      lastChecked: new Date(Date.now() - 2 * 60 * 1000),
      dependencies: ['gitea-db', 'nginx-proxy'],
      endpoints: [
        { name: 'API Health', status: 'passing', responseTime: 85 },
        { name: 'Web Interface', status: 'passing', responseTime: 150 },
        { name: 'Git Operations', status: 'passing', responseTime: 95 }
      ],
      metrics: {
        availability: 99.95,
        responseTime: { p50: 95, p95: 180, p99: 350 },
        throughput: 45.2,
        errorRate: 0.01,
        alertsTriggered: 0,
        lastDay: { requests: 12847, errors: 1, availability: 100 }
      },
      slo: {
        target: 99.9,
        current: 99.95,
        period: '30d',
        errorBudget: { remaining: 85, consumed: 15, total: 100 }
      }
    },
    {
      id: 'k3s-cluster',
      name: 'K3s Cluster',
      type: 'infrastructure',
      status: 'healthy',
      uptime: 99.8,
      responseTime: 45,
      errorRate: 0.05,
      environment: 'production',
      lastChecked: new Date(Date.now() - 1 * 60 * 1000),
      dependencies: [],
      endpoints: [
        { name: 'Kubernetes API', status: 'passing', responseTime: 35 },
        { name: 'Node Health', status: 'passing', responseTime: 20 },
        { name: 'Pod Scheduling', status: 'passing', responseTime: 65 }
      ],
      metrics: {
        availability: 99.8,
        responseTime: { p50: 25, p95: 75, p99: 150 },
        throughput: 125.7,
        errorRate: 0.05,
        alertsTriggered: 1,
        lastDay: { requests: 45632, errors: 23, availability: 99.9 }
      },
      slo: {
        target: 99.5,
        current: 99.8,
        period: '30d',
        errorBudget: { remaining: 65, consumed: 35, total: 100 }
      }
    },
    {
      id: 'harbor-registry',
      name: 'Harbor Registry',
      type: 'application',
      status: 'healthy',
      uptime: 99.9,
      responseTime: 200,
      errorRate: 0.02,
      environment: 'production',
      lastChecked: new Date(Date.now() - 3 * 60 * 1000),
      dependencies: ['harbor-db', 'harbor-redis'],
      endpoints: [
        { name: 'Registry API', status: 'passing', responseTime: 180 },
        { name: 'Web UI', status: 'passing', responseTime: 220 },
        { name: 'Docker Push/Pull', status: 'passing', responseTime: 190 }
      ],
      metrics: {
        availability: 99.9,
        responseTime: { p50: 165, p95: 280, p99: 450 },
        throughput: 28.3,
        errorRate: 0.02,
        alertsTriggered: 0,
        lastDay: { requests: 8934, errors: 2, availability: 100 }
      }
    },
    {
      id: 'prometheus',
      name: 'Prometheus',
      type: 'application',
      status: 'healthy',
      uptime: 99.95,
      responseTime: 85,
      errorRate: 0.01,
      environment: 'production',
      lastChecked: new Date(Date.now() - 1 * 60 * 1000),
      dependencies: ['prometheus-storage'],
      endpoints: [
        { name: 'Query API', status: 'passing', responseTime: 65 },
        { name: 'Admin API', status: 'passing', responseTime: 90 },
        { name: 'Targets Health', status: 'passing', responseTime: 100 }
      ],
      metrics: {
        availability: 99.95,
        responseTime: { p50: 55, p95: 120, p99: 200 },
        throughput: 89.1,
        errorRate: 0.01,
        alertsTriggered: 0,
        lastDay: { requests: 23456, errors: 2, availability: 100 }
      },
      slo: {
        target: 99.9,
        current: 99.95,
        period: '30d',
        errorBudget: { remaining: 90, consumed: 10, total: 100 }
      }
    },
    {
      id: 'grafana',
      name: 'Grafana',
      type: 'application',
      status: 'degraded',
      uptime: 98.5,
      responseTime: 350,
      errorRate: 1.2,
      environment: 'production',
      lastChecked: new Date(Date.now() - 30 * 1000),
      dependencies: ['grafana-db', 'prometheus'],
      endpoints: [
        { name: 'Web UI', status: 'failing', responseTime: 850 },
        { name: 'API', status: 'passing', responseTime: 180 },
        { name: 'Alerting', status: 'passing', responseTime: 120 }
      ],
      metrics: {
        availability: 98.5,
        responseTime: { p50: 280, p95: 650, p99: 1200 },
        throughput: 15.4,
        errorRate: 1.2,
        alertsTriggered: 3,
        lastDay: { requests: 5634, errors: 68, availability: 97.8 }
      },
      slo: {
        target: 99.0,
        current: 98.5,
        period: '30d',
        errorBudget: { remaining: 15, consumed: 85, total: 100 }
      }
    },
    {
      id: 'control-panel-staging',
      name: 'Control Panel (Staging)',
      type: 'application',
      status: 'healthy',
      uptime: 99.2,
      responseTime: 180,
      errorRate: 0.3,
      environment: 'staging',
      lastChecked: new Date(Date.now() - 5 * 60 * 1000),
      dependencies: ['turso-db', 'github-oauth'],
      endpoints: [
        { name: 'Health Check', status: 'passing', responseTime: 45 },
        { name: 'API Routes', status: 'passing', responseTime: 220 },
        { name: 'Authentication', status: 'passing', responseTime: 275 }
      ],
      metrics: {
        availability: 99.2,
        responseTime: { p50: 150, p95: 320, p99: 580 },
        throughput: 12.8,
        errorRate: 0.3,
        alertsTriggered: 1,
        lastDay: { requests: 3421, errors: 10, availability: 99.1 }
      }
    }
  ];

  return services;
};

export async function GET(request: NextRequest) {
  try {
    const services = generateMockServices();

    return NextResponse.json({
      success: true,
      services,
      summary: {
        total: services.length,
        healthy: services.filter(s => s.status === 'healthy').length,
        degraded: services.filter(s => s.status === 'degraded').length,
        down: services.filter(s => s.status === 'down').length,
        maintenance: services.filter(s => s.status === 'maintenance').length
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching service health data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service health data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { serviceId, action } = await request.json();

    if (action === 'check') {
      // Simulate running a health check
      const service = generateMockServices().find(s => s.id === serviceId);
      if (!service) {
        return NextResponse.json(
          { success: false, error: 'Service not found' },
          { status: 404 }
        );
      }

      // Simulate check taking some time
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Mock health check results
      const checkResults = {
        serviceId,
        timestamp: new Date().toISOString(),
        status: Math.random() > 0.1 ? 'healthy' : 'degraded',
        responseTime: Math.floor(50 + Math.random() * 200),
        endpoints: service.endpoints.map(endpoint => ({
          ...endpoint,
          status: Math.random() > 0.05 ? 'passing' : 'failing',
          responseTime: Math.floor(20 + Math.random() * 100)
        }))
      };

      return NextResponse.json({
        success: true,
        checkResults
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing health check request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process health check request' },
      { status: 500 }
    );
  }
}
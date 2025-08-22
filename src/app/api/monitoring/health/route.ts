import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface ServiceHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  lastCheck: Date;
  dependencies: string[];
  version: string;
  environment: string;
  url?: string;
  healthCheckEndpoint?: string;
}

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: {
    checks: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail';
      message?: string;
      timestamp: Date;
    }>;
    metadata: Record<string, any>;
  };
}

// Mock service configurations
const SERVICE_CONFIGS = {
  'control-panel-api': {
    healthCheckEndpoint: '/health',
    dependencies: ['database', 'redis'],
    criticalService: true
  },
  'gitea-server': {
    healthCheckEndpoint: '/api/v1/version',
    dependencies: ['database'],
    criticalService: true
  },
  'drone-ci': {
    healthCheckEndpoint: '/healthz',
    dependencies: ['gitea-server', 'database'],
    criticalService: false
  },
  'harbor-registry': {
    healthCheckEndpoint: '/api/v2.0/systeminfo',
    dependencies: ['database', 'storage'],
    criticalService: true
  },
  'argocd': {
    healthCheckEndpoint: '/healthz',
    dependencies: ['k3s-cluster'],
    criticalService: false
  },
  'database': {
    healthCheckEndpoint: '/health',
    dependencies: [],
    criticalService: true
  }
};

// Generate mock service health data
function generateServiceHealth(): ServiceHealth[] {
  const now = new Date();
  const services = [
    {
      id: 'control-panel-api',
      name: 'Control Panel API',
      version: 'v2.4.0',
      environment: 'production',
      url: 'https://api.gmac.io'
    },
    {
      id: 'gitea-server',
      name: 'Gitea Server',
      version: 'v1.20.4',
      environment: 'production',
      url: 'https://git.gmac.io'
    },
    {
      id: 'drone-ci',
      name: 'Drone CI',
      version: 'v2.16.0',
      environment: 'production',
      url: 'https://ci.gmac.io'
    },
    {
      id: 'harbor-registry',
      name: 'Harbor Registry',
      version: 'v2.9.0',
      environment: 'production',
      url: 'https://registry.gmac.io'
    },
    {
      id: 'argocd',
      name: 'ArgoCD',
      version: 'v2.8.4',
      environment: 'production',
      url: 'https://argocd.gmac.io'
    },
    {
      id: 'database',
      name: 'PostgreSQL Database',
      version: 'v15.4',
      environment: 'production',
      url: 'postgresql://db.gmac.io:5432'
    }
  ];

  return services.map(service => {
    const config = SERVICE_CONFIGS[service.id as keyof typeof SERVICE_CONFIGS];
    const baseStatus = Math.random();
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (baseStatus > 0.9) {
      status = 'unhealthy';
    } else if (baseStatus > 0.7) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    // ArgoCD is more likely to be degraded (as per mock data)
    if (service.id === 'argocd') {
      status = Math.random() > 0.3 ? 'degraded' : 'healthy';
    }

    const baseResponseTime = service.id === 'database' ? 25 : 
                            service.id === 'argocd' ? 450 : 
                            Math.random() * 200 + 50;

    return {
      id: service.id,
      name: service.name,
      status,
      uptime: status === 'unhealthy' ? 95.5 + Math.random() * 3 : 99.5 + Math.random() * 0.5,
      responseTime: Math.round(baseResponseTime + (status === 'unhealthy' ? Math.random() * 500 : 0)),
      errorRate: status === 'unhealthy' ? Math.random() * 5 + 2 : Math.random() * 1,
      throughput: Math.floor(Math.random() * 2000) + 100,
      lastCheck: now,
      dependencies: config.dependencies,
      version: service.version,
      environment: service.environment,
      url: service.url,
      healthCheckEndpoint: config.healthCheckEndpoint
    };
  });
}

// Simulate health check for a specific service
async function performHealthCheck(serviceId: string): Promise<HealthCheckResult> {
  const config = SERVICE_CONFIGS[serviceId as keyof typeof SERVICE_CONFIGS];
  const startTime = Date.now();
  
  // Simulate network call
  await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
  
  const responseTime = Date.now() - startTime;
  const now = new Date();
  
  // Simulate various health checks
  const checks = [
    {
      name: 'http_response',
      status: Math.random() > 0.1 ? 'pass' : 'fail',
      message: Math.random() > 0.1 ? 'Service responding' : 'Connection timeout',
      timestamp: now
    },
    {
      name: 'database_connection',
      status: Math.random() > 0.05 ? 'pass' : 'fail',
      message: Math.random() > 0.05 ? 'Database accessible' : 'Connection pool exhausted',
      timestamp: now
    }
  ] as Array<{ name: string; status: 'pass' | 'warn' | 'fail'; message?: string; timestamp: Date }>;

  // Add service-specific checks
  if (serviceId === 'database') {
    checks.push({
      name: 'connection_pool',
      status: Math.random() > 0.1 ? 'pass' : 'warn',
      message: `Active connections: ${Math.floor(Math.random() * 50) + 10}/100`,
      timestamp: now
    });
  }

  if (serviceId === 'k3s-cluster') {
    checks.push({
      name: 'node_ready',
      status: Math.random() > 0.05 ? 'pass' : 'fail',
      message: `4/4 nodes ready`,
      timestamp: now
    });
    checks.push({
      name: 'pod_health',
      status: Math.random() > 0.1 ? 'pass' : 'warn',
      message: `45/47 pods running`,
      timestamp: now
    });
  }

  const failedChecks = checks.filter(c => c.status === 'fail').length;
  const warningChecks = checks.filter(c => c.status === 'warn').length;
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (failedChecks > 0) {
    overallStatus = 'unhealthy';
  } else if (warningChecks > 0) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  return {
    service: serviceId,
    status: overallStatus,
    responseTime,
    details: {
      checks,
      metadata: {
        endpoint: config.healthCheckEndpoint,
        dependencies: config.dependencies,
        timestamp: now.toISOString(),
        version: '1.0.0'
      }
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service');
    const includeDetails = searchParams.get('details') === 'true';
    const environment = searchParams.get('environment') || 'production';

    if (serviceId) {
      // Get health for specific service
      const healthCheck = await performHealthCheck(serviceId);
      
      return NextResponse.json({
        service: serviceId,
        health: healthCheck,
        timestamp: new Date().toISOString()
      });
    }

    // Get health for all services
    const services = generateServiceHealth().filter(
      service => service.environment === environment
    );

    // If details are requested, perform health checks
    let healthChecks: HealthCheckResult[] = [];
    if (includeDetails) {
      const healthPromises = services.map(service => 
        performHealthCheck(service.id)
      );
      healthChecks = await Promise.all(healthPromises);
    }

    // Calculate overall system health
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return NextResponse.json({
      services,
      healthChecks: includeDetails ? healthChecks : undefined,
      summary: {
        totalServices: services.length,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
        overallStatus,
        lastUpdated: new Date().toISOString()
      },
      environment
    });

  } catch (error) {
    console.error('Error fetching service health:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service health' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { serviceId, forceCheck = false } = body;

    if (!serviceId) {
      return NextResponse.json(
        { error: 'Missing serviceId' },
        { status: 400 }
      );
    }

    // Perform immediate health check
    const healthCheck = await performHealthCheck(serviceId);

    // In a real implementation, this would:
    // 1. Store the health check result
    // 2. Update service status in the database
    // 3. Trigger alerts if status changed to unhealthy
    // 4. Update monitoring dashboards

    return NextResponse.json({
      success: true,
      serviceId,
      health: healthCheck,
      message: 'Health check completed'
    });

  } catch (error) {
    console.error('Error performing health check:', error);
    return NextResponse.json(
      { error: 'Failed to perform health check' },
      { status: 500 }
    );
  }
}
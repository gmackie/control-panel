import { NextRequest, NextResponse } from 'next/server';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  timestamp: string;
  uptime?: number;
  version?: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  version: string;
  uptime: number;
  timestamp: string;
}

const startTime = Date.now();

async function checkDatabase(): Promise<HealthCheck> {
  try {
    // In production, perform actual database connectivity check
    // For now, simulate a check
    const isHealthy = Math.random() > 0.05;
    
    return {
      service: 'database',
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: isHealthy ? 'Connected to PostgreSQL' : 'Database connection failed',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  try {
    // In production, perform actual Redis connectivity check
    const isHealthy = Math.random() > 0.05;
    
    return {
      service: 'redis',
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: isHealthy ? 'Connected to Redis' : 'Redis connection failed',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: 'redis',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

async function checkExternalServices(): Promise<HealthCheck[]> {
  const services = [
    { name: 'gitea', url: process.env.GITEA_URL },
    { name: 'drone', url: process.env.DRONE_SERVER },
    { name: 'harbor', url: process.env.HARBOR_URL },
    { name: 'argocd', url: process.env.ARGOCD_SERVER }
  ];

  return Promise.all(services.map(async (service) => {
    try {
      // In production, perform actual connectivity checks
      const isHealthy = Math.random() > 0.1;
      
      return {
        service: service.name,
        status: isHealthy ? 'healthy' : 'degraded' as const,
        message: isHealthy ? `Connected to ${service.name}` : `${service.name} connection slow`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service: service.name,
        status: 'unhealthy' as const,
        message: error instanceof Error ? error.message : 'Connection failed',
        timestamp: new Date().toISOString()
      };
    }
  }));
}

export async function GET(request: NextRequest) {
  try {
    const checks: HealthCheck[] = [];
    
    // Check core services
    checks.push(await checkDatabase());
    checks.push(await checkRedis());
    
    // Check external integrations
    const externalChecks = await checkExternalServices();
    checks.push(...externalChecks);

    // Calculate overall status
    const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
    const hasDegraded = checks.some(check => check.status === 'degraded');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const health: SystemHealth = {
      status: overallStatus,
      checks,
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(health, {
      status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': overallStatus
      }
    });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      checks: [],
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed'
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': 'unhealthy'
      }
    });
  }
}

// HEAD request for lightweight health checks
export async function HEAD(request: NextRequest) {
  try {
    // Quick health check - just verify the service is responding
    return new NextResponse(null, { 
      status: 200,
      headers: {
        'X-Health-Status': 'healthy',
        'X-Service-Name': 'control-panel',
        'X-Service-Version': process.env.npm_package_version || '1.0.0'
      }
    });
  } catch (error) {
    return new NextResponse(null, { 
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy'
      }
    });
  }
}
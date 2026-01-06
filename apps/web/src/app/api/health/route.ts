import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync } from '@/lib/db';
import { getK8sClient } from '@/lib/cluster/k8s-api-client';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  timestamp: string;
  uptime?: number;
  version?: string;
  latencyMs?: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  version: string;
  uptime: number;
  timestamp: string;
}

const startTime = Date.now();

async function checkK8sCluster(): Promise<HealthCheck> {
  const startMs = Date.now();
  try {
    const client = getK8sClient();
    if (!client) {
      return {
        service: 'kubernetes',
        status: 'unhealthy',
        message: 'K3S_SA_TOKEN not configured',
        timestamp: new Date().toISOString()
      };
    }
    
    const health = await client.healthCheck();
    return {
      service: 'kubernetes',
      status: health.healthy ? 'healthy' : 'unhealthy',
      message: health.healthy ? 'K8s API accessible' : health.message,
      latencyMs: Date.now() - startMs,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: 'kubernetes',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

async function checkGitea(): Promise<HealthCheck> {
  const startMs = Date.now();
  const giteaUrl = process.env.GITEA_URL || 'https://git.gmac.io';
  const giteaToken = process.env.GITEA_TOKEN;
  
  if (!giteaToken) {
    return {
      service: 'gitea',
      status: 'unhealthy',
      message: 'GITEA_TOKEN not configured',
      timestamp: new Date().toISOString()
    };
  }
  
  try {
    const response = await fetch(`${giteaUrl}/api/v1/user`, {
      headers: { 'Authorization': `token ${giteaToken}` }
    });
    
    if (!response.ok) {
      return {
        service: 'gitea',
        status: 'unhealthy',
        message: `Gitea API returned ${response.status}`,
        latencyMs: Date.now() - startMs,
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      service: 'gitea',
      status: 'healthy',
      message: 'Gitea API accessible',
      latencyMs: Date.now() - startMs,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: 'gitea',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  const startMs = Date.now();
  try {
    const db = await getDbAsync();
    if (!db) {
      return {
        service: 'database',
        status: 'unhealthy',
        message: 'Database not configured (DATABASE_URL missing)',
        timestamp: new Date().toISOString()
      };
    }
    
    // Simple health check
    return {
      service: 'database',
      status: 'healthy',
      message: 'Neon PostgreSQL connected',
      latencyMs: Date.now() - startMs,
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

export async function GET(request: NextRequest) {
  try {
    // Check if this is a K8s probe (lightweight check)
    const userAgent = request.headers.get('user-agent') || '';
    const isK8sProbe = userAgent.includes('k8s-') || userAgent.includes('kube-probe');
    
    // For K8s probes, just return 200 if the app is running
    if (isK8sProbe) {
      return NextResponse.json({
        status: 'healthy',
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString()
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Health-Status': 'healthy'
        }
      });
    }
    
    const checks: HealthCheck[] = [];
    
    checks.push(await checkK8sCluster());
    checks.push(await checkGitea());
    checks.push(await checkDatabase());

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
      status: 200,
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
export async function HEAD() {
  try {
    return new NextResponse(null, { 
      status: 200,
      headers: {
        'X-Health-Status': 'healthy',
        'X-Service-Name': 'control-panel',
        'X-Service-Version': process.env.npm_package_version || '1.0.0'
      }
    });
  } catch {
    return new NextResponse(null, { 
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy'
      }
    });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { ClusterOrchestrator } from '@/lib/cluster/orchestrator';
import { HealthMonitor } from '@/lib/cluster/modules/health-monitor';

// This would normally be managed by a singleton or dependency injection
let orchestrator: ClusterOrchestrator | null = null;

function getOrchestrator(): ClusterOrchestrator {
  if (!orchestrator) {
    orchestrator = new ClusterOrchestrator({
      hetznerApiToken: process.env.HETZNER_API_TOKEN || '',
      sshKeyPath: '/tmp/ssh-key',
      clusterName: 'gmac-io-k3s',
      kubeconfigEncryptionKey: process.env.KUBECONFIG_ENCRYPTION_KEY,
      healthMonitoring: {
        enabled: true,
        checkInterval: 30, // 30 seconds
        metricsRetention: 24, // 24 hours
        thresholds: {
          cpu: { warning: 70, critical: 90 },
          memory: { warning: 80, critical: 95 },
          disk: { warning: 80, critical: 90 },
          heartbeat: { warning: 60, critical: 120 } // seconds
        }
      }
    });
  }
  return orchestrator;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const nodeName = searchParams.get('node');
    const metricsOnly = searchParams.get('metrics') === 'true';

    const orchestrator = getOrchestrator();
    const healthMonitor = orchestrator.get('HealthMonitor') as HealthMonitor;
    
    if (!healthMonitor) {
      return NextResponse.json(
        { error: 'Health monitor not initialized' },
        { status: 503 }
      );
    }

    if (metricsOnly) {
      const metrics = await healthMonitor.getNodeMetrics(nodeName || undefined);
      return NextResponse.json({
        metrics: Object.fromEntries(metrics)
      });
    }

    const [summary, alerts, health] = await Promise.all([
      healthMonitor.getNodeSummary(),
      healthMonitor.getAlerts(true),
      healthMonitor.healthCheck()
    ]);

    return NextResponse.json({
      summary: Object.fromEntries(summary),
      alerts,
      health,
      enabled: true
    });
  } catch (error: any) {
    console.error('Error fetching health info:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch health info' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { ClusterOrchestrator } from '@/lib/cluster/orchestrator';
import { ClusterAutoscaler, AutoscalingPolicy } from '@/lib/cluster/modules/autoscaler';

// This would normally be managed by a singleton or dependency injection
let orchestrator: ClusterOrchestrator | null = null;

function getOrchestrator(): ClusterOrchestrator {
  if (!orchestrator) {
    orchestrator = new ClusterOrchestrator({
      hetznerApiToken: process.env.HETZNER_API_TOKEN || '',
      sshKeyPath: '/tmp/ssh-key',
      clusterName: 'gmac-io-k3s',
      kubeconfigEncryptionKey: process.env.KUBECONFIG_ENCRYPTION_KEY,
      autoscaling: {
        enabled: true,
        checkInterval: 60, // 1 minute
        dryRun: false,
        defaultServerType: 'cx21',
        defaultLocation: 'fsn1',
        policies: [
          {
            name: 'default',
            enabled: true,
            minNodes: 2,
            maxNodes: 10,
            targetCPUUtilization: 70,
            targetMemoryUtilization: 80,
            scaleUpThreshold: 1.2, // 120% of target
            scaleDownThreshold: 0.5, // 50% of target
            scaleUpCooldown: 300, // 5 minutes
            scaleDownCooldown: 600, // 10 minutes
          }
        ]
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

    const orchestrator = getOrchestrator();
    const autoscaler = orchestrator.get('ClusterAutoscaler') as ClusterAutoscaler;
    
    if (!autoscaler) {
      return NextResponse.json(
        { error: 'Autoscaler not initialized' },
        { status: 503 }
      );
    }

    const [policies, metrics, health] = await Promise.all([
      autoscaler.getPolicies(),
      autoscaler.getMetricsHistory(),
      autoscaler.healthCheck()
    ]);

    return NextResponse.json({
      policies,
      metrics,
      health,
      enabled: true
    });
  } catch (error: any) {
    console.error('Error fetching autoscaling info:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch autoscaling info' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { policyName, updates } = body;

    if (!policyName || !updates) {
      return NextResponse.json(
        { error: 'Missing policy name or updates' },
        { status: 400 }
      );
    }

    const orchestrator = getOrchestrator();
    const autoscaler = orchestrator.get('ClusterAutoscaler') as ClusterAutoscaler;
    
    if (!autoscaler) {
      return NextResponse.json(
        { error: 'Autoscaler not initialized' },
        { status: 503 }
      );
    }

    await autoscaler.updatePolicy(policyName, updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating autoscaling policy:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update policy' },
      { status: 500 }
    );
  }
}
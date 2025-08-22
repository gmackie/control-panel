import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { ClusterOrchestrator } from '@/lib/cluster/orchestrator';
import { CostTracker } from '@/lib/cluster/modules/cost-tracker';

// This would normally be managed by a singleton or dependency injection
let orchestrator: ClusterOrchestrator | null = null;

async function getOrchestrator(): Promise<ClusterOrchestrator> {
  if (!orchestrator) {
    orchestrator = new ClusterOrchestrator({
      hetznerApiToken: process.env.HETZNER_API_TOKEN || '',
      sshKeyPath: '/tmp/ssh-key',
      clusterName: 'gmac-io-k3s',
      kubeconfigEncryptionKey: process.env.KUBECONFIG_ENCRYPTION_KEY,
      costTracking: {
        enabled: true,
        checkInterval: 300, // 5 minutes
        historyRetention: 30, // 30 days
        enableOptimizations: true,
        alertThresholds: {
          daily: 10, // €10/day
          monthly: 200, // €200/month
          unusualSpike: 50, // 50% increase
        }
      }
    });
    await orchestrator.initialize();
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
    const days = parseInt(searchParams.get('days') || '7');
    const includeOptimizations = searchParams.get('optimizations') === 'true';

    const orchestrator = await getOrchestrator();
    const costTracker = orchestrator.get('CostTracker') as CostTracker;
    
    if (!costTracker) {
      return NextResponse.json(
        { error: 'Cost tracker not initialized' },
        { status: 503 }
      );
    }

    const [summary, history, optimizations] = await Promise.all([
      costTracker.getCostSummary(),
      costTracker.getCostHistory(days),
      includeOptimizations ? costTracker.getOptimizationRecommendations() : [],
    ]);

    return NextResponse.json({
      summary,
      history,
      optimizations,
      enabled: true
    });
  } catch (error: any) {
    console.error('Error fetching cost data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cost data' },
      { status: 500 }
    );
  }
}
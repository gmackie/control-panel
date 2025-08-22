import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ClusterOrchestrator } from '@/lib/cluster/orchestrator';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orchestrator = await getOrchestrator();
    const stats = await orchestrator.getRegistryStats();

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching registry stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch registry stats' },
      { status: 500 }
    );
  }
}

async function getOrchestrator(): Promise<ClusterOrchestrator> {
  const hetznerToken = process.env.HETZNER_API_TOKEN;
  const sshKeyPath = process.env.SSH_KEY_PATH || '/root/.ssh/id_rsa';
  const clusterName = process.env.CLUSTER_NAME || 'gmac-io';

  if (!hetznerToken) {
    throw new Error('Missing required configuration');
  }

  const orchestrator = new ClusterOrchestrator({
    hetznerApiToken: hetznerToken,
    sshKeyPath,
    clusterName,
    kubeconfigEncryptionKey: process.env.KUBECONFIG_ENCRYPTION_KEY,
    registry: {
      enabled: true,
      type: 'registry',
      url: process.env.REGISTRY_URL || 'registry.gmac.io',
      auth: {
        username: process.env.REGISTRY_USERNAME || 'admin',
        password: process.env.REGISTRY_PASSWORD || 'admin',
      },
      storage: {
        type: 'filesystem',
        config: {},
      },
    },
  });

  await orchestrator.initialize();
  return orchestrator;
}
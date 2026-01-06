import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { InfrastructureManager } from '@/lib/infrastructure/manager';

let infrastructureManager: InfrastructureManager | null = null;

async function getInfrastructureManager(): Promise<InfrastructureManager> {
  if (!infrastructureManager) {
    infrastructureManager = new InfrastructureManager({
      hetznerApiToken: process.env.HETZNER_API_TOKEN || '',
      sshKeyPath: process.env.SSH_KEY_PATH || '/tmp/ssh-key',
      kubeconfigEncryptionKey: process.env.KUBECONFIG_ENCRYPTION_KEY,
    });
    await infrastructureManager.initialize();
  }
  return infrastructureManager;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { type, config } = body;

    if (!type || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: type, config' },
        { status: 400 }
      );
    }

    if (type !== 'k3s-imported') {
      return NextResponse.json(
        { error: 'Only k3s-imported type is supported for import' },
        { status: 400 }
      );
    }

    if (!config.name) {
      return NextResponse.json(
        { error: 'Cluster name is required' },
        { status: 400 }
      );
    }

    if (!config.kubeconfig && (!config.apiEndpoint || !config.apiToken)) {
      return NextResponse.json(
        { error: 'Either kubeconfig or both apiEndpoint and apiToken are required' },
        { status: 400 }
      );
    }

    const manager = await getInfrastructureManager();
    const infrastructure = await manager.importK3sCluster(config);

    return NextResponse.json(infrastructure, { status: 201 });
  } catch (error: any) {
    console.error('Error importing infrastructure:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import infrastructure' },
      { status: 500 }
    );
  }
}

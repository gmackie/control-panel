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
    const { kubeconfig, apiEndpoint, apiToken } = body;

    if (!kubeconfig && (!apiEndpoint || !apiToken)) {
      return NextResponse.json(
        { error: 'Either kubeconfig or both apiEndpoint and apiToken are required' },
        { status: 400 }
      );
    }

    const manager = await getInfrastructureManager();
    const result = await manager.validateClusterConnection({
      kubeconfig,
      apiEndpoint,
      apiToken,
    });

    if (result.success) {
      return NextResponse.json({
        message: result.message,
        details: result.details,
      });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error validating cluster connection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to validate connection' },
      { status: 500 }
    );
  }
}

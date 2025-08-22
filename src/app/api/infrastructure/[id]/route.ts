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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const manager = await getInfrastructureManager();
    const infrastructure = await manager.getInfrastructure(params.id);

    if (!infrastructure) {
      return NextResponse.json(
        { error: 'Infrastructure not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(infrastructure);
  } catch (error: any) {
    console.error('Error fetching infrastructure:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch infrastructure' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const manager = await getInfrastructureManager();
    await manager.deleteInfrastructure(params.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting infrastructure:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete infrastructure' },
      { status: 500 }
    );
  }
}
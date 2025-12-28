import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { InfrastructureManager } from '@/lib/infrastructure/manager';
import { K3sInfraConfig, GiteaVPSInfraConfig } from '@/lib/infrastructure/types';

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

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const manager = await getInfrastructureManager();
    const infrastructures = await manager.listInfrastructures();

    return NextResponse.json(infrastructures);
  } catch (error: any) {
    console.error('Error fetching infrastructures:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch infrastructures' },
      { status: 500 }
    );
  }
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

    const manager = await getInfrastructureManager();
    let infrastructure;

    if (type === 'k3s') {
      infrastructure = await manager.createK3sCluster(config as Omit<K3sInfraConfig, 'type'>);
    } else if (type === 'gitea-vps') {
      infrastructure = await manager.createGiteaVPS(config as Omit<GiteaVPSInfraConfig, 'type'>);
    } else {
      return NextResponse.json(
        { error: 'Invalid infrastructure type' },
        { status: 400 }
      );
    }

    return NextResponse.json(infrastructure, { status: 201 });
  } catch (error: any) {
    console.error('Error creating infrastructure:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create infrastructure' },
      { status: 500 }
    );
  }
}
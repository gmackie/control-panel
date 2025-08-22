import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ClusterOrchestrator } from '@/lib/cluster/orchestrator';
import { RegistryManager } from '@/lib/cluster/modules/registry-manager';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orchestrator = await getOrchestrator();
    const registry = orchestrator.get('registry-manager') as RegistryManager;
    
    if (!registry) {
      return NextResponse.json(
        { error: 'Registry not configured' },
        { status: 503 }
      );
    }

    const repositories = await registry.listRepositories();
    return NextResponse.json(repositories);
  } catch (error: any) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repository = searchParams.get('repository');
    const tag = searchParams.get('tag');

    if (!repository || !tag) {
      return NextResponse.json(
        { error: 'Repository and tag are required' },
        { status: 400 }
      );
    }

    const orchestrator = await getOrchestrator();
    const registry = orchestrator.get('registry-manager') as RegistryManager;
    
    if (!registry) {
      return NextResponse.json(
        { error: 'Registry not configured' },
        { status: 503 }
      );
    }

    await registry.deleteImage(repository, tag);
    return NextResponse.json({ message: 'Image deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete image' },
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
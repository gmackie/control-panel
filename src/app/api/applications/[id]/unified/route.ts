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
    const applications = await manager.getUnifiedApplications();
    
    // Find the specific application
    const app = applications.find(a => a.id === params.id);
    
    if (!app) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    // Mock some additional data for demo purposes
    const enrichedApp = {
      ...app,
      repository: app.repository || {
        provider: 'gitea' as const,
        url: `https://ci.gmac.io/gmac/${params.id}`,
        private: true,
        defaultBranch: 'main',
        branches: ['main', 'develop', 'feature/new-ui'],
        lastCommit: {
          sha: 'abc123def456',
          message: 'Update dependencies and fix security vulnerabilities',
          author: 'gmac',
          date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
      },
      secrets: [
        { name: 'DATABASE_URL', created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), updated: new Date() },
        { name: 'API_KEY', created: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), updated: new Date() },
        { name: 'JWT_SECRET', created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), updated: new Date() },
      ],
      monitoring: {
        enabled: true,
        provider: 'prometheus' as const,
        dashboardUrl: `https://monitoring.gmac.io/d/${params.id}`,
        alerts: [
          {
            name: 'High Memory Usage',
            severity: 'warning' as const,
            status: 'firing' as const,
            message: 'Memory usage above 80% for more than 5 minutes',
          },
        ],
      },
      cost: {
        total: 12.50,
        breakdown: {
          compute: 8.00,
          storage: 2.50,
          network: 1.50,
          other: 0.50,
        },
        trend: 'stable' as const,
        currency: 'USD',
      },
    };

    // Add mock deployment data if none exists
    if (enrichedApp.deployments.length === 0) {
      enrichedApp.deployments.push({
        id: `mock-${params.id}`,
        applicationId: params.id,
        infrastructureId: 'k3s-default',
        infrastructureType: 'k3s',
        environment: 'production',
        status: 'running',
        version: 'v1.2.3',
        url: `https://${params.id}.gmac.io`,
        created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        updated: new Date(),
        git: {
          repository: enrichedApp.repository.url,
          branch: 'main',
          commit: 'abc123def456',
          author: 'gmac',
          message: 'Deploy latest changes',
        },
        cicd: {
          provider: 'gitea-actions',
          workflowId: 'deploy.yml',
          runId: '12345',
          status: 'completed',
          conclusion: 'success',
          duration: 180000, // 3 minutes
        },
        registry: {
          provider: 'harbor',
          image: `registry.gmac.io/${params.id}`,
          tag: 'v1.2.3',
          digest: 'sha256:abcdef1234567890',
          size: 156 * 1024 * 1024, // 156 MB
          layers: 12,
          vulnerabilities: {
            critical: 0,
            high: 1,
            medium: 3,
            low: 7,
          },
        },
        runtime: {
          replicas: 2,
          cpu: {
            requested: 0.1,
            limit: 0.5,
            usage: 0.15,
          },
          memory: {
            requested: 256,
            limit: 512,
            usage: 320,
          },
          storage: {
            size: 10,
            usage: 3.5,
          },
        },
      });
    }

    return NextResponse.json(enrichedApp);
  } catch (error: any) {
    console.error('Error fetching unified application:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch application' },
      { status: 500 }
    );
  }
}
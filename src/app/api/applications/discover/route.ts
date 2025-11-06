import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDiscoveryService } from '@/lib/applications/discovery';

/**
 * GET /api/applications/discover
 *
 * Discovers all applications running in Kubernetes clusters
 *
 * Query parameters:
 * - clusterName: Filter by specific cluster (optional)
 * - namespace: Filter by specific namespace (optional)
 * - includeManaged: Include apps already managed by control panel (default: false)
 * - includeSystem: Include system namespaces (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const clusterName = searchParams.get('clusterName') || undefined;
    const namespace = searchParams.get('namespace') || undefined;
    const includeManaged = searchParams.get('includeManaged') === 'true';
    const includeSystem = searchParams.get('includeSystem') === 'true';

    const discoveryService = await getDiscoveryService();

    const discoveredApps = await discoveryService.discoverApplications({
      clusterName,
      namespaces: namespace ? [namespace] : undefined,
      includeManaged,
      includeSystemNamespaces: includeSystem,
    });

    return NextResponse.json({
      applications: discoveredApps,
      count: discoveredApps.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error discovering applications:', error);
    return NextResponse.json(
      {
        error: 'Failed to discover applications',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

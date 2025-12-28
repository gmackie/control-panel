import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDiscoveryService } from '@/lib/applications/discovery';
import { createApplication } from '@/lib/applications/manager';
import type { DiscoveredApplication } from '@/lib/applications/discovery';

export interface ImportApplicationRequest {
  discoveredApp: DiscoveredApplication;
}

/**
 * POST /api/applications/import
 *
 * Imports a discovered application into the control panel
 *
 * Body:
 * {
 *   "discoveredApp": DiscoveredApplication
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ImportApplicationRequest = await request.json();

    if (!body.discoveredApp) {
      return NextResponse.json(
        { error: 'Missing discoveredApp in request body' },
        { status: 400 }
      );
    }

    const ownerId = (session.user as any).login || session.user.email!;
    const discoveryService = await getDiscoveryService();

    const application = await discoveryService.importApplication(
      body.discoveredApp,
      ownerId
    );

    return NextResponse.json(
      {
        application,
        message: 'Application imported successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error importing application:', error);
    return NextResponse.json(
      {
        error: 'Failed to import application',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/applications/import/bulk
 *
 * Imports multiple discovered applications at once
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: { discoveredApps: DiscoveredApplication[] } = await request.json();

    if (!body.discoveredApps || !Array.isArray(body.discoveredApps)) {
      return NextResponse.json(
        { error: 'Missing or invalid discoveredApps in request body' },
        { status: 400 }
      );
    }

    const ownerId = (session.user as any).login || session.user.email!;
    const discoveryService = await getDiscoveryService();

    const results = await Promise.allSettled(
      body.discoveredApps.map(app =>
        discoveryService.importApplication(app, ownerId)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    return NextResponse.json({
      imported: successful.length,
      failed: failed.length,
      applications: successful.map(r => (r as any).value),
      errors: failed.map(r => (r as any).reason?.message),
    });
  } catch (error) {
    console.error('Error bulk importing applications:', error);
    return NextResponse.json(
      {
        error: 'Failed to bulk import applications',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

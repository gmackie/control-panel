import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { alertManagerClient } from '@/lib/prometheus/alertmanager-client';

/**
 * GET /api/alertmanager/config
 * Return the current AlertManager configuration
 */
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const config = await alertManagerClient.getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching AlertManager config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch AlertManager config' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/alertmanager/config
 * Update AlertManager configuration and auto-reload
 */
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();

    if (!body.config) {
      return NextResponse.json(
        { error: 'Missing required field: config' },
        { status: 400 }
      );
    }

    if (!body.config.route || !body.config.receivers) {
      return NextResponse.json(
        { error: 'Config must include route and receivers' },
        { status: 400 }
      );
    }

    await alertManagerClient.updateConfig(body.config);

    // Auto-reload AlertManager after config update
    try {
      await alertManagerClient.reload();
    } catch (reloadError) {
      console.warn('AlertManager config updated but reload failed:', reloadError);
      return NextResponse.json({
        success: true,
        warning: 'Config updated but AlertManager reload failed. Manual reload may be required.',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating AlertManager config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update AlertManager config' },
      { status: 500 }
    );
  }
}

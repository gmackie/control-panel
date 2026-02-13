import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { alertManagerClient } from '@/lib/prometheus/alertmanager-client';

/**
 * POST /api/alertmanager/reload
 * Trigger an AlertManager configuration reload
 */
export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    await alertManagerClient.reload();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reloading AlertManager:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reload AlertManager' },
      { status: 500 }
    );
  }
}

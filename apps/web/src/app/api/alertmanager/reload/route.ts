import { NextResponse } from 'next/server';
import { alertManagerClient } from '@/lib/prometheus/alertmanager-client';

/**
 * POST /api/alertmanager/reload
 * Trigger an AlertManager configuration reload
 */
export async function POST() {
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

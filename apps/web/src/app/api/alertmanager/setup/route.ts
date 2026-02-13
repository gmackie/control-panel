import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { alertManagerClient } from '@/lib/prometheus/alertmanager-client';

const RECEIVER_NAME = 'control-panel-webhook';

/**
 * POST /api/alertmanager/setup
 *
 * Idempotently configures AlertManager to send all alerts to the control panel
 * webhook endpoint. Adds a receiver and a catch-all route with continue: true
 * so other routes still fire.
 */
export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const config = await alertManagerClient.getConfig();

    // Check if receiver already exists (idempotent)
    const existingReceiver = config.receivers.find((r) => r.name === RECEIVER_NAME);

    if (existingReceiver) {
      return NextResponse.json({
        success: true,
        message: 'Control panel webhook receiver already configured',
        alreadyConfigured: true,
      });
    }

    // Build the webhook URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://control.gmac.io';
    const webhookUrl = `${baseUrl}/api/webhooks/prometheus/alerts`;

    // Add the webhook receiver
    config.receivers.push({
      name: RECEIVER_NAME,
      webhook_configs: [
        {
          url: webhookUrl,
          send_resolved: true,
        },
      ],
    });

    // Add a catch-all route with continue: true so it doesn't stop other routes
    if (!config.route.routes) {
      config.route.routes = [];
    }

    // Insert at the beginning so it matches first but continues to other routes
    config.route.routes.unshift({
      receiver: RECEIVER_NAME,
      continue: true,
    });

    // Update the config and reload
    await alertManagerClient.updateConfig(config);

    try {
      await alertManagerClient.reload();
    } catch (reloadError) {
      console.warn('AlertManager config updated but reload failed:', reloadError);
      return NextResponse.json({
        success: true,
        warning: 'Webhook configured but AlertManager reload failed. Manual reload may be required.',
        webhookUrl,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Control panel webhook receiver configured successfully',
      webhookUrl,
      alreadyConfigured: false,
    });
  } catch (error) {
    console.error('Error setting up AlertManager webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to setup AlertManager webhook' },
      { status: 500 }
    );
  }
}

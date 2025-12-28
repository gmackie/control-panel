import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { ClusterOrchestrator } from '@/lib/cluster/orchestrator';
import { HealthMonitor } from '@/lib/cluster/modules/health-monitor';

// This would normally be managed by a singleton or dependency injection
let orchestrator: ClusterOrchestrator | null = null;

function getOrchestrator(): ClusterOrchestrator {
  if (!orchestrator) {
    orchestrator = new ClusterOrchestrator({
      hetznerApiToken: process.env.HETZNER_API_TOKEN || '',
      sshKeyPath: '/tmp/ssh-key',
      clusterName: 'gmac-io-k3s',
      kubeconfigEncryptionKey: process.env.KUBECONFIG_ENCRYPTION_KEY,
      healthMonitoring: {
        enabled: true,
        checkInterval: 30,
        metricsRetention: 24,
        thresholds: {
          cpu: { warning: 70, critical: 90 },
          memory: { warning: 80, critical: 95 },
          disk: { warning: 80, critical: 90 },
          heartbeat: { warning: 60, critical: 120 }
        }
      }
    });
  }
  return orchestrator;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const orchestrator = getOrchestrator();
    const healthMonitor = orchestrator.get('HealthMonitor') as HealthMonitor;
    
    if (!healthMonitor) {
      return NextResponse.json(
        { error: 'Health monitor not initialized' },
        { status: 503 }
      );
    }

    // Create a TransformStream for SSE
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Send initial data
    const initialData = await healthMonitor.getNodeSummary();
    await writer.write(
      encoder.encode(`data: ${JSON.stringify({
        type: 'summary',
        data: Object.fromEntries(initialData)
      })}\n\n`)
    );

    // Set up event listeners
    const metricsHandler = async (event: any) => {
      try {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'metrics',
            ...event
          })}\n\n`)
        );
      } catch (error) {
        console.error('Error writing metrics to stream:', error);
      }
    };

    const alertHandler = async (alert: any) => {
      try {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'alert',
            data: alert
          })}\n\n`)
        );
      } catch (error) {
        console.error('Error writing alert to stream:', error);
      }
    };

    const alertResolvedHandler = async (alert: any) => {
      try {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'alertResolved',
            data: alert
          })}\n\n`)
        );
      } catch (error) {
        console.error('Error writing alert resolution to stream:', error);
      }
    };

    // Subscribe to events
    healthMonitor.on('metrics', metricsHandler);
    healthMonitor.on('alert', alertHandler);
    healthMonitor.on('alertResolved', alertResolvedHandler);

    // Clean up on disconnect
    request.signal.addEventListener('abort', () => {
      healthMonitor.off('metrics', metricsHandler);
      healthMonitor.off('alert', alertHandler);
      healthMonitor.off('alertResolved', alertResolvedHandler);
      writer.close();
    });

    // Keep connection alive
    const keepAlive = setInterval(async () => {
      try {
        await writer.write(encoder.encode(':keepalive\n\n'));
      } catch {
        clearInterval(keepAlive);
      }
    }, 30000);

    request.signal.addEventListener('abort', () => {
      clearInterval(keepAlive);
    });

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error in health stream:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create health stream' },
      { status: 500 }
    );
  }
}
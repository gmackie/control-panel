import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookId = params.id;

    // In production, fetch from database
    // const webhook = await db.webhooks.findById(webhookId);
    
    // Mock response for now
    const mockWebhook = {
      id: webhookId,
      applicationId: 'app-1',
      provider: 'stripe',
      url: 'https://api.myapp.com/webhooks/stripe',
      events: ['payment_intent.succeeded', 'payment_intent.failed'],
      enabled: true,
      secret: 'whsec_1234567890',
      created: '2024-01-15T10:00:00Z',
      lastTriggered: '2024-01-16T14:30:00Z',
      status: 'active',
      stats: {
        totalDeliveries: 1250,
        successfulDeliveries: 1245,
        failedDeliveries: 5,
        avgResponseTime: 125,
      },
      recentEvents: [
        {
          id: 'evt-1',
          eventType: 'payment_intent.succeeded',
          status: 'success',
          timestamp: '2024-01-16T14:30:00Z',
          responseTime: 145,
        },
        {
          id: 'evt-2',
          eventType: 'payment_intent.failed',
          status: 'success',
          timestamp: '2024-01-16T14:15:00Z',
          responseTime: 89,
        },
      ],
    };

    return NextResponse.json(mockWebhook);
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookId = params.id;
    const updates = await request.json();

    // In production, update in database
    // const updatedWebhook = await db.webhooks.update(webhookId, updates);

    // Mock response for now
    const updatedWebhook = {
      id: webhookId,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // If enabling/disabling webhook, update with provider
    if ('enabled' in updates) {
      try {
        if (updates.enabled) {
          await enableWebhookWithProvider(webhookId);
        } else {
          await disableWebhookWithProvider(webhookId);
        }
      } catch (error) {
        console.error('Failed to update webhook with provider:', error);
      }
    }

    return NextResponse.json(updatedWebhook);
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookId = params.id;

    // In production, delete from database
    // await db.webhooks.delete(webhookId);
    
    // Also remove from provider
    try {
      await deleteWebhookFromProvider(webhookId);
    } catch (error) {
      console.error('Failed to delete webhook from provider:', error);
      // Continue with deletion even if provider cleanup fails
    }

    return NextResponse.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function enableWebhookWithProvider(webhookId: string): Promise<void> {
  // Implementation would depend on the provider
  console.log(`Enabling webhook ${webhookId} with provider`);
}

async function disableWebhookWithProvider(webhookId: string): Promise<void> {
  // Implementation would depend on the provider
  console.log(`Disabling webhook ${webhookId} with provider`);
}

async function deleteWebhookFromProvider(webhookId: string): Promise<void> {
  // Implementation would depend on the provider
  console.log(`Deleting webhook ${webhookId} from provider`);
}
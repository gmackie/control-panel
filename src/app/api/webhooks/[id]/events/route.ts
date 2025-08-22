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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const eventType = searchParams.get('eventType');

    // Mock events data - in production, fetch from database with pagination
    const mockEvents = [
      {
        id: 'evt-1',
        webhookId: webhookId,
        provider: 'stripe',
        eventType: 'payment_intent.succeeded',
        payload: {
          id: 'pi_1234567890',
          amount: 2000,
          currency: 'usd',
          status: 'succeeded',
        },
        status: 'success',
        attempts: 1,
        responseCode: 200,
        responseTime: 145,
        responseHeaders: {
          'content-type': 'application/json',
          'x-webhook-processed': 'true',
        },
        responseBody: '{"received":true}',
        timestamp: '2024-01-16T14:30:00Z',
        deliveredAt: '2024-01-16T14:30:00Z',
      },
      {
        id: 'evt-2',
        webhookId: webhookId,
        provider: 'stripe',
        eventType: 'payment_intent.failed',
        payload: {
          id: 'pi_0987654321',
          amount: 1500,
          currency: 'usd',
          status: 'requires_payment_method',
          last_payment_error: {
            code: 'card_declined',
            message: 'Your card was declined.',
          },
        },
        status: 'success',
        attempts: 1,
        responseCode: 200,
        responseTime: 89,
        responseHeaders: {
          'content-type': 'application/json',
        },
        responseBody: '{"received":true}',
        timestamp: '2024-01-16T14:15:00Z',
        deliveredAt: '2024-01-16T14:15:00Z',
      },
      {
        id: 'evt-3',
        webhookId: webhookId,
        provider: 'stripe',
        eventType: 'charge.succeeded',
        payload: {
          id: 'ch_1122334455',
          amount: 2000,
          currency: 'usd',
          paid: true,
        },
        status: 'failed',
        attempts: 3,
        responseCode: 500,
        responseTime: 5000,
        responseHeaders: {
          'content-type': 'text/html',
        },
        responseBody: 'Internal Server Error',
        errorMessage: 'Connection timeout after 5 seconds',
        timestamp: '2024-01-16T13:45:00Z',
        nextRetry: '2024-01-16T14:45:00Z',
        lastAttemptAt: '2024-01-16T13:50:00Z',
      },
      {
        id: 'evt-4',
        webhookId: webhookId,
        provider: 'stripe',
        eventType: 'customer.created',
        payload: {
          id: 'cus_1234567890',
          email: 'customer@example.com',
          created: 1642345678,
        },
        status: 'retrying',
        attempts: 2,
        responseCode: 502,
        responseTime: 3000,
        errorMessage: 'Bad Gateway - upstream server error',
        timestamp: '2024-01-16T13:20:00Z',
        nextRetry: '2024-01-16T13:35:00Z',
        lastAttemptAt: '2024-01-16T13:25:00Z',
      },
    ];

    // Apply filters
    let filteredEvents = mockEvents;
    
    if (status) {
      filteredEvents = filteredEvents.filter(event => event.status === status);
    }
    
    if (eventType) {
      filteredEvents = filteredEvents.filter(event => 
        event.eventType.toLowerCase().includes(eventType.toLowerCase())
      );
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

    return NextResponse.json({
      events: paginatedEvents,
      pagination: {
        page,
        limit,
        total: filteredEvents.length,
        pages: Math.ceil(filteredEvents.length / limit),
      },
      filters: {
        status,
        eventType,
      },
    });
  } catch (error) {
    console.error('Error fetching webhook events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookId = params.id;
    const { eventId, action } = await request.json();

    if (!eventId || !action) {
      return NextResponse.json({
        error: 'Missing required fields: eventId, action'
      }, { status: 400 });
    }

    switch (action) {
      case 'retry':
        await retryWebhookEvent(webhookId, eventId);
        return NextResponse.json({ message: 'Event retry initiated' });
      
      case 'cancel':
        await cancelWebhookEvent(webhookId, eventId);
        return NextResponse.json({ message: 'Event cancelled' });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing webhook event action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function retryWebhookEvent(webhookId: string, eventId: string): Promise<void> {
  // In production, this would:
  // 1. Fetch the event details from database
  // 2. Get the webhook endpoint details
  // 3. Queue the event for retry
  // 4. Update the event status to 'retrying'
  
  console.log(`Retrying event ${eventId} for webhook ${webhookId}`);
  
  // Example implementation:
  // const event = await db.webhookEvents.findById(eventId);
  // const webhook = await db.webhooks.findById(webhookId);
  // 
  // await deliveryQueue.add('webhook-delivery', {
  //   webhookId,
  //   eventId,
  //   url: webhook.url,
  //   payload: event.payload,
  //   secret: webhook.secret,
  //   attempt: event.attempts + 1,
  // });
  //
  // await db.webhookEvents.update(eventId, {
  //   status: 'retrying',
  //   nextRetry: new Date(Date.now() + 30000), // 30 seconds from now
  // });
}

async function cancelWebhookEvent(webhookId: string, eventId: string): Promise<void> {
  // In production, this would:
  // 1. Update the event status to 'cancelled'
  // 2. Remove from retry queue if present
  
  console.log(`Cancelling event ${eventId} for webhook ${webhookId}`);
  
  // Example implementation:
  // await deliveryQueue.remove(`webhook-${eventId}`);
  // await db.webhookEvents.update(eventId, {
  //   status: 'cancelled',
  //   cancelledAt: new Date(),
  // });
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface WebhookEndpoint {
  id: string;
  applicationId: string;
  provider: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  created: string;
  lastTriggered?: string;
  status: 'active' | 'failed' | 'disabled';
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    avgResponseTime: number;
  };
  metadata?: {
    description?: string;
    tags?: string[];
  };
}

interface WebhookEvent {
  id: string;
  webhookId: string;
  provider: string;
  eventType: string;
  payload: any;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  attempts: number;
  responseCode?: number;
  responseTime?: number;
  errorMessage?: string;
  timestamp: string;
  nextRetry?: string;
}

// Mock data - in production, this would come from a database
const mockEndpoints: WebhookEndpoint[] = [
  {
    id: '1',
    applicationId: 'app-1',
    provider: 'stripe',
    url: 'https://api.myapp.com/webhooks/stripe',
    events: ['payment_intent.succeeded', 'payment_intent.failed', 'charge.succeeded'],
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
    metadata: {
      description: 'Handle Stripe payment events',
      tags: ['payments', 'production'],
    },
  },
  {
    id: '2',
    applicationId: 'app-1',
    provider: 'sendgrid',
    url: 'https://api.myapp.com/webhooks/sendgrid',
    events: ['delivered', 'opened', 'clicked', 'bounced'],
    enabled: true,
    secret: 'sg_webhook_secret_123',
    created: '2024-01-10T09:00:00Z',
    lastTriggered: '2024-01-16T12:15:00Z',
    status: 'active',
    stats: {
      totalDeliveries: 845,
      successfulDeliveries: 840,
      failedDeliveries: 5,
      avgResponseTime: 89,
    },
    metadata: {
      description: 'Track email delivery events',
      tags: ['email', 'marketing'],
    },
  },
  {
    id: '3',
    applicationId: 'app-1',
    provider: 'twilio',
    url: 'https://api.myapp.com/webhooks/twilio',
    events: ['message-sent', 'message-delivered', 'message-failed'],
    enabled: false,
    created: '2024-01-12T11:00:00Z',
    status: 'disabled',
    stats: {
      totalDeliveries: 156,
      successfulDeliveries: 150,
      failedDeliveries: 6,
      avgResponseTime: 245,
    },
    metadata: {
      description: 'SMS delivery status updates',
      tags: ['sms', 'notifications'],
    },
  },
  {
    id: '4',
    applicationId: 'app-1',
    provider: 'github',
    url: 'https://api.myapp.com/webhooks/github',
    events: ['push', 'pull_request', 'issues'],
    enabled: true,
    created: '2024-01-08T16:00:00Z',
    lastTriggered: '2024-01-16T13:45:00Z',
    status: 'failed',
    stats: {
      totalDeliveries: 89,
      successfulDeliveries: 75,
      failedDeliveries: 14,
      avgResponseTime: 456,
    },
    metadata: {
      description: 'Repository events for CI/CD',
      tags: ['git', 'deployment'],
    },
  },
];

const mockEvents: WebhookEvent[] = [
  {
    id: 'evt-1',
    webhookId: '1',
    provider: 'stripe',
    eventType: 'payment_intent.succeeded',
    payload: { amount: 2000, currency: 'usd' },
    status: 'success',
    attempts: 1,
    responseCode: 200,
    responseTime: 145,
    timestamp: '2024-01-16T14:30:00Z',
  },
  {
    id: 'evt-2',
    webhookId: '2',
    provider: 'sendgrid',
    eventType: 'delivered',
    payload: { email: 'user@example.com', timestamp: 1642345678 },
    status: 'success',
    attempts: 1,
    responseCode: 200,
    responseTime: 89,
    timestamp: '2024-01-16T12:15:00Z',
  },
  {
    id: 'evt-3',
    webhookId: '4',
    provider: 'github',
    eventType: 'push',
    payload: { repository: 'myorg/myrepo', ref: 'refs/heads/main' },
    status: 'failed',
    attempts: 3,
    responseCode: 500,
    responseTime: 5000,
    errorMessage: 'Connection timeout',
    timestamp: '2024-01-16T13:45:00Z',
    nextRetry: '2024-01-16T14:45:00Z',
  },
  {
    id: 'evt-4',
    webhookId: '1',
    provider: 'stripe',
    eventType: 'charge.succeeded',
    payload: { amount: 1500, currency: 'usd' },
    status: 'retrying',
    attempts: 2,
    responseCode: 502,
    errorMessage: 'Bad Gateway',
    timestamp: '2024-01-16T13:20:00Z',
    nextRetry: '2024-01-16T13:35:00Z',
  },
  {
    id: 'evt-5',
    webhookId: '2',
    provider: 'sendgrid',
    eventType: 'opened',
    payload: { email: 'another@example.com', timestamp: 1642346789 },
    status: 'success',
    attempts: 1,
    responseCode: 200,
    responseTime: 67,
    timestamp: '2024-01-16T11:30:00Z',
  },
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate stats
    const activeEndpoints = mockEndpoints.filter(e => e.enabled && e.status === 'active').length;
    const totalDeliveries = mockEndpoints.reduce((sum, e) => sum + e.stats.totalDeliveries, 0);
    const successfulDeliveries = mockEndpoints.reduce((sum, e) => sum + e.stats.successfulDeliveries, 0);
    const totalResponseTime = mockEndpoints.reduce((sum, e) => sum + (e.stats.avgResponseTime * e.stats.totalDeliveries), 0);

    const stats = {
      totalEndpoints: mockEndpoints.length,
      activeEndpoints,
      totalEvents: totalDeliveries,
      successRate: totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0,
      avgResponseTime: totalDeliveries > 0 ? Math.round(totalResponseTime / totalDeliveries) : 0,
      topProviders: Array.from(
        mockEndpoints.reduce((acc, endpoint) => {
          const provider = endpoint.provider;
          if (!acc.has(provider)) {
            acc.set(provider, { count: 0, successfulDeliveries: 0, totalDeliveries: 0 });
          }
          const stats = acc.get(provider)!;
          stats.count++;
          stats.successfulDeliveries += endpoint.stats.successfulDeliveries;
          stats.totalDeliveries += endpoint.stats.totalDeliveries;
          return acc;
        }, new Map())
      ).map(([provider, data]) => ({
        provider,
        count: data.count,
        successRate: data.totalDeliveries > 0 ? (data.successfulDeliveries / data.totalDeliveries) * 100 : 0,
      })).sort((a, b) => b.count - a.count),
    };

    return NextResponse.json({
      endpoints: mockEndpoints,
      recentEvents: mockEvents.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
      stats,
    });
  } catch (error) {
    console.error('Error fetching webhook data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.provider || !body.url || !body.events) {
      return NextResponse.json({
        error: 'Missing required fields: provider, url, events'
      }, { status: 400 });
    }

    // Create new webhook endpoint
    const newEndpoint: WebhookEndpoint = {
      id: `webhook-${Date.now()}`,
      applicationId: body.applicationId || 'default-app',
      provider: body.provider,
      url: body.url,
      events: body.events,
      enabled: body.enabled !== false, // Default to enabled
      secret: generateWebhookSecret(),
      created: new Date().toISOString(),
      status: 'active',
      stats: {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        avgResponseTime: 0,
      },
      metadata: {
        description: body.description,
        tags: body.tags || [],
      },
    };

    // In production, save to database
    mockEndpoints.push(newEndpoint);

    // Register webhook with the provider's API
    try {
      await registerWebhookWithProvider(newEndpoint);
    } catch (error) {
      console.error('Failed to register webhook with provider:', error);
      // You might want to mark the webhook as failed or remove it
    }

    return NextResponse.json(newEndpoint, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateWebhookSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let secret = 'whsec_';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

async function registerWebhookWithProvider(endpoint: WebhookEndpoint): Promise<void> {
  // This would implement the actual webhook registration with each provider
  switch (endpoint.provider) {
    case 'stripe':
      // await stripeClient.webhookEndpoints.create({
      //   url: endpoint.url,
      //   enabled_events: endpoint.events,
      // });
      break;
    case 'sendgrid':
      // await sendGridClient.webhooks.create({
      //   url: endpoint.url,
      //   events: endpoint.events,
      // });
      break;
    case 'twilio':
      // Register Twilio webhook
      break;
    case 'github':
      // Register GitHub webhook
      break;
    default:
      console.log(`No registration handler for provider: ${endpoint.provider}`);
  }
}
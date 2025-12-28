import { NextRequest, NextResponse } from "next/server";

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'webhook' | 'slack' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  successRate: number;
  messagesSent: number;
  tags: string[];
  description?: string;
  rateLimits?: {
    maxPerMinute: number;
    maxPerHour: number;
  };
  retryConfig?: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

const generateMockChannels = (): NotificationChannel[] => {
  const now = new Date();
  return [
    {
      id: 'email-ops',
      name: 'Operations Email',
      type: 'email',
      config: { 
        recipients: ['ops@gmac.io', 'alerts@gmac.io'], 
        smtpServer: 'smtp.gmail.com',
        from: 'alerts@gmac.io',
        subject: '[ALERT] {{ .CommonLabels.alertname }}',
        template: 'html'
      },
      enabled: true,
      createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      successRate: 98.5,
      messagesSent: 1247,
      tags: ['critical', 'operations'],
      description: 'Primary email channel for operations team alerts',
      rateLimits: {
        maxPerMinute: 10,
        maxPerHour: 100
      },
      retryConfig: {
        maxRetries: 3,
        backoffMultiplier: 2
      }
    },
    {
      id: 'slack-alerts',
      name: 'Slack #alerts',
      type: 'slack',
      config: { 
        webhookUrl: 'https://hooks.slack.com/services/T123/B456/xyz',
        channel: '#alerts',
        username: 'AlertBot',
        iconEmoji: ':warning:',
        color: 'danger'
      },
      enabled: true,
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(now.getTime() - 15 * 60 * 1000),
      successRate: 99.2,
      messagesSent: 892,
      tags: ['slack', 'real-time'],
      description: 'Real-time alerts to development team Slack channel',
      rateLimits: {
        maxPerMinute: 20,
        maxPerHour: 300
      }
    },
    {
      id: 'webhook-api',
      name: 'Webhook API Integration',
      type: 'webhook',
      config: { 
        url: 'https://api.gmac.io/webhooks/alerts',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ***',
          'Content-Type': 'application/json'
        },
        timeout: 30,
        insecureSkipVerify: false
      },
      enabled: true,
      createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(now.getTime() - 45 * 60 * 1000),
      successRate: 95.8,
      messagesSent: 543,
      tags: ['webhook', 'api', 'automation'],
      description: 'Webhook for custom alert processing and automation',
      rateLimits: {
        maxPerMinute: 50,
        maxPerHour: 1000
      },
      retryConfig: {
        maxRetries: 5,
        backoffMultiplier: 1.5
      }
    },
    {
      id: 'pagerduty',
      name: 'PagerDuty Escalation',
      type: 'pagerduty',
      config: { 
        serviceKey: 'pd-service-key-123',
        severity: 'critical',
        client: 'GMAC.IO Monitoring',
        clientUrl: 'https://monitor.gmac.io'
      },
      enabled: false,
      createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      successRate: 100.0,
      messagesSent: 23,
      tags: ['pagerduty', 'escalation', 'critical'],
      description: 'PagerDuty integration for critical incident escalation',
      rateLimits: {
        maxPerMinute: 5,
        maxPerHour: 50
      }
    },
    {
      id: 'sms-oncall',
      name: 'On-Call SMS',
      type: 'sms',
      config: { 
        provider: 'twilio',
        accountSid: 'ACxxx',
        authToken: '***',
        fromNumber: '+1234567890',
        recipients: ['+1987654321', '+1555123456']
      },
      enabled: true,
      createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      successRate: 97.3,
      messagesSent: 156,
      tags: ['sms', 'urgent', 'on-call'],
      description: 'SMS notifications for urgent alerts to on-call engineers',
      rateLimits: {
        maxPerMinute: 3,
        maxPerHour: 20
      }
    },
    {
      id: 'slack-backend',
      name: 'Slack #backend',
      type: 'slack',
      config: { 
        webhookUrl: 'https://hooks.slack.com/services/T123/B789/abc',
        channel: '#backend',
        username: 'BackendBot',
        iconEmoji: ':gear:',
        color: 'warning'
      },
      enabled: true,
      createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      lastUsed: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      successRate: 96.7,
      messagesSent: 324,
      tags: ['backend', 'development'],
      description: 'Backend team alerts for application issues'
    }
  ];
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const enabled = searchParams.get('enabled');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    let channels = generateMockChannels();

    // Apply filters
    if (type && type !== 'all') {
      channels = channels.filter(channel => channel.type === type);
    }
    
    if (enabled !== null && enabled !== 'all') {
      const isEnabled = enabled === 'true';
      channels = channels.filter(channel => channel.enabled === isEnabled);
    }

    // Sort by most recently used first
    channels = channels.sort((a, b) => {
      if (!a.lastUsed && !b.lastUsed) return 0;
      if (!a.lastUsed) return 1;
      if (!b.lastUsed) return -1;
      return b.lastUsed.getTime() - a.lastUsed.getTime();
    });
    
    // Apply limit
    channels = channels.slice(0, limit);

    // Calculate summary statistics
    const stats = {
      total: channels.length,
      enabled: channels.filter(c => c.enabled).length,
      disabled: channels.filter(c => !c.enabled).length,
      totalMessagesSent: channels.reduce((sum, c) => sum + c.messagesSent, 0),
      avgSuccessRate: channels.reduce((sum, c) => sum + c.successRate, 0) / channels.length,
      byType: {
        email: channels.filter(c => c.type === 'email').length,
        slack: channels.filter(c => c.type === 'slack').length,
        webhook: channels.filter(c => c.type === 'webhook').length,
        sms: channels.filter(c => c.type === 'sms').length,
        pagerduty: channels.filter(c => c.type === 'pagerduty').length
      }
    };

    return NextResponse.json({
      success: true,
      channels,
      stats,
      totalCount: generateMockChannels().length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching notification channels:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification channels' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, config, description, enabled = true, tags = [] } = body;

    // Validate required fields
    if (!name || !type || !config) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, type, config' },
        { status: 400 }
      );
    }

    // Validate channel type
    const validTypes = ['email', 'sms', 'webhook', 'slack', 'pagerduty'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid channel type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate type-specific config
    let configValidation = validateChannelConfig(type, config);
    if (!configValidation.valid) {
      return NextResponse.json(
        { success: false, error: `Invalid config: ${configValidation.error}` },
        { status: 400 }
      );
    }

    // Create new channel (mock implementation)
    const now = new Date();
    const newChannel: NotificationChannel = {
      id: `channel-${Date.now()}`,
      name,
      type,
      config,
      enabled,
      description,
      tags,
      createdAt: now,
      updatedAt: now,
      successRate: 100.0,
      messagesSent: 0
    };

    return NextResponse.json({
      success: true,
      channel: newChannel,
      message: 'Notification channel created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating notification channel:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create notification channel' },
      { status: 500 }
    );
  }
}

function validateChannelConfig(type: string, config: Record<string, any>): { valid: boolean; error?: string } {
  switch (type) {
    case 'email':
      if (!config.recipients || !Array.isArray(config.recipients) || config.recipients.length === 0) {
        return { valid: false, error: 'Email config must include recipients array' };
      }
      if (!config.smtpServer) {
        return { valid: false, error: 'Email config must include smtpServer' };
      }
      break;

    case 'slack':
      if (!config.webhookUrl) {
        return { valid: false, error: 'Slack config must include webhookUrl' };
      }
      if (!config.channel) {
        return { valid: false, error: 'Slack config must include channel' };
      }
      break;

    case 'webhook':
      if (!config.url) {
        return { valid: false, error: 'Webhook config must include url' };
      }
      if (!config.method) {
        return { valid: false, error: 'Webhook config must include method' };
      }
      break;

    case 'sms':
      if (!config.provider) {
        return { valid: false, error: 'SMS config must include provider' };
      }
      if (!config.recipients || !Array.isArray(config.recipients) || config.recipients.length === 0) {
        return { valid: false, error: 'SMS config must include recipients array' };
      }
      break;

    case 'pagerduty':
      if (!config.serviceKey) {
        return { valid: false, error: 'PagerDuty config must include serviceKey' };
      }
      break;

    default:
      return { valid: false, error: 'Unknown channel type' };
  }

  return { valid: true };
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: 'metric' | 'log' | 'event' | 'composite';
  target: {
    service?: string;
    metric?: string;
    query?: string;
    labels?: Record<string, string>;
  };
  conditions: {
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'regex';
    threshold: number | string;
    duration: string; // e.g., "5m", "1h"
    aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  };
  actions: Array<{
    type: 'notification' | 'webhook' | 'escalation' | 'auto_resolve';
    target: string;
    parameters?: Record<string, any>;
  }>;
  cooldown?: string; // e.g., "15m"
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastTriggered?: Date;
  triggerCount: number;
}

interface AlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  status: 'firing' | 'pending' | 'resolved';
  severity: string;
  message: string;
  value: number | string;
  threshold: number | string;
  startTime: Date;
  endTime?: Date;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  silenced: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

// Mock data for alert rules
function generateMockAlertRules(): AlertRule[] {
  const now = new Date();
  
  return [
    {
      id: 'rule-001',
      name: 'High CPU Usage',
      description: 'Alert when CPU usage exceeds 80% for 5 minutes',
      enabled: true,
      severity: 'high',
      type: 'metric',
      target: {
        service: 'k3s-cluster',
        metric: 'cpu_usage_percent',
        labels: { job: 'node-exporter' }
      },
      conditions: {
        operator: 'gt',
        threshold: 80,
        duration: '5m',
        aggregation: 'avg'
      },
      actions: [
        {
          type: 'notification',
          target: 'slack-alerts',
          parameters: { channel: '#infrastructure' }
        },
        {
          type: 'notification',
          target: 'email-admins',
          parameters: { recipients: ['admin@gmac.io'] }
        }
      ],
      cooldown: '15m',
      createdAt: new Date(now.getTime() - 86400000 * 7),
      updatedAt: new Date(now.getTime() - 86400000 * 1),
      createdBy: 'admin@gmac.io',
      lastTriggered: new Date(now.getTime() - 3600000 * 2),
      triggerCount: 3
    },
    {
      id: 'rule-002',
      name: 'Database Connection Pool Exhausted',
      description: 'Alert when database connection pool usage exceeds 90%',
      enabled: true,
      severity: 'critical',
      type: 'metric',
      target: {
        service: 'postgresql',
        metric: 'db_connections_active',
        labels: { instance: 'db.gmac.io:5432' }
      },
      conditions: {
        operator: 'gte',
        threshold: 90,
        duration: '1m',
        aggregation: 'max'
      },
      actions: [
        {
          type: 'notification',
          target: 'pagerduty',
          parameters: { service_key: 'db-service-key' }
        },
        {
          type: 'webhook',
          target: 'https://hooks.gmac.io/database-alert',
          parameters: { timeout: 30 }
        }
      ],
      cooldown: '30m',
      createdAt: new Date(now.getTime() - 86400000 * 14),
      updatedAt: new Date(now.getTime() - 86400000 * 3),
      createdBy: 'dba@gmac.io',
      triggerCount: 1
    },
    {
      id: 'rule-003',
      name: 'ArgoCD Sync Failure',
      description: 'Alert when ArgoCD application sync fails',
      enabled: true,
      severity: 'medium',
      type: 'event',
      target: {
        service: 'argocd',
        query: 'sync_status == "Failed"',
        labels: { component: 'argocd-application-controller' }
      },
      conditions: {
        operator: 'gt',
        threshold: 0,
        duration: '2m'
      },
      actions: [
        {
          type: 'notification',
          target: 'slack-deployments',
          parameters: { channel: '#deployments' }
        }
      ],
      cooldown: '10m',
      createdAt: new Date(now.getTime() - 86400000 * 5),
      updatedAt: new Date(now.getTime() - 86400000 * 1),
      createdBy: 'devops@gmac.io',
      lastTriggered: new Date(now.getTime() - 3600000 * 6),
      triggerCount: 2
    },
    {
      id: 'rule-004',
      name: 'SSL Certificate Expiry',
      description: 'Alert when SSL certificates expire within 30 days',
      enabled: true,
      severity: 'info',
      type: 'metric',
      target: {
        service: 'cert-manager',
        metric: 'ssl_cert_expiry_days',
        labels: { namespace: 'cert-manager' }
      },
      conditions: {
        operator: 'lt',
        threshold: 30,
        duration: '1h',
        aggregation: 'min'
      },
      actions: [
        {
          type: 'notification',
          target: 'email-security',
          parameters: { recipients: ['security@gmac.io'] }
        }
      ],
      cooldown: '24h',
      createdAt: new Date(now.getTime() - 86400000 * 21),
      updatedAt: new Date(now.getTime() - 86400000 * 7),
      createdBy: 'security@gmac.io',
      triggerCount: 0
    },
    {
      id: 'rule-005',
      name: 'High Error Rate',
      description: 'Alert when application error rate exceeds 5%',
      enabled: true,
      severity: 'high',
      type: 'metric',
      target: {
        service: 'control-panel-api',
        metric: 'http_requests_total',
        labels: { code: '5xx' }
      },
      conditions: {
        operator: 'gt',
        threshold: 5,
        duration: '3m',
        aggregation: 'avg'
      },
      actions: [
        {
          type: 'notification',
          target: 'slack-alerts',
          parameters: { channel: '#alerts' }
        },
        {
          type: 'escalation',
          target: 'on-call-engineer',
          parameters: { delay: '10m' }
        }
      ],
      cooldown: '20m',
      createdAt: new Date(now.getTime() - 86400000 * 10),
      updatedAt: new Date(now.getTime() - 86400000 * 2),
      createdBy: 'sre@gmac.io',
      lastTriggered: new Date(now.getTime() - 3600000 * 8),
      triggerCount: 5
    }
  ];
}

// Mock data for alert instances
function generateMockAlertInstances(): AlertInstance[] {
  const now = new Date();
  
  return [
    {
      id: 'alert-001',
      ruleId: 'rule-001',
      ruleName: 'High CPU Usage',
      status: 'firing',
      severity: 'high',
      message: 'CPU usage is 85.2% (threshold: 80%)',
      value: 85.2,
      threshold: 80,
      startTime: new Date(now.getTime() - 900000), // 15 minutes ago
      labels: {
        instance: 'k3s-worker-01',
        job: 'node-exporter',
        severity: 'high'
      },
      annotations: {
        summary: 'High CPU usage detected on k3s-worker-01',
        description: 'CPU usage has been above 80% for 15 minutes',
        runbook_url: 'https://wiki.gmac.io/runbooks/high-cpu'
      },
      silenced: false
    },
    {
      id: 'alert-002',
      ruleId: 'rule-003',
      ruleName: 'ArgoCD Sync Failure',
      status: 'resolved',
      severity: 'medium',
      message: 'ArgoCD application sync failed for control-panel',
      value: 'Failed',
      threshold: 'Success',
      startTime: new Date(now.getTime() - 7200000), // 2 hours ago
      endTime: new Date(now.getTime() - 3600000), // 1 hour ago
      labels: {
        application: 'control-panel',
        namespace: 'default',
        severity: 'medium'
      },
      annotations: {
        summary: 'ArgoCD sync failure for control-panel application',
        description: 'Sync operation failed due to resource conflicts'
      },
      silenced: false,
      acknowledgedBy: 'devops@gmac.io',
      acknowledgedAt: new Date(now.getTime() - 6900000)
    }
  ];
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const enabled = searchParams.get('enabled');
    const severity = searchParams.get('severity');
    const service = searchParams.get('service');
    const type = searchParams.get('type');

    let rules = generateMockAlertRules();

    // Apply filters
    if (enabled !== null) {
      const isEnabled = enabled === 'true';
      rules = rules.filter(rule => rule.enabled === isEnabled);
    }

    if (severity) {
      rules = rules.filter(rule => rule.severity === severity);
    }

    if (service) {
      rules = rules.filter(rule => rule.target.service === service);
    }

    if (type) {
      rules = rules.filter(rule => rule.type === type);
    }

    // Sort by severity and last triggered
    rules.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      
      if (severityDiff !== 0) return severityDiff;
      
      const aTime = a.lastTriggered?.getTime() || 0;
      const bTime = b.lastTriggered?.getTime() || 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      rules,
      totalCount: rules.length,
      summary: {
        enabled: rules.filter(r => r.enabled).length,
        disabled: rules.filter(r => !r.enabled).length,
        bySeverity: {
          critical: rules.filter(r => r.severity === 'critical').length,
          high: rules.filter(r => r.severity === 'high').length,
          medium: rules.filter(r => r.severity === 'medium').length,
          low: rules.filter(r => r.severity === 'low').length,
          info: rules.filter(r => r.severity === 'info').length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching alert rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['name', 'severity', 'type', 'target', 'conditions'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate severity
    const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
    if (!validSeverities.includes(body.severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate alert type
    const validTypes = ['metric', 'log', 'event', 'composite'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const now = new Date();
    const newRule: AlertRule = {
      id: `rule-${Date.now()}`,
      name: body.name,
      description: body.description,
      enabled: body.enabled ?? true,
      severity: body.severity,
      type: body.type,
      target: body.target,
      conditions: body.conditions,
      actions: body.actions || [],
      cooldown: body.cooldown || '15m',
      createdAt: now,
      updatedAt: now,
      createdBy: session.user?.email || 'unknown',
      triggerCount: 0
    };

    // In a real implementation, this would:
    // 1. Validate the rule configuration
    // 2. Store in database
    // 3. Register with monitoring system (Prometheus, etc.)
    // 4. Test the rule if requested
    // 5. Send notification about new rule creation

    return NextResponse.json({
      success: true,
      rule: newRule,
      message: 'Alert rule created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating alert rule:', error);
    return NextResponse.json(
      { error: 'Failed to create alert rule' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing rule ID' },
        { status: 400 }
      );
    }

    // In a real implementation, this would:
    // 1. Find the existing rule
    // 2. Validate updates
    // 3. Update in database
    // 4. Update monitoring system configuration
    // 5. Send notification about rule changes

    const updatedRule = {
      ...updates,
      id,
      updatedAt: new Date(),
      updatedBy: session.user?.email || 'unknown'
    };

    return NextResponse.json({
      success: true,
      rule: updatedRule,
      message: 'Alert rule updated successfully'
    });

  } catch (error) {
    console.error('Error updating alert rule:', error);
    return NextResponse.json(
      { error: 'Failed to update alert rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Missing rule ID' },
        { status: 400 }
      );
    }

    // In a real implementation, this would:
    // 1. Find and validate the rule exists
    // 2. Remove from monitoring system
    // 3. Delete from database
    // 4. Clean up any active alerts from this rule
    // 5. Send notification about rule deletion

    return NextResponse.json({
      success: true,
      ruleId,
      message: 'Alert rule deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting alert rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert rule' },
      { status: 500 }
    );
  }
}
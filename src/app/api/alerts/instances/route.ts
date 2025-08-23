import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface AlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  status: 'firing' | 'pending' | 'resolved';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  value: number | string;
  threshold: number | string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // Duration in milliseconds
  labels: Record<string, string>;
  annotations: Record<string, string>;
  silenced: boolean;
  silencedUntil?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  fingerprint: string;
  generatorURL?: string;
}

interface AlertSummary {
  total: number;
  firing: number;
  pending: number;
  resolved: number;
  silenced: number;
  acknowledged: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  byService: Record<string, number>;
  recentResolutions: AlertInstance[];
  longestFiring: AlertInstance[];
}

// Generate mock alert instances
function generateMockAlertInstances(): AlertInstance[] {
  const now = new Date();
  
  const alerts: AlertInstance[] = [];
  
  // Generate firing alerts
  const firingAlerts: AlertInstance[] = [
    {
      id: 'alert-001',
      ruleId: 'rule-001',
      ruleName: 'High CPU Usage',
      status: 'firing' as const,
      severity: 'high' as const,
      message: 'CPU usage is 87.3% (threshold: 80%)',
      value: 87.3,
      threshold: 80,
      startTime: new Date(now.getTime() - 1800000), // 30 minutes ago
      labels: {
        instance: 'k3s-worker-01',
        job: 'node-exporter',
        severity: 'high',
        team: 'infrastructure'
      },
      annotations: {
        summary: 'High CPU usage detected on k3s-worker-01',
        description: 'CPU usage has been above 80% for 30 minutes. This may impact application performance.',
        runbook_url: 'https://wiki.gmac.io/runbooks/high-cpu',
        dashboard_url: 'https://grafana.gmac.io/d/node-exporter'
      },
      silenced: false,
      fingerprint: 'cpu-high-k3s-worker-01',
      generatorURL: 'https://prometheus.gmac.io/graph?g0.expr=cpu_usage_percent'
    },
    {
      id: 'alert-002',
      ruleId: 'rule-002',
      ruleName: 'Database Connection Pool Exhausted',
      status: 'firing' as const,
      severity: 'critical' as const,
      message: 'Database connection pool at 95% capacity (threshold: 90%)',
      value: 95,
      threshold: 90,
      startTime: new Date(now.getTime() - 600000), // 10 minutes ago
      labels: {
        instance: 'db.gmac.io:5432',
        database: 'control_panel',
        severity: 'critical',
        team: 'database'
      },
      annotations: {
        summary: 'Database connection pool nearly exhausted',
        description: 'Connection pool usage is critically high. New connections may be refused.',
        runbook_url: 'https://wiki.gmac.io/runbooks/database-connections',
        impact: 'Application may experience connection timeouts'
      },
      silenced: false,
      acknowledgedBy: 'dba@gmac.io',
      acknowledgedAt: new Date(now.getTime() - 300000),
      fingerprint: 'db-connections-high',
      generatorURL: 'https://prometheus.gmac.io/graph?g0.expr=db_connections_active'
    }
  ];
  
  // Generate resolved alerts
  const resolvedAlerts: AlertInstance[] = [
    {
      id: 'alert-005',
      ruleId: 'rule-003',
      ruleName: 'ArgoCD Sync Failure',
      status: 'resolved' as const,
      severity: 'medium' as const,
      message: 'ArgoCD application sync failed for control-panel',
      value: 'Failed',
      threshold: 'Success',
      startTime: new Date(now.getTime() - 7200000), // 2 hours ago
      endTime: new Date(now.getTime() - 3600000), // 1 hour ago
      duration: 3600000, // 1 hour
      labels: {
        application: 'control-panel',
        namespace: 'default',
        severity: 'medium',
        team: 'devops'
      },
      annotations: {
        summary: 'ArgoCD sync failure resolved',
        description: 'Sync operation failed due to resource conflicts but has been resolved',
        resolution: 'Manual sync performed after resource cleanup'
      },
      silenced: false,
      acknowledgedBy: 'devops@gmac.io',
      acknowledgedAt: new Date(now.getTime() - 6900000),
      fingerprint: 'argocd-sync-failed-control-panel'
    }
  ];
  
  return [...firingAlerts, ...resolvedAlerts];
}

// Calculate alert summary statistics
function calculateAlertSummary(alerts: AlertInstance[]): AlertSummary {
  const summary: AlertSummary = {
    total: alerts.length,
    firing: 0,
    pending: 0,
    resolved: 0,
    silenced: 0,
    acknowledged: 0,
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    },
    byService: {},
    recentResolutions: [],
    longestFiring: []
  };
  
  alerts.forEach(alert => {
    // Count by status
    summary[alert.status]++;
    
    // Count silenced alerts
    if (alert.silenced) summary.silenced++;
    
    // Count acknowledged alerts
    if (alert.acknowledgedBy) summary.acknowledged++;
    
    // Count by severity
    summary.bySeverity[alert.severity]++;
    
    // Count by service
    const service = alert.labels.service || alert.labels.instance?.split('.')[0] || 'unknown';
    summary.byService[service] = (summary.byService[service] || 0) + 1;
  });
  
  // Recent resolutions (last 24 hours)
  const now = new Date();
  summary.recentResolutions = alerts
    .filter(alert => alert.status === 'resolved' && alert.endTime && 
            (now.getTime() - alert.endTime.getTime()) < 86400000)
    .sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0))
    .slice(0, 5);
  
  // Longest firing alerts
  summary.longestFiring = alerts
    .filter(alert => alert.status === 'firing')
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .slice(0, 5);
  
  return summary;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // firing, pending, resolved
    const severity = searchParams.get('severity');
    const service = searchParams.get('service');
    const silenced = searchParams.get('silenced');
    const acknowledged = searchParams.get('acknowledged');
    const ruleId = searchParams.get('ruleId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let alerts = generateMockAlertInstances();

    // Apply filters
    if (status) {
      alerts = alerts.filter(alert => alert.status === status);
    }

    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    if (service) {
      alerts = alerts.filter(alert => 
        alert.labels.service === service || 
        alert.labels.instance?.includes(service)
      );
    }

    if (silenced !== null) {
      const isSilenced = silenced === 'true';
      alerts = alerts.filter(alert => alert.silenced === isSilenced);
    }

    if (acknowledged !== null) {
      const isAcknowledged = acknowledged === 'true';
      alerts = alerts.filter(alert => !!alert.acknowledgedBy === isAcknowledged);
    }

    if (ruleId) {
      alerts = alerts.filter(alert => alert.ruleId === ruleId);
    }

    // Sort by severity, then by start time (most recent first)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return b.startTime.getTime() - a.startTime.getTime();
    });

    // Calculate summary
    const summary = calculateAlertSummary(alerts);

    // Apply pagination
    const paginatedAlerts = alerts.slice(offset, offset + limit);

    return NextResponse.json({
      alerts: paginatedAlerts,
      summary,
      pagination: {
        total: alerts.length,
        limit,
        offset,
        hasMore: offset + limit < alerts.length
      },
      filters: {
        status,
        severity,
        service,
        silenced,
        acknowledged,
        ruleId
      }
    });

  } catch (error) {
    console.error('Error fetching alert instances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert instances' },
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
    const { action, alertIds, parameters = {} } = body;

    if (!action || !alertIds || !Array.isArray(alertIds)) {
      return NextResponse.json(
        { error: 'Missing required fields: action, alertIds (array)' },
        { status: 400 }
      );
    }

    const validActions = ['acknowledge', 'resolve', 'silence', 'unsilence'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    let result: any = {
      action,
      alertIds,
      success: true,
      processedCount: alertIds.length,
      timestamp: new Date().toISOString()
    };

    switch (action) {
      case 'acknowledge':
        result.message = `${alertIds.length} alert(s) acknowledged`;
        result.acknowledgedBy = session.user?.email || 'unknown';
        break;
        
      case 'resolve':
        result.message = `${alertIds.length} alert(s) manually resolved`;
        result.resolvedBy = session.user?.email || 'unknown';
        break;
        
      case 'silence':
        const { duration = '1h', reason } = parameters;
        result.message = `${alertIds.length} alert(s) silenced for ${duration}`;
        result.silencedBy = session.user?.email || 'unknown';
        result.silenceDuration = duration;
        result.reason = reason;
        break;
        
      case 'unsilence':
        result.message = `${alertIds.length} alert(s) unsilenced`;
        result.unsilencedBy = session.user?.email || 'unknown';
        break;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error performing alert action:', error);
    return NextResponse.json(
      { error: 'Failed to perform alert action' },
      { status: 500 }
    );
  }
}
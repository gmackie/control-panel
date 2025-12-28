import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface MonitoringAlert {
  id: string;
  name: string;
  status: 'firing' | 'pending' | 'resolved';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  source: string;
  message: string;
  description: string;
  value: number | string;
  threshold: number | string;
  startTime: Date;
  endTime?: Date;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  generatorURL?: string;
  silenced: boolean;
  silencedUntil?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  fingerprint: string;
}

interface AlertEvaluation {
  id: string;
  ruleId: string;
  timestamp: Date;
  value: number | string;
  threshold: number | string;
  status: 'ok' | 'firing' | 'pending';
  message: string;
  labels: Record<string, string>;
}

// Generate mock monitoring alerts
function generateMockAlerts(): MonitoringAlert[] {
  const now = new Date();
  
  const alerts: MonitoringAlert[] = [
    {
      id: 'alert-mon-001',
      name: 'High CPU Usage - K3s Worker 01',
      status: 'firing',
      severity: 'high',
      source: 'prometheus',
      message: 'CPU usage is 89.2% (threshold: 80%)',
      description: 'CPU usage has been consistently high on k3s-worker-01 for the past 15 minutes',
      value: 89.2,
      threshold: 80,
      startTime: new Date(now.getTime() - 900000), // 15 minutes ago
      labels: {
        alertname: 'HighCPUUsage',
        instance: 'k3s-worker-01:9100',
        job: 'node-exporter',
        severity: 'high',
        team: 'infrastructure'
      },
      annotations: {
        summary: 'High CPU usage detected',
        description: 'CPU usage is {{ $value }}% which is above the threshold of {{ $threshold }}%',
        runbook_url: 'https://wiki.gmac.io/runbooks/high-cpu-usage',
        dashboard_url: 'https://grafana.gmac.io/d/node-exporter/node-exporter?var-instance=k3s-worker-01:9100'
      },
      generatorURL: 'https://prometheus.gmac.io/graph?g0.expr=cpu_usage_percent&g0.tab=1',
      silenced: false,
      fingerprint: 'cpu-high-k3s-worker-01'
    },
    {
      id: 'alert-mon-002',
      name: 'Database Connection Pool Warning',
      status: 'firing',
      severity: 'critical',
      source: 'prometheus',
      message: 'Database connection pool at 92% capacity (threshold: 90%)',
      description: 'PostgreSQL connection pool is nearly exhausted',
      value: 92,
      threshold: 90,
      startTime: new Date(now.getTime() - 300000), // 5 minutes ago
      labels: {
        alertname: 'DatabaseConnectionPoolHigh',
        instance: 'db.gmac.io:5432',
        database: 'control_panel',
        severity: 'critical',
        team: 'database'
      },
      annotations: {
        summary: 'Database connection pool nearly exhausted',
        description: 'Connection pool usage is {{ $value }}% of maximum capacity',
        impact: 'New database connections may be refused',
        runbook_url: 'https://wiki.gmac.io/runbooks/database-connections'
      },
      generatorURL: 'https://prometheus.gmac.io/graph?g0.expr=db_connections_active',
      silenced: false,
      acknowledgedBy: 'dba@gmac.io',
      acknowledgedAt: new Date(now.getTime() - 180000),
      fingerprint: 'db-connections-high'
    },
    {
      id: 'alert-mon-003',
      name: 'ArgoCD Application Sync Failed',
      status: 'resolved',
      severity: 'medium',
      source: 'argocd-webhook',
      message: 'Application sync failed for control-panel',
      description: 'ArgoCD failed to sync control-panel application',
      value: 'Failed',
      threshold: 'Success',
      startTime: new Date(now.getTime() - 3600000), // 1 hour ago
      endTime: new Date(now.getTime() - 1800000), // 30 minutes ago
      labels: {
        alertname: 'ArgoCDSyncFailed',
        application: 'control-panel',
        namespace: 'default',
        severity: 'medium',
        team: 'devops'
      },
      annotations: {
        summary: 'ArgoCD application sync failed',
        description: 'Sync operation for {{ .Labels.application }} failed with status {{ $value }}',
        resolution: 'Manual sync performed after resolving resource conflicts'
      },
      silenced: false,
      acknowledgedBy: 'devops@gmac.io',
      acknowledgedAt: new Date(now.getTime() - 3300000),
      resolvedBy: 'devops@gmac.io',
      resolvedAt: new Date(now.getTime() - 1800000),
      fingerprint: 'argocd-sync-failed-control-panel'
    },
    {
      id: 'alert-mon-004',
      name: 'Disk Space Warning',
      status: 'pending',
      severity: 'medium',
      source: 'prometheus',
      message: 'Disk usage approaching threshold: 84% (threshold: 85%)',
      description: 'Disk space on /var/lib/docker is approaching capacity',
      value: 84,
      threshold: 85,
      startTime: new Date(now.getTime() - 120000), // 2 minutes ago
      labels: {
        alertname: 'DiskSpaceWarning',
        instance: 'k3s-master-01:9100',
        mountpoint: '/var/lib/docker',
        severity: 'medium',
        team: 'infrastructure'
      },
      annotations: {
        summary: 'Disk space approaching threshold',
        description: 'Disk usage on {{ .Labels.mountpoint }} is {{ $value }}%'
      },
      generatorURL: 'https://prometheus.gmac.io/graph?g0.expr=disk_usage_percent',
      silenced: false,
      fingerprint: 'disk-space-warning-master'
    },
    {
      id: 'alert-mon-005',
      name: 'SSL Certificate Expiry',
      status: 'firing',
      severity: 'info',
      source: 'cert-manager',
      message: 'SSL certificate expires in 25 days',
      description: 'Wildcard certificate for *.gmac.io expires soon',
      value: 25,
      threshold: 30,
      startTime: new Date(now.getTime() - 86400000), // 1 day ago
      labels: {
        alertname: 'SSLCertificateExpiry',
        domain: '*.gmac.io',
        issuer: 'letsencrypt-prod',
        severity: 'info',
        team: 'security'
      },
      annotations: {
        summary: 'SSL certificate approaching expiry',
        description: 'Certificate for {{ .Labels.domain }} expires in {{ $value }} days'
      },
      silenced: true,
      silencedUntil: new Date(now.getTime() + 86400000 * 7), // 7 days from now
      fingerprint: 'ssl-cert-expiry-gmac-io'
    }
  ];
  
  return alerts;
}

// Generate mock alert evaluations
function generateMockEvaluations(): AlertEvaluation[] {
  const now = new Date();
  const evaluations: AlertEvaluation[] = [];
  
  // Generate evaluations for the last hour
  for (let i = 0; i < 60; i += 5) {
    const timestamp = new Date(now.getTime() - i * 60 * 1000);
    
    evaluations.push({
      id: `eval-${timestamp.getTime()}`,
      ruleId: 'rule-001',
      timestamp,
      value: 70 + Math.random() * 30, // 70-100%
      threshold: 80,
      status: Math.random() > 0.7 ? 'firing' : 'ok',
      message: 'CPU usage evaluation',
      labels: {
        instance: 'k3s-worker-01:9100',
        job: 'node-exporter'
      }
    });
  }
  
  return evaluations.reverse(); // Most recent first
}

// Calculate alert statistics
function calculateAlertStats(alerts: MonitoringAlert[]) {
  const stats = {
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
    bySource: {} as Record<string, number>,
    byTeam: {} as Record<string, number>,
    avgResolutionTime: 0,
    mttr: 0 // Mean Time To Resolution
  };
  
  let totalResolutionTime = 0;
  let resolvedCount = 0;
  
  alerts.forEach(alert => {
    // Status counts
    stats[alert.status]++;
    
    // Severity counts
    stats.bySeverity[alert.severity]++;
    
    // Source counts
    stats.bySource[alert.source] = (stats.bySource[alert.source] || 0) + 1;
    
    // Team counts
    const team = alert.labels.team || 'unknown';
    stats.byTeam[team] = (stats.byTeam[team] || 0) + 1;
    
    // Silenced count
    if (alert.silenced) stats.silenced++;
    
    // Acknowledged count
    if (alert.acknowledgedBy) stats.acknowledged++;
    
    // Resolution time calculation
    if (alert.status === 'resolved' && alert.endTime) {
      const resolutionTime = alert.endTime.getTime() - alert.startTime.getTime();
      totalResolutionTime += resolutionTime;
      resolvedCount++;
    }
  });
  
  if (resolvedCount > 0) {
    stats.avgResolutionTime = totalResolutionTime / resolvedCount;
    stats.mttr = stats.avgResolutionTime / (1000 * 60); // Convert to minutes
  }
  
  return stats;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || 'alerts';
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const source = searchParams.get('source');
    const team = searchParams.get('team');
    const silenced = searchParams.get('silenced');
    const acknowledged = searchParams.get('acknowledged');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    switch (endpoint) {
      case 'alerts':
        let alerts = generateMockAlerts();
        
        // Apply filters
        if (status) {
          alerts = alerts.filter(alert => alert.status === status);
        }
        if (severity) {
          alerts = alerts.filter(alert => alert.severity === severity);
        }
        if (source) {
          alerts = alerts.filter(alert => alert.source === source);
        }
        if (team) {
          alerts = alerts.filter(alert => alert.labels.team === team);
        }
        if (silenced !== null) {
          const isSilenced = silenced === 'true';
          alerts = alerts.filter(alert => alert.silenced === isSilenced);
        }
        if (acknowledged !== null) {
          const isAcknowledged = acknowledged === 'true';
          alerts = alerts.filter(alert => !!alert.acknowledgedBy === isAcknowledged);
        }
        
        // Sort by severity and start time
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        alerts.sort((a, b) => {
          const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
          if (severityDiff !== 0) return severityDiff;
          return b.startTime.getTime() - a.startTime.getTime();
        });
        
        // Apply pagination
        const paginatedAlerts = alerts.slice(offset, offset + limit);
        const stats = calculateAlertStats(alerts);
        
        return NextResponse.json({
          alerts: paginatedAlerts,
          stats,
          pagination: {
            total: alerts.length,
            limit,
            offset,
            hasMore: offset + limit < alerts.length
          },
          filters: { status, severity, source, team, silenced, acknowledged }
        });

      case 'evaluations':
        const ruleId = searchParams.get('ruleId');
        const timeRange = searchParams.get('timeRange') || '1h';
        
        let evaluations = generateMockEvaluations();
        
        if (ruleId) {
          evaluations = evaluations.filter(evaluation => evaluation.ruleId === ruleId);
        }
        
        // Filter by time range
        const timeRangeMs = timeRange === '1h' ? 3600000 : 
                           timeRange === '6h' ? 21600000 : 
                           timeRange === '24h' ? 86400000 : 3600000;
        const cutoffTime = new Date(Date.now() - timeRangeMs);
        evaluations = evaluations.filter(evaluation => evaluation.timestamp >= cutoffTime);
        
        return NextResponse.json({
          evaluations,
          summary: {
            total: evaluations.length,
            firing: evaluations.filter(e => e.status === 'firing').length,
            ok: evaluations.filter(e => e.status === 'ok').length,
            pending: evaluations.filter(e => e.status === 'pending').length
          },
          timeRange
        });

      case 'summary':
        const allAlerts = generateMockAlerts();
        const summary = calculateAlertStats(allAlerts);
        
        return NextResponse.json({
          summary,
          healthScore: Math.max(0, 100 - (summary.firing * 10 + summary.pending * 5)),
          trends: {
            lastHour: {
              new: Math.floor(Math.random() * 3),
              resolved: Math.floor(Math.random() * 5) + 2,
              escalated: Math.floor(Math.random() * 2)
            },
            last24Hours: {
              new: Math.floor(Math.random() * 15) + 5,
              resolved: Math.floor(Math.random() * 20) + 10,
              escalated: Math.floor(Math.random() * 5)
            }
          }
        });

      default:
        return NextResponse.json(
          { error: `Unknown endpoint: ${endpoint}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error fetching monitoring alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring alerts' },
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

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    const validActions = ['acknowledge', 'resolve', 'silence', 'unsilence', 'escalate', 'bulk_action'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    let result: any = {
      action,
      success: true,
      timestamp: new Date().toISOString(),
      performedBy: session.user?.email || 'unknown'
    };

    switch (action) {
      case 'acknowledge':
        if (!alertIds || !Array.isArray(alertIds)) {
          return NextResponse.json({ error: 'alertIds array required' }, { status: 400 });
        }
        result.alertIds = alertIds;
        result.message = `${alertIds.length} alert(s) acknowledged`;
        result.acknowledgedBy = session.user?.email || 'unknown';
        result.acknowledgedAt = new Date().toISOString();
        break;

      case 'resolve':
        if (!alertIds || !Array.isArray(alertIds)) {
          return NextResponse.json({ error: 'alertIds array required' }, { status: 400 });
        }
        const { resolution } = parameters;
        result.alertIds = alertIds;
        result.message = `${alertIds.length} alert(s) resolved`;
        result.resolvedBy = session.user?.email || 'unknown';
        result.resolvedAt = new Date().toISOString();
        result.resolution = resolution || 'Manual resolution';
        break;

      case 'silence':
        if (!alertIds || !Array.isArray(alertIds)) {
          return NextResponse.json({ error: 'alertIds array required' }, { status: 400 });
        }
        const { duration = '1h', reason } = parameters;
        result.alertIds = alertIds;
        result.message = `${alertIds.length} alert(s) silenced for ${duration}`;
        result.silencedBy = session.user?.email || 'unknown';
        result.silencedUntil = new Date(Date.now() + parseDuration(duration)).toISOString();
        result.reason = reason;
        break;

      case 'unsilence':
        if (!alertIds || !Array.isArray(alertIds)) {
          return NextResponse.json({ error: 'alertIds array required' }, { status: 400 });
        }
        result.alertIds = alertIds;
        result.message = `${alertIds.length} alert(s) unsilenced`;
        result.unsilencedBy = session.user?.email || 'unknown';
        break;

      case 'escalate':
        if (!alertIds || !Array.isArray(alertIds)) {
          return NextResponse.json({ error: 'alertIds array required' }, { status: 400 });
        }
        const { escalationTarget, escalationReason } = parameters;
        if (!escalationTarget) {
          return NextResponse.json({ error: 'escalationTarget required' }, { status: 400 });
        }
        result.alertIds = alertIds;
        result.message = `${alertIds.length} alert(s) escalated to ${escalationTarget}`;
        result.escalatedBy = session.user?.email || 'unknown';
        result.escalationTarget = escalationTarget;
        result.escalationReason = escalationReason;
        break;

      case 'bulk_action':
        const { bulkAction, filters } = parameters;
        if (!bulkAction) {
          return NextResponse.json({ error: 'bulkAction required' }, { status: 400 });
        }
        result.bulkAction = bulkAction;
        result.filters = filters;
        result.message = `Bulk ${bulkAction} operation initiated`;
        result.jobId = `bulk-${Date.now()}`;
        break;
    }

    // In a real implementation, this would:
    // 1. Update alert states in the database
    // 2. Send notifications to alert channels
    // 3. Update monitoring system (AlertManager, etc.)
    // 4. Log actions for audit trail
    // 5. Trigger escalation workflows if needed

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error executing alert action:', error);
    return NextResponse.json(
      { error: 'Failed to execute alert action' },
      { status: 500 }
    );
  }
}

// Helper function to parse duration strings
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 3600000; // Default to 1 hour
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 3600000;
  }
}

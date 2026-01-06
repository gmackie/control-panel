import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { K3sService } from '@/lib/k3s/k3s-service';

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
  duration?: number;
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

function mapEventSeverity(eventType: string, reason: string): AlertInstance['severity'] {
  if (eventType === 'Warning') {
    if (reason.includes('Failed') || reason.includes('Error') || reason.includes('Kill')) {
      return 'high';
    }
    if (reason.includes('Unhealthy') || reason.includes('BackOff')) {
      return 'medium';
    }
    return 'low';
  }
  return 'info';
}

function mapEventToAlert(event: {
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  count: number;
  firstTime: string;
  lastTime: string;
  involvedObject?: {
    kind: string;
    name: string;
    namespace: string;
  };
}, namespace: string): AlertInstance | null {
  if (event.type === 'Normal') {
    return null;
  }
  
  const severity = mapEventSeverity(event.type, event.reason);
  const fingerprint = `${namespace}-${event.reason}-${event.involvedObject?.name || 'unknown'}`;
  
  const startTime = new Date(event.firstTime);
  const lastTime = new Date(event.lastTime);
  const now = new Date();
  const ageHours = (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60);
  
  const isResolved = ageHours > 1;
  
  return {
    id: `k8s-${fingerprint}-${startTime.getTime()}`,
    ruleId: `k8s-event-${event.reason.toLowerCase()}`,
    ruleName: event.reason,
    status: isResolved ? 'resolved' : 'firing',
    severity,
    message: event.message,
    value: event.count,
    threshold: 1,
    startTime,
    endTime: isResolved ? lastTime : undefined,
    duration: isResolved ? lastTime.getTime() - startTime.getTime() : undefined,
    labels: {
      source: 'kubernetes',
      namespace,
      kind: event.involvedObject?.kind || 'Unknown',
      name: event.involvedObject?.name || 'unknown',
      eventType: event.type,
      team: 'infrastructure',
    },
    annotations: {
      summary: `${event.reason}: ${event.involvedObject?.kind || 'Resource'} ${event.involvedObject?.name || 'unknown'}`,
      description: event.message,
      occurrences: `${event.count} occurrence(s)`,
    },
    silenced: false,
    fingerprint,
  };
}

async function getK8sAlerts(): Promise<AlertInstance[]> {
  const k3s = new K3sService();
  const alerts: AlertInstance[] = [];
  
  try {
    const namespaces = await k3s.getNamespaces();
    const relevantNamespaces = namespaces.filter(ns => 
      !ns.startsWith('kube-') && ns !== 'local-path-storage'
    );
    
    for (const namespace of relevantNamespaces) {
      try {
        const pods = await k3s.getPods(namespace);
        
        for (const pod of pods) {
          if (pod.status === 'Running' && pod.restarts === 0) {
            continue;
          }
          
          if (pod.status !== 'Running' || pod.restarts > 0) {
            const severity: AlertInstance['severity'] = 
              pod.status === 'Failed' || pod.status === 'CrashLoopBackOff' ? 'critical' :
              pod.status === 'Pending' ? 'medium' :
              pod.restarts > 5 ? 'high' :
              pod.restarts > 0 ? 'low' : 'info';
            
            const fingerprint = `pod-${namespace}-${pod.name}`;
            
            alerts.push({
              id: `pod-${fingerprint}`,
              ruleId: 'pod-health',
              ruleName: pod.status === 'Running' ? 'Pod Restarts' : 'Pod Status',
              status: pod.status === 'Running' ? 'resolved' : 'firing',
              severity,
              message: pod.status === 'Running' 
                ? `Pod ${pod.name} has restarted ${pod.restarts} times`
                : `Pod ${pod.name} is in ${pod.status} state`,
              value: pod.restarts,
              threshold: 0,
              startTime: new Date(),
              labels: {
                source: 'kubernetes',
                namespace,
                pod: pod.name,
                node: pod.node,
                team: 'infrastructure',
              },
              annotations: {
                summary: `Pod ${pod.name} health issue`,
                description: `Status: ${pod.status}, Ready: ${pod.ready}, Restarts: ${pod.restarts}`,
              },
              silenced: false,
              fingerprint,
            });
          }
        }
      } catch (err) {
        console.error(`Error fetching pods for namespace ${namespace}:`, err);
      }
    }
    
    const nodes = await k3s.getNodes();
    for (const node of nodes) {
      if (node.status !== 'Ready') {
        const fingerprint = `node-${node.name}`;
        alerts.push({
          id: `node-${fingerprint}`,
          ruleId: 'node-health',
          ruleName: 'Node Not Ready',
          status: 'firing',
          severity: 'critical',
          message: `Node ${node.name} is not ready`,
          value: node.status,
          threshold: 'Ready',
          startTime: new Date(),
          labels: {
            source: 'kubernetes',
            node: node.name,
            roles: node.roles.join(','),
            team: 'infrastructure',
          },
          annotations: {
            summary: `Node ${node.name} is not ready`,
            description: node.conditions.find(c => c.type === 'Ready')?.message || 'Node health check failed',
          },
          silenced: false,
          fingerprint,
        });
      }
      
      const problematicConditions = node.conditions.filter(c => 
        c.type !== 'Ready' && c.status === 'True'
      );
      
      for (const condition of problematicConditions) {
        const fingerprint = `node-condition-${node.name}-${condition.type}`;
        alerts.push({
          id: `condition-${fingerprint}`,
          ruleId: `node-${condition.type.toLowerCase()}`,
          ruleName: condition.type,
          status: 'firing',
          severity: 'high',
          message: condition.message || `Node ${node.name} has ${condition.type} condition`,
          value: condition.status,
          threshold: 'False',
          startTime: new Date(),
          labels: {
            source: 'kubernetes',
            node: node.name,
            conditionType: condition.type,
            team: 'infrastructure',
          },
          annotations: {
            summary: `Node ${node.name} ${condition.type}`,
            description: condition.message || `Condition ${condition.type} is ${condition.status}`,
            reason: condition.reason || 'Unknown',
          },
          silenced: false,
          fingerprint,
        });
      }
    }
    
  } catch (error) {
    console.error('Error fetching K8s alerts:', error);
  }
  
  return alerts;
}

async function checkServiceHealth(): Promise<AlertInstance[]> {
  const alerts: AlertInstance[] = [];
  
  const services = [
    { name: 'Gitea', url: 'https://git.gmac.io' },
    { name: 'Harbor', url: 'https://registry.gmac.io' },
    { name: 'Control Panel', url: 'https://control.gmac.io' },
    { name: 'Tasks', url: 'https://tasks.gmac.io' },
  ];
  
  for (const service of services) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(service.url, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.status >= 400) {
        const fingerprint = `service-${service.name.toLowerCase()}`;
        alerts.push({
          id: `service-${fingerprint}`,
          ruleId: 'service-health',
          ruleName: 'Service Unhealthy',
          status: 'firing',
          severity: response.status >= 500 ? 'critical' : 'high',
          message: `${service.name} returned HTTP ${response.status}`,
          value: response.status,
          threshold: 200,
          startTime: new Date(),
          labels: {
            source: 'http-check',
            service: service.name,
            url: service.url,
            team: 'platform',
          },
          annotations: {
            summary: `${service.name} health check failed`,
            description: `HTTP status ${response.status} from ${service.url}`,
          },
          silenced: false,
          fingerprint,
        });
      }
    } catch (error: any) {
      const fingerprint = `service-${service.name.toLowerCase()}`;
      alerts.push({
        id: `service-${fingerprint}`,
        ruleId: 'service-availability',
        ruleName: 'Service Unavailable',
        status: 'firing',
        severity: 'critical',
        message: `${service.name} is unreachable: ${error.message}`,
        value: 'unreachable',
        threshold: 'reachable',
        startTime: new Date(),
        labels: {
          source: 'http-check',
          service: service.name,
          url: service.url,
          team: 'platform',
        },
        annotations: {
          summary: `${service.name} is unreachable`,
          description: error.name === 'AbortError' ? 'Connection timed out' : error.message,
        },
        silenced: false,
        fingerprint,
      });
    }
  }
  
  return alerts;
}

function calculateAlertSummary(alerts: AlertInstance[]): AlertSummary {
  const summary: AlertSummary = {
    total: alerts.length,
    firing: 0,
    pending: 0,
    resolved: 0,
    silenced: 0,
    acknowledged: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    byService: {},
    recentResolutions: [],
    longestFiring: []
  };
  
  alerts.forEach(alert => {
    summary[alert.status]++;
    if (alert.silenced) summary.silenced++;
    if (alert.acknowledgedBy) summary.acknowledged++;
    summary.bySeverity[alert.severity]++;
    
    const service = alert.labels.service || alert.labels.namespace || 'unknown';
    summary.byService[service] = (summary.byService[service] || 0) + 1;
  });
  
  const now = new Date();
  summary.recentResolutions = alerts
    .filter(alert => alert.status === 'resolved' && alert.endTime && 
            (now.getTime() - alert.endTime.getTime()) < 86400000)
    .sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0))
    .slice(0, 5);
  
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
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const service = searchParams.get('service');
    const silenced = searchParams.get('silenced');
    const acknowledged = searchParams.get('acknowledged');
    const ruleId = searchParams.get('ruleId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [k8sAlerts, serviceAlerts] = await Promise.all([
      getK8sAlerts(),
      checkServiceHealth(),
    ]);
    
    let alerts = [...k8sAlerts, ...serviceAlerts];

    if (status) {
      alerts = alerts.filter(alert => alert.status === status);
    }
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    if (service) {
      alerts = alerts.filter(alert => 
        alert.labels.service === service || 
        alert.labels.namespace === service ||
        alert.labels.name?.includes(service)
      );
    }
    if (silenced !== null && silenced !== undefined) {
      const isSilenced = silenced === 'true';
      alerts = alerts.filter(alert => alert.silenced === isSilenced);
    }
    if (acknowledged !== null && acknowledged !== undefined) {
      const isAcknowledged = acknowledged === 'true';
      alerts = alerts.filter(alert => !!alert.acknowledgedBy === isAcknowledged);
    }
    if (ruleId) {
      alerts = alerts.filter(alert => alert.ruleId === ruleId);
    }

    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.startTime.getTime() - a.startTime.getTime();
    });

    const summary = calculateAlertSummary(alerts);
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
      filters: { status, severity, service, silenced, acknowledged, ruleId }
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

    let result: Record<string, unknown> = {
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

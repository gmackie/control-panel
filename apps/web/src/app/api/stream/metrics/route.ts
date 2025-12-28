import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface MetricUpdate {
  timestamp: string;
  metric: {
    id: string;
    name: string;
    value: number;
    unit: string;
    status: 'healthy' | 'warning' | 'critical';
    change: number;
    source: string;
  };
}

interface AlertUpdate {
  timestamp: string;
  alert: {
    id: string;
    name: string;
    status: 'firing' | 'resolved' | 'acknowledged';
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    message: string;
    source: string;
    labels: Record<string, string>;
  };
}

interface SystemUpdate {
  timestamp: string;
  type: 'metric' | 'alert' | 'health' | 'deployment';
  data: MetricUpdate | AlertUpdate | any;
}

// Generate mock real-time updates
function generateMetricUpdate(): MetricUpdate {
  const metrics = [
    { id: 'cpu', name: 'CPU Usage', unit: '%', source: 'k3s-cluster' },
    { id: 'memory', name: 'Memory Usage', unit: '%', source: 'k3s-cluster' },
    { id: 'disk', name: 'Disk Usage', unit: '%', source: 'k3s-cluster' },
    { id: 'response-time', name: 'Response Time', unit: 'ms', source: 'api-gateway' },
    { id: 'error-rate', name: 'Error Rate', unit: '%', source: 'api-gateway' },
    { id: 'active-users', name: 'Active Users', unit: '', source: 'application' }
  ];
  
  const metric = metrics[Math.floor(Math.random() * metrics.length)];
  const baseValue = metric.id === 'cpu' ? 70 :
                   metric.id === 'memory' ? 60 :
                   metric.id === 'disk' ? 45 :
                   metric.id === 'response-time' ? 150 :
                   metric.id === 'error-rate' ? 1.2 :
                   850; // active users
  
  const value = baseValue + (Math.random() - 0.5) * 20;
  const change = (Math.random() - 0.5) * 10;
  
  let status: 'healthy' | 'warning' | 'critical';
  if (metric.id === 'cpu' || metric.id === 'memory') {
    status = value > 90 ? 'critical' : value > 80 ? 'warning' : 'healthy';
  } else if (metric.id === 'response-time') {
    status = value > 500 ? 'critical' : value > 300 ? 'warning' : 'healthy';
  } else if (metric.id === 'error-rate') {
    status = value > 5 ? 'critical' : value > 2 ? 'warning' : 'healthy';
  } else {
    status = 'healthy';
  }
  
  return {
    timestamp: new Date().toISOString(),
    metric: {
      ...metric,
      value: Math.round(value * 100) / 100,
      status,
      change: Math.round(change * 100) / 100
    }
  };
}

function generateAlertUpdate(): AlertUpdate {
  const alerts: Array<{
    id: string;
    name: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    message: string;
    source: string;
    labels: Record<string, string>;
  }> = [
    {
      id: 'alert-cpu-001',
      name: 'High CPU Usage',
      severity: 'high',
      message: 'CPU usage exceeded threshold',
      source: 'prometheus',
      labels: { instance: 'k3s-worker-01', job: 'node-exporter' }
    },
    {
      id: 'alert-mem-001',
      name: 'Memory Pressure',
      severity: 'medium',
      message: 'Memory usage approaching limits',
      source: 'prometheus',
      labels: { instance: 'k3s-worker-02', job: 'node-exporter' }
    },
    {
      id: 'alert-db-001',
      name: 'Database Connection Pool',
      severity: 'critical',
      message: 'Connection pool nearly exhausted',
      source: 'postgres-exporter',
      labels: { database: 'control_panel', instance: 'db.gmac.io' }
    }
  ];
  
  const alert = alerts[Math.floor(Math.random() * alerts.length)];
  const statuses: Array<'firing' | 'resolved' | 'acknowledged'> = ['firing', 'resolved', 'acknowledged'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    timestamp: new Date().toISOString(),
    alert: {
      ...alert,
      status
    }
  };
}

function generateHealthUpdate() {
  const services = ['control-panel-api', 'gitea-server', 'drone-ci', 'harbor-registry', 'argocd', 'database'];
  const service = services[Math.floor(Math.random() * services.length)];
  const statuses = ['healthy', 'degraded', 'unhealthy'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    timestamp: new Date().toISOString(),
    service,
    status,
    responseTime: Math.floor(Math.random() * 300) + 50,
    message: `Service ${service} status updated to ${status}`
  };
}

function generateDeploymentUpdate() {
  const applications = ['control-panel', 'monitoring-stack', 'cert-manager', 'ingress-nginx'];
  const app = applications[Math.floor(Math.random() * applications.length)];
  const statuses = ['deploying', 'deployed', 'failed', 'rollback'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    timestamp: new Date().toISOString(),
    application: app,
    status,
    version: `v1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
    message: `Deployment ${status} for ${app}`
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const types = searchParams.get('types')?.split(',') || ['metric', 'alert', 'health'];
  const interval = parseInt(searchParams.get('interval') || '5000'); // Default 5 seconds

  // Create Server-Sent Events stream
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        message: 'Real-time monitoring stream connected',
        supportedTypes: types
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initialMessage));

      // Generate periodic updates
      const updateInterval = setInterval(() => {
        try {
          let update: SystemUpdate;
          const updateType = types[Math.floor(Math.random() * types.length)];

          switch (updateType) {
            case 'metric':
              update = {
                timestamp: new Date().toISOString(),
                type: 'metric',
                data: generateMetricUpdate()
              };
              break;
              
            case 'alert':
              update = {
                timestamp: new Date().toISOString(),
                type: 'alert', 
                data: generateAlertUpdate()
              };
              break;
              
            case 'health':
              update = {
                timestamp: new Date().toISOString(),
                type: 'health',
                data: generateHealthUpdate()
              };
              break;
              
            case 'deployment':
              update = {
                timestamp: new Date().toISOString(),
                type: 'deployment',
                data: generateDeploymentUpdate()
              };
              break;
              
            default:
              update = {
                timestamp: new Date().toISOString(),
                type: 'metric',
                data: generateMetricUpdate()
              };
          }

          const message = `data: ${JSON.stringify(update)}\n\n`;
          controller.enqueue(new TextEncoder().encode(message));
        } catch (error) {
          console.error('Error generating SSE update:', error);
        }
      }, interval);

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(heartbeat));
        } catch (error) {
          console.error('Error sending heartbeat:', error);
        }
      }, 30000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(updateInterval);
        clearInterval(heartbeatInterval);
        controller.close();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    const validActions = ['trigger_update', 'send_alert', 'broadcast_message'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // In a real implementation, this would:
    // 1. Trigger real-time updates to connected clients
    // 2. Broadcast messages through WebSocket connections
    // 3. Send notifications to subscribed channels
    // 4. Update real-time dashboards

    const result = {
      action,
      success: true,
      timestamp: new Date().toISOString(),
      message: `${action} executed successfully`,
      data
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error processing SSE action:', error);
    return NextResponse.json(
      { error: 'Failed to process SSE action' },
      { status: 500 }
    );
  }
}
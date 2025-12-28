import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { alertManager, AlertSchema } from '@/lib/alerting/alert-manager';
import { z } from 'zod';

const CreateAlertSchema = AlertSchema.omit({ id: true, timestamp: true });

// GET /api/alerts - Get all alerts with optional filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;
    const severity = searchParams.get('severity') as any;
    const source = searchParams.get('source');
    const namespace = searchParams.get('namespace');
    const application = searchParams.get('application');
    const limit = parseInt(searchParams.get('limit') || '100');

    const alerts = alertManager.getAlerts({
      status,
      severity,
      source: source || undefined,
      namespace: namespace || undefined,
      application: application || undefined,
    }).slice(0, limit);

    const statistics = alertManager.getAlertStatistics();

    // Add some sample alerts if none exist (for demo purposes)
    if (alerts.length === 0) {
      await alertManager.createAlert({
        title: 'High Memory Usage',
        description: 'Memory usage above 80% on control-panel pods',
        severity: 'medium',
        status: 'active',
        source: 'infrastructure',
        namespace: 'control-panel',
        application: 'control-panel',
        tags: ['memory', 'resource'],
        runbook: 'https://runbooks.gmac.io/high-memory-usage',
        dashboardUrl: 'https://grafana.gmac.io/d/control-panel/control-panel-overview',
        metadata: {},
      });

      await alertManager.createAlert({
        title: 'Application Response Time High',
        description: '95th percentile response time above 1 second',
        severity: 'high',
        status: 'active',
        source: 'application',
        namespace: 'control-panel',
        application: 'control-panel',
        tags: ['performance', 'response-time'],
        runbook: 'https://runbooks.gmac.io/high-response-time',
        dashboardUrl: 'https://grafana.gmac.io/d/control-panel/control-panel-overview',
        metadata: {},
      });
    }

    return NextResponse.json({
      alerts: alertManager.getAlerts().slice(0, limit),
      statistics: alertManager.getAlertStatistics(),
      total: alertManager.getAlerts().length,
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

// POST /api/alerts - Create a new alert
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const alertData = CreateAlertSchema.parse(body);

    const alert = await alertManager.createAlert(alertData);

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid alert data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
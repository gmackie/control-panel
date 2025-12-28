import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { alertManager } from '@/lib/alerting/alert-manager';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/alerts/[id] - Get specific alert
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alert = alertManager.getAlert(params.id);
    
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Error fetching alert:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert' },
      { status: 500 }
    );
  }
}

// PUT /api/alerts/[id] - Update alert
export async function PUT(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const alert = await alertManager.updateAlert(params.id, body);
    
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Error updating alert:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}

// DELETE /api/alerts/[id] - Delete alert
export async function DELETE(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alert = alertManager.getAlert(params.id);
    
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Mark as resolved instead of deleting
    await alertManager.resolveAlert(params.id);

    return NextResponse.json({ message: 'Alert resolved' });
  } catch (error) {
    console.error('Error resolving alert:', error);
    return NextResponse.json(
      { error: 'Failed to resolve alert' },
      { status: 500 }
    );
  }
}
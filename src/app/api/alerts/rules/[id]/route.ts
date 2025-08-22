import { NextRequest, NextResponse } from 'next/server';
import { getAlertRule, updateAlertRule, deleteAlertRule } from '@/lib/monitoring/alert-monitor';

interface Params {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const rule = await getAlertRule(params.id);
    
    if (!rule) {
      return NextResponse.json(
        { error: 'Alert rule not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error fetching alert rule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert rule' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const body = await request.json();
    const updatedRule = await updateAlertRule(params.id, body);
    
    if (!updatedRule) {
      return NextResponse.json(
        { error: 'Alert rule not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error('Error updating alert rule:', error);
    return NextResponse.json(
      { error: 'Failed to update alert rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const deleted = await deleteAlertRule(params.id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Alert rule not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting alert rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert rule' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { evaluateAlerts } from '@/lib/monitoring/alert-monitor';

export async function POST() {
  try {
    // Fetch current services
    const servicesResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/services`);
    if (!servicesResponse.ok) {
      throw new Error('Failed to fetch services');
    }
    
    const services = await servicesResponse.json();
    
    // Evaluate alerts based on current service state
    const alerts = await evaluateAlerts(services);
    
    return NextResponse.json({
      evaluated: true,
      alertsCreated: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Error evaluating alerts:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate alerts' },
      { status: 500 }
    );
  }
}

// Allow GET for manual testing
export async function GET() {
  return POST();
}
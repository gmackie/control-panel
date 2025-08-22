import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';

// Default autoscaling policies
const DEFAULT_POLICIES = [
  {
    name: 'cpu-based',
    displayName: 'CPU-Based Scaling',
    description: 'Scale nodes based on CPU utilization',
    enabled: true,
    minNodes: 2,
    maxNodes: 10,
    targetCPUUtilization: 70,
    scaleUpThreshold: 1.2,
    scaleDownThreshold: 0.5,
    scaleUpCooldown: 300,
    scaleDownCooldown: 600,
  },
  {
    name: 'memory-based',
    displayName: 'Memory-Based Scaling',
    description: 'Scale nodes based on memory utilization',
    enabled: false,
    minNodes: 2,
    maxNodes: 10,
    targetMemoryUtilization: 80,
    scaleUpThreshold: 1.1,
    scaleDownThreshold: 0.6,
    scaleUpCooldown: 300,
    scaleDownCooldown: 600,
  },
  {
    name: 'pod-pressure',
    displayName: 'Pod Pressure Scaling',
    description: 'Scale nodes based on pod count and pending pods',
    enabled: false,
    minNodes: 2,
    maxNodes: 15,
    targetPodCount: 100,
    scaleUpThreshold: 1.0,
    scaleDownThreshold: 0.7,
    scaleUpCooldown: 180,
    scaleDownCooldown: 900,
  },
  {
    name: 'business-hours',
    displayName: 'Business Hours Scaling',
    description: 'Scale up during business hours, scale down after hours',
    enabled: false,
    minNodes: 3,
    maxNodes: 8,
    targetCPUUtilization: 60,
    scaleUpThreshold: 1.0,
    scaleDownThreshold: 0.4,
    scaleUpCooldown: 600,
    scaleDownCooldown: 1800,
    schedule: {
      scaleUp: '0 8 * * 1-5', // 8 AM Mon-Fri
      scaleDown: '0 18 * * 1-5', // 6 PM Mon-Fri
    }
  }
];

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    return NextResponse.json({ policies: DEFAULT_POLICIES });
  } catch (error: any) {
    console.error('Error fetching policies:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch policies' },
      { status: 500 }
    );
  }
}
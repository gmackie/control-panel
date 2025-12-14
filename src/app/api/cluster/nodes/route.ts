import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { K3sService } from '@/lib/k3s/k3s-service';

// Initialize K3s service
const k3sService = new K3sService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nodeName = searchParams.get('name');
    const status = searchParams.get('status');

    // Fetch real nodes from K3s cluster
    const nodes = await k3sService.getNodes();
    
    if (nodes.length === 0) {
      // Return empty state if no nodes found (might be connection issue)
      return NextResponse.json({
        nodes: [],
        summary: {
          totalNodes: 0,
          readyNodes: 0,
          averageCpuUsage: 0,
          averageMemoryUsage: 0,
          totalPods: 0,
        },
        timestamp: new Date().toISOString(),
        warning: 'No nodes found. Check cluster connection.',
      });
    }

    // Transform to expected format
    let filteredNodes = nodes.map(node => {
      // Calculate age
      const createdAt = new Date(node.createdAt);
      const ageMs = Date.now() - createdAt.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      
      // Parse memory capacity for display
      const memMatch = node.capacity.memory.match(/(\d+)(Ki|Mi|Gi)/);
      let memoryGi = '0Gi';
      if (memMatch) {
        const value = parseInt(memMatch[1]);
        const unit = memMatch[2];
        if (unit === 'Gi') memoryGi = `${value}Gi`;
        else if (unit === 'Mi') memoryGi = `${Math.round(value / 1024)}Gi`;
        else if (unit === 'Ki') memoryGi = `${Math.round(value / 1024 / 1024)}Gi`;
      }

      return {
        name: node.name,
        status: node.status as 'Ready' | 'NotReady' | 'Unknown' | 'SchedulingDisabled',
        roles: node.roles,
        age: `${ageDays}d`,
        version: node.version,
        internalIP: node.internalIP,
        externalIP: node.externalIP,
        usage: {
          cpu: 0, // Would need metrics-server for actual usage
          memory: 0,
          pods: 0,
          storage: 0,
        },
        capacity: {
          cpu: node.capacity.cpu,
          memory: memoryGi,
          pods: node.capacity.pods,
        },
        conditions: node.conditions.map(c => ({
          type: c.type,
          status: c.status,
          lastTransitionTime: new Date(),
          reason: c.reason || '',
          message: c.message || '',
        })),
        createdAt: new Date(node.createdAt),
        lastHeartbeat: new Date(),
      };
    });

    // Apply filters
    if (nodeName) {
      filteredNodes = filteredNodes.filter(node => node.name === nodeName);
      if (filteredNodes.length === 0) {
        return NextResponse.json(
          { error: `Node '${nodeName}' not found` },
          { status: 404 }
        );
      }
    }

    if (status) {
      filteredNodes = filteredNodes.filter(node => node.status === status);
    }

    return NextResponse.json({
      nodes: filteredNodes,
      summary: {
        totalNodes: filteredNodes.length,
        readyNodes: filteredNodes.filter(n => n.status === 'Ready').length,
        averageCpuUsage: 0, // Would need metrics-server
        averageMemoryUsage: 0,
        totalPods: 0,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching cluster nodes:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch cluster nodes',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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
    const { action, nodeName } = body;

    if (!action || !nodeName) {
      return NextResponse.json(
        { error: 'Missing required fields: action, nodeName' },
        { status: 400 }
      );
    }

    const validActions = ['cordon', 'uncordon', 'drain'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    let result: { success: boolean; error?: string };

    switch (action) {
      case 'cordon':
        result = await k3sService.cordonNode(nodeName);
        break;
      case 'uncordon':
        result = await k3sService.uncordonNode(nodeName);
        break;
      case 'drain':
        result = await k3sService.drainNode(nodeName);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Operation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      action,
      nodeName,
      success: true,
      message: `Successfully executed ${action} on node '${nodeName}'`,
      timestamp: new Date().toISOString(),
      performedBy: session.user?.email || 'unknown',
    });

  } catch (error) {
    console.error('Error executing node operation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute node operation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface KubernetesNode {
  name: string;
  status: 'Ready' | 'NotReady' | 'Unknown' | 'SchedulingDisabled';
  roles: string[];
  age: string;
  version: string;
  internalIP: string;
  externalIP?: string;
  usage: {
    cpu: number;
    memory: number;
    pods: number;
    storage: number;
  };
  capacity: {
    cpu: string;
    memory: string;
    pods: string;
  };
  conditions: Array<{
    type: string;
    status: string;
    lastTransitionTime: Date;
    reason: string;
    message: string;
  }>;
  createdAt: Date;
  lastHeartbeat: Date;
}

function generateMockNodes(): KubernetesNode[] {
  const now = new Date();
  const nodeNames = ['k3s-master-01', 'k3s-worker-01', 'k3s-worker-02', 'k3s-worker-03'];
  
  return nodeNames.map((name, index) => {
    const isMaster = index === 0;
    const isReady = Math.random() > 0.05;
    
    return {
      name,
      status: isReady ? 'Ready' : 'NotReady',
      roles: isMaster ? ['control-plane', 'master'] : ['worker'],
      age: `${Math.floor(Math.random() * 30) + 5}d`,
      version: 'v1.27.4+k3s1',
      internalIP: `10.0.${index + 1}.100`,
      externalIP: isMaster ? '192.168.1.100' : undefined,
      usage: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        pods: Math.floor(Math.random() * 15) + 5,
        storage: Math.random() * 100
      },
      capacity: {
        cpu: isMaster ? '4' : '8',
        memory: isMaster ? '8Gi' : '16Gi',
        pods: '110'
      },
      conditions: [
        {
          type: 'Ready',
          status: isReady ? 'True' : 'False',
          lastTransitionTime: new Date(now.getTime() - Math.random() * 3600000),
          reason: isReady ? 'KubeletReady' : 'KubeletNotReady',
          message: isReady ? 'kubelet is posting ready status' : 'kubelet has not posted ready status'
        }
      ],
      createdAt: new Date(now.getTime() - (Math.random() * 30 + 5) * 24 * 60 * 60 * 1000),
      lastHeartbeat: new Date(now.getTime() - Math.random() * 60000)
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nodeName = searchParams.get('name');
    const status = searchParams.get('status');

    const nodes = generateMockNodes();
    let filteredNodes = nodes;

    if (nodeName) {
      filteredNodes = nodes.filter(node => node.name === nodeName);
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
        averageCpuUsage: filteredNodes.reduce((sum, n) => sum + n.usage.cpu, 0) / filteredNodes.length,
        averageMemoryUsage: filteredNodes.reduce((sum, n) => sum + n.usage.memory, 0) / filteredNodes.length,
        totalPods: filteredNodes.reduce((sum, n) => sum + n.usage.pods, 0)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching cluster nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cluster nodes' },
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
    const { action, nodeName, parameters = {} } = body;

    if (!action || !nodeName) {
      return NextResponse.json(
        { error: 'Missing required fields: action, nodeName' },
        { status: 400 }
      );
    }

    const validActions = ['cordon', 'uncordon', 'drain', 'reboot'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    let result: any = {
      action,
      nodeName,
      success: true,
      timestamp: new Date().toISOString(),
      performedBy: session.user?.email || 'unknown'
    };

    switch (action) {
      case 'cordon':
        result.message = `Node '${nodeName}' marked as unschedulable`;
        break;
      case 'uncordon':
        result.message = `Node '${nodeName}' marked as schedulable`;
        break;
      case 'drain':
        result.message = `Draining node '${nodeName}'`;
        result.jobId = `drain-${Date.now()}`;
        break;
      case 'reboot':
        result.message = `Reboot initiated for node '${nodeName}'`;
        result.jobId = `reboot-${Date.now()}`;
        break;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error executing node operation:', error);
    return NextResponse.json(
      { error: 'Failed to execute node operation' },
      { status: 500 }
    );
  }
}
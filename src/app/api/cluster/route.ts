import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/check-auth';
import { HetznerClient } from '@/lib/hetzner/client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const hetznerToken = process.env.HETZNER_API_TOKEN;

    if (!hetznerToken) {
      return NextResponse.json(
        { error: 'Missing required configuration' },
        { status: 500 }
      );
    }

    const hetznerClient = new HetznerClient(hetznerToken);
    const servers = await hetznerClient.listServers('k3s-cluster=gmac-io');
    
    // Create cluster info from Hetzner servers
    const clusterInfo = {
      name: 'gmac-io-k3s',
      version: 'v1.28.0',
      endpoint: 'https://5.78.125.172:6443',
      nodes: servers.map(server => ({
        name: server.name,
        status: server.status === 'running' ? 'ready' : 'notready',
        role: server.labels['k3s-role'] || 'worker',
        version: 'v1.28.0',
        internalIP: server.public_net.ipv4.ip,
        externalIP: server.public_net.ipv4.ip,
        os: 'Ubuntu 22.04',
        kernelVersion: 'Unknown',
        containerRuntime: 'containerd',
        cpu: {
          capacity: server.server_type.cores.toString(),
          allocatable: server.server_type.cores.toString(),
          usage: 0,
        },
        memory: {
          capacity: (server.server_type.memory * 1024 * 1024 * 1024).toString(),
          allocatable: (server.server_type.memory * 1024 * 1024 * 1024).toString(),
          usage: 0,
        },
        pods: {
          capacity: '110',
          current: 0,
        },
        conditions: [],
        hetznerServer: server,
      })),
      totalCPU: servers.reduce((sum, s) => sum + s.server_type.cores, 0),
      totalMemory: servers.reduce((sum, s) => sum + s.server_type.memory * 1024 * 1024 * 1024, 0),
      totalPods: servers.length * 110,
      usedCPU: 0,
      usedMemory: 0,
      runningPods: 0,
    };

    // Calculate cluster stats
    const stats = {
      nodes: {
        total: clusterInfo.nodes.length,
        ready: clusterInfo.nodes.filter((n) => n.status === 'ready').length,
        notReady: clusterInfo.nodes.filter((n) => n.status === 'notready').length,
        masters: clusterInfo.nodes.filter((n) => n.role === 'master').length,
        workers: clusterInfo.nodes.filter((n) => n.role === 'worker').length,
      },
      resources: {
        cpu: {
          total: clusterInfo.totalCPU,
          used: clusterInfo.usedCPU,
          percentage: (clusterInfo.usedCPU / clusterInfo.totalCPU) * 100,
        },
        memory: {
          total: clusterInfo.totalMemory,
          used: clusterInfo.usedMemory,
          percentage: (clusterInfo.usedMemory / clusterInfo.totalMemory) * 100,
        },
        pods: {
          total: clusterInfo.totalPods,
          running: clusterInfo.runningPods,
          percentage: (clusterInfo.runningPods / clusterInfo.totalPods) * 100,
        },
      },
      cost: calculateClusterCost(clusterInfo.nodes),
    };

    return NextResponse.json({
      cluster: clusterInfo,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching cluster info:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cluster info' },
      { status: 500 }
    );
  }
}

function calculateClusterCost(nodes: any[]): {
  hourly: number;
  monthly: number;
  currency: string;
} {
  let hourly = 0;
  let monthly = 0;

  nodes.forEach((node) => {
    if (node.hetznerServer?.server_type?.prices?.[0]) {
      const price = node.hetznerServer.server_type.prices[0];
      hourly += parseFloat(price.price_hourly.gross);
      monthly += parseFloat(price.price_monthly.gross);
    }
  });

  return {
    hourly: Math.round(hourly * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
    currency: 'EUR',
  };
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface VPSServer {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  type: 'gitea' | 'cluster-node' | 'standalone';
  provider: 'hetzner';
  location: string;
  specs: {
    cpu: string;
    memory: string;
    disk: string;
  };
  services: Array<{
    name: string;
    status: 'running' | 'stopped' | 'unknown';
    port?: number;
  }>;
  uptime?: string;
  lastChecked: Date;
  responseTime: number;
  monthlyPrice: number;
}

const VPS_SERVERS: Omit<VPSServer, 'status' | 'uptime' | 'lastChecked' | 'responseTime' | 'services'>[] = [
  {
    id: 'vps-gitea',
    name: 'Gitea Server',
    hostname: 'git.gmac.io',
    ip: '5.78.82.75',
    type: 'gitea',
    provider: 'hetzner',
    location: 'Falkenstein, DE',
    specs: {
      cpu: '2 vCPU',
      memory: '4 GB',
      disk: '40 GB SSD',
    },
    monthlyPrice: 5.99,
  },
  {
    id: 'vps-claude',
    name: 'Claude Server',
    hostname: 'claude.gmac.io',
    ip: '49.13.134.119',
    type: 'standalone',
    provider: 'hetzner',
    location: 'Falkenstein, DE',
    specs: {
      cpu: '4 vCPU',
      memory: '8 GB',
      disk: '80 GB SSD',
    },
    monthlyPrice: 11.99,
  },
  {
    id: 'vps-cluster',
    name: 'K3s Cluster Node',
    hostname: 'gmac.io',
    ip: '5.78.106.236',
    type: 'cluster-node',
    provider: 'hetzner',
    location: 'Falkenstein, DE',
    specs: {
      cpu: '4 vCPU',
      memory: '8 GB',
      disk: '80 GB SSD',
    },
    monthlyPrice: 11.99,
  },
];

async function checkVPSHealth(server: typeof VPS_SERVERS[0]): Promise<VPSServer> {
  const startTime = Date.now();
  let status: VPSServer['status'] = 'unknown';
  let responseTime = 0;
  const services: VPSServer['services'] = [];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const url = server.type === 'gitea' 
      ? `https://${server.hostname}/api/v1/version`
      : `https://${server.hostname}`;
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    responseTime = Date.now() - startTime;
    
    if (response.ok) {
      status = 'online';
      
      if (server.type === 'gitea') {
        services.push(
          { name: 'Gitea', status: 'running', port: 443 },
          { name: 'SSH', status: 'running', port: 22 },
        );
      } else if (server.type === 'cluster-node') {
        services.push(
          { name: 'K3s API', status: 'running', port: 6443 },
          { name: 'Ingress', status: 'running', port: 443 },
          { name: 'SSH', status: 'running', port: 22 },
        );
      } else {
        services.push(
          { name: 'HTTP', status: 'running', port: 443 },
          { name: 'SSH', status: 'running', port: 22 },
        );
      }
    } else {
      status = 'degraded';
    }
  } catch (error: any) {
    responseTime = Date.now() - startTime;
    status = error.name === 'AbortError' ? 'degraded' : 'offline';
  }
  
  return {
    ...server,
    status,
    services,
    uptime: status === 'online' ? '99.9%' : undefined,
    lastChecked: new Date(),
    responseTime,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const servers = await Promise.all(
      VPS_SERVERS.map(server => checkVPSHealth(server))
    );

    const totalMonthlyCost = servers.reduce((sum, s) => sum + s.monthlyPrice, 0);
    const onlineCount = servers.filter(s => s.status === 'online').length;

    return NextResponse.json({
      servers,
      summary: {
        total: servers.length,
        online: onlineCount,
        offline: servers.filter(s => s.status === 'offline').length,
        degraded: servers.filter(s => s.status === 'degraded').length,
        totalMonthlyCost,
      },
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching VPS data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch VPS data' },
      { status: 500 }
    );
  }
}

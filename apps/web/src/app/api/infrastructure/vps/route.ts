import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { monitorAllVPS, VPSMonitorResult, VPS_CONFIGS } from '@/lib/vps/ssh-monitor';

interface VPSServerEnriched extends VPSMonitorResult {
  id: string;
  name: string;
  type: 'gitea' | 'cluster-node' | 'standalone';
  provider: 'hetzner';
  location: string;
  specs: {
    cpu: string;
    memory: string;
    disk: string;
  };
  monthlyPrice: number;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  apps?: Array<{
    name: string;
    url: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
  }>;
}

const VPS_METADATA: Record<string, Omit<VPSServerEnriched, keyof VPSMonitorResult | 'status' | 'apps'>> = {
  'git.gmac.io': {
    id: 'vps-gitea',
    name: 'Gitea Server',
    type: 'gitea',
    provider: 'hetzner',
    location: 'Falkenstein, DE',
    specs: { cpu: '2 vCPU', memory: '4 GB', disk: '40 GB SSD' },
    monthlyPrice: 5.99,
  },
  'claude.gmac.io': {
    id: 'vps-claude',
    name: 'Claude Server',
    type: 'standalone',
    provider: 'hetzner',
    location: 'Falkenstein, DE',
    specs: { cpu: '4 vCPU', memory: '8 GB', disk: '80 GB SSD' },
    monthlyPrice: 11.99,
  },
  'gmac.io': {
    id: 'vps-cluster',
    name: 'K3s Cluster Node',
    type: 'cluster-node',
    provider: 'hetzner',
    location: 'Falkenstein, DE',
    specs: { cpu: '4 vCPU', memory: '8 GB', disk: '80 GB SSD' },
    monthlyPrice: 11.99,
  },
};

async function checkAppHealth(url: string, timeoutMs = 5000): Promise<'healthy' | 'unhealthy' | 'unknown'> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { 
      method: 'GET', 
      signal: controller.signal,
      headers: { 'User-Agent': 'ControlPanel/1.0' }
    });
    clearTimeout(timeoutId);
    return response.ok ? 'healthy' : 'unhealthy';
  } catch {
    return 'unknown';
  }
}

function determineServerStatus(result: VPSMonitorResult): 'online' | 'offline' | 'degraded' | 'unknown' {
  if (!result.reachable) return 'offline';
  
  const hasFailedServices = result.services.some(s => s.status === 'failed');
  const hasUnhealthyContainers = result.containers.some(c => c.status === 'unhealthy');
  
  if (hasFailedServices || hasUnhealthyContainers) return 'degraded';
  
  return 'online';
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const monitorResults = await monitorAllVPS();
    
    const servers: VPSServerEnriched[] = await Promise.all(
      monitorResults.map(async (result) => {
        const metadata = VPS_METADATA[result.hostname];
        if (!metadata) {
          return {
            ...result,
            id: `vps-${result.hostname}`,
            name: result.hostname,
            type: 'standalone' as const,
            provider: 'hetzner' as const,
            location: 'Unknown',
            specs: { cpu: 'Unknown', memory: 'Unknown', disk: 'Unknown' },
            monthlyPrice: 0,
            status: determineServerStatus(result),
          };
        }

        let apps: VPSServerEnriched['apps'] = undefined;

        if (result.hostname === 'claude.gmac.io') {
          const [claudeHealth, csbHealth, vaultHealth] = await Promise.all([
            checkAppHealth('https://claude.gmac.io'),
            checkAppHealth('https://csb.gmac.io'),
            checkAppHealth('https://vault.gmac.io'),
          ]);
          
          apps = [
            { name: 'Bob (Claude AI)', url: 'https://claude.gmac.io', status: claudeHealth },
            { name: 'Trader Bot (CSB)', url: 'https://csb.gmac.io', status: csbHealth },
            { name: 'Vault', url: 'https://vault.gmac.io', status: vaultHealth },
          ];
        } else if (result.hostname === 'git.gmac.io') {
          const giteaHealth = await checkAppHealth('https://git.gmac.io/api/v1/version');
          apps = [
            { name: 'Gitea', url: 'https://git.gmac.io', status: giteaHealth },
          ];
        } else if (result.hostname === 'gmac.io') {
          const [controlHealth, tasksHealth, registryHealth] = await Promise.all([
            checkAppHealth('https://control.gmac.io/api/health'),
            checkAppHealth('https://tasks.gmac.io'),
            checkAppHealth('https://registry.gmac.io'),
          ]);
          
          apps = [
            { name: 'Control Panel', url: 'https://control.gmac.io', status: controlHealth },
            { name: 'Tasks App', url: 'https://tasks.gmac.io', status: tasksHealth },
            { name: 'Harbor Registry', url: 'https://registry.gmac.io', status: registryHealth },
          ];
        }

        return {
          ...result,
          ...metadata,
          status: determineServerStatus(result),
          apps,
        };
      })
    );

    const totalMonthlyCost = servers.reduce((sum, s) => sum + s.monthlyPrice, 0);
    const onlineCount = servers.filter(s => s.status === 'online').length;
    const degradedCount = servers.filter(s => s.status === 'degraded').length;
    const offlineCount = servers.filter(s => s.status === 'offline').length;

    const runningServices = servers.reduce((sum, s) => 
      sum + s.services.filter(svc => svc.status === 'running').length, 0);
    const totalServices = servers.reduce((sum, s) => sum + s.services.length, 0);
    
    const runningContainers = servers.reduce((sum, s) => 
      sum + s.containers.filter(c => c.status === 'running').length, 0);
    const unhealthyContainers = servers.reduce((sum, s) => 
      sum + s.containers.filter(c => c.status === 'unhealthy').length, 0);

    return NextResponse.json({
      servers,
      summary: {
        total: servers.length,
        online: onlineCount,
        offline: offlineCount,
        degraded: degradedCount,
        totalMonthlyCost,
        services: {
          running: runningServices,
          total: totalServices,
        },
        containers: {
          running: runningContainers,
          unhealthy: unhealthyContainers,
        },
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

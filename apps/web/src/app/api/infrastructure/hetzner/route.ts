import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { EnhancedHetznerClient } from '@/lib/hetzner/enhanced-client';
import { getAllHetznerCredentials } from '@/lib/integrations/credentials';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allCredentials = await getAllHetznerCredentials();
    if (allCredentials.length === 0) {
      return NextResponse.json(
        { error: 'Hetzner API not configured. Add integration in Settings > Integrations Hub.' },
        { status: 500 }
      );
    }

    const allServers: any[] = [];
    const allVolumes: any[] = [];
    const allLoadBalancers: any[] = [];
    const allFloatingIPs: any[] = [];
    const allNetworks: any[] = [];
    const allSnapshots: any[] = [];
    const projectCosts: Record<string, any> = {};
    const projectHealth: Record<string, any> = {};
    const projects: Array<{ id: string; name: string; serverCount: number }> = [];

    await Promise.all(
      allCredentials.map(async (cred) => {
        try {
          const client = new EnhancedHetznerClient(cred.apiToken);

          const [servers, volumes, loadBalancers, floatingIPs, networks, snapshots, costSummary, healthStatus] =
            await Promise.all([
              client.listServers(),
              client.listVolumes(),
              client.listLoadBalancers(),
              client.listFloatingIPs(),
              client.listNetworks(),
              client.listSnapshots(),
              client.getCostSummary(),
              client.getHealthStatus(),
            ]);

          const projectLabel = cred.name;

          for (const s of servers) {
            allServers.push({
              id: s.id,
              name: s.name,
              status: s.status,
              publicIp: s.public_net?.ipv4?.ip,
              type: s.server_type?.name,
              cores: s.server_type?.cores,
              memory: s.server_type?.memory,
              disk: s.server_type?.disk,
              location: s.datacenter?.location?.name,
              datacenter: s.datacenter?.name,
              labels: s.labels,
              created: s.created,
              monthlyPrice: parseFloat(s.server_type?.prices?.[0]?.price_monthly?.gross || '0'),
              project: projectLabel,
            });
          }

          for (const v of volumes) {
            allVolumes.push({
              id: v.id,
              name: v.name,
              size: v.size,
              status: v.status,
              server: v.server,
              location: v.location?.name,
              labels: v.labels,
              created: v.created,
              project: projectLabel,
            });
          }

          for (const lb of loadBalancers) {
            allLoadBalancers.push({
              id: lb.id,
              name: lb.name,
              publicIp: lb.public_net?.ipv4?.ip,
              type: lb.load_balancer_type?.name,
              location: lb.location?.name,
              targets: lb.targets?.length || 0,
              services: lb.services?.length || 0,
              labels: lb.labels,
              created: lb.created,
              healthyTargets: lb.targets?.filter((t: any) => t.health_status?.every((hs: any) => hs.status === 'healthy')).length || 0,
              project: projectLabel,
            });
          }

          for (const ip of floatingIPs) {
            allFloatingIPs.push({
              id: ip.id,
              name: ip.name,
              ip: ip.ip,
              type: ip.type,
              server: ip.server,
              location: ip.home_location?.name,
              blocked: ip.blocked,
              labels: ip.labels,
              created: ip.created,
              project: projectLabel,
            });
          }

          for (const n of networks) {
            allNetworks.push({
              id: n.id,
              name: n.name,
              ipRange: n.ip_range,
              subnets: n.subnets?.length || 0,
              servers: n.servers?.length || 0,
              labels: n.labels,
              created: n.created,
              project: projectLabel,
            });
          }

          for (const s of snapshots) {
            allSnapshots.push({
              id: s.id,
              description: s.description,
              diskSize: s.disk_size,
              status: s.status,
              createdFrom: s.created_from?.name,
              labels: s.labels,
              created: s.created,
              project: projectLabel,
            });
          }

          projectCosts[projectLabel] = {
            totalMonthly: costSummary.totalMonthlyCost,
            totalHourly: costSummary.totalHourlyCost,
            byResourceType: costSummary.byResourceType,
            currency: costSummary.currency,
          };

          projectHealth[projectLabel] = healthStatus;

          projects.push({
            id: cred.id,
            name: cred.name,
            serverCount: servers.length,
          });
        } catch (error) {
          console.error(`Error fetching from Hetzner project ${cred.name}:`, error);
          projects.push({
            id: cred.id,
            name: cred.name,
            serverCount: 0,
          });
        }
      })
    );

    const totalMonthly = Object.values(projectCosts).reduce((sum: number, p: any) => sum + (p.totalMonthly || 0), 0);
    const totalHourly = Object.values(projectCosts).reduce((sum: number, p: any) => sum + (p.totalHourly || 0), 0);

    const byResourceType: Record<string, number> = {};
    const byLocation: Record<string, number> = {};
    const byProject: Record<string, number> = {};

    for (const [projectName, costs] of Object.entries(projectCosts)) {
      byProject[projectName] = (costs as any).totalMonthly || 0;
      for (const [type, amount] of Object.entries((costs as any).byResourceType || {})) {
        byResourceType[type] = (byResourceType[type] || 0) + (amount as number);
      }
    }

    for (const server of allServers) {
      const loc = server.location || 'unknown';
      byLocation[loc] = (byLocation[loc] || 0) + server.monthlyPrice;
    }

    const overallHealth = {
      healthy: Object.values(projectHealth).every((h: any) => h.healthy),
      issues: Object.entries(projectHealth).flatMap(([project, h]: [string, any]) =>
        (h.issues || []).map((issue: any) => ({ ...issue, project }))
      ),
    };

    return NextResponse.json({
      servers: allServers,
      volumes: allVolumes,
      loadBalancers: allLoadBalancers,
      floatingIPs: allFloatingIPs,
      networks: allNetworks,
      snapshots: allSnapshots,
      projects,
      costs: {
        totalMonthly,
        totalHourly,
        byResourceType,
        byLocation,
        byProject,
        untagged: 0,
        currency: 'EUR',
      },
      health: overallHealth,
      summary: {
        projects: projects.length,
        servers: {
          total: allServers.length,
          running: allServers.filter((s) => s.status === 'running').length,
          stopped: allServers.filter((s) => s.status === 'off').length,
        },
        volumes: {
          total: allVolumes.length,
          totalSizeGB: allVolumes.reduce((sum, v) => sum + v.size, 0),
          attached: allVolumes.filter((v) => v.server !== null).length,
        },
        loadBalancers: {
          total: allLoadBalancers.length,
        },
        floatingIPs: {
          total: allFloatingIPs.length,
          assigned: allFloatingIPs.filter((ip) => ip.server !== null).length,
        },
        networks: {
          total: allNetworks.length,
        },
        snapshots: {
          total: allSnapshots.length,
          totalSizeGB: allSnapshots.reduce((sum, s) => sum + s.diskSize, 0),
        },
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Hetzner resources:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

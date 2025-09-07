import { NextRequest, NextResponse } from 'next/server';
import { applicationMonitor } from '@/lib/monitoring/application-monitor';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get all application monitoring data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get applications from query params or use defaults
    const { searchParams } = new URL(request.url);
    const appsParam = searchParams.get('apps');
    const cluster = searchParams.get('cluster') || 'all';
    const namespace = searchParams.get('namespace') || 'default';
    
    // Default applications to monitor (can be configured via environment or database)
    const defaultApps = [
      'control-panel',
      'landing-page',
      'gmac-chat',
      'ai-dashboard',
      'dev-tools',
      'api-gateway',
      'user-service',
      'notification-service',
    ];

    const appsToMonitor = appsParam ? appsParam.split(',') : defaultApps;
    
    // Get monitoring data for each application
    const monitoringPromises = appsToMonitor.map(async (appName) => {
      try {
        return await applicationMonitor.getApplicationMonitoring(appName.trim(), namespace);
      } catch (error) {
        console.error(`Error monitoring app ${appName}:`, error);
        // Return a basic structure for failed apps
        return {
          id: `${appName}-${namespace}`,
          name: appName.trim(),
          namespace,
          git: {
            url: `https://git.gmac.io/${process.env.GITEA_ORG || 'gmackie'}/${appName}`,
            branch: 'main',
            provider: 'gitea' as const,
          },
          helm: {
            chartName: appName,
            chartVersion: 'unknown',
            repository: 'https://charts.gmac.io',
            releaseName: appName,
            status: 'unknown' as const,
          },
          k8s: {
            cluster: 'unknown' as any,
            namespace,
            deployments: [],
            services: [],
            ingresses: [],
          },
          pods: {
            desired: 0,
            ready: 0,
            running: 0,
            pending: 0,
            failed: 0,
            restarts: 0,
          },
          health: {
            status: 'unknown' as any,
            lastCheck: new Date(),
          },
          observability: {
            grafana: {
              dashboardUrl: `${process.env.GRAFANA_URL || 'https://grafana.gmac.io'}/d/app-overview/application-overview?var-app=${appName}&var-namespace=${namespace}`,
              alertsUrl: `${process.env.GRAFANA_URL || 'https://grafana.gmac.io'}/alerting/list?queryString=${encodeURIComponent(appName)}`,
            },
            loki: {
              logsUrl: `${process.env.GRAFANA_URL || 'https://grafana.gmac.io'}/explore?left=%7B"datasource":"loki","queries":%5B%7B"expr":"${encodeURIComponent(`{namespace="${namespace}",app="${appName}"}`)}"%%7D%5D%7D`,
              query: `{namespace="${namespace}",app="${appName}"}`,
            },
            prometheus: {
              metricsUrl: `${process.env.GRAFANA_URL || 'https://grafana.gmac.io'}/explore?left=%7B"datasource":"prometheus","queries":%5B%7B"expr":"${encodeURIComponent(`up{namespace="${namespace}",app="${appName}"}`)}"%%7D%5D%7D`,
            },
          },
          cicd: {
            provider: 'gitea-actions' as const,
          },
        };
      }
    });

    const applications = await Promise.all(monitoringPromises);
    
    // Filter by cluster if specified
    const filteredApplications = cluster === 'all' 
      ? applications 
      : applications.filter(app => app.k8s.cluster === cluster);

    // Calculate summary stats
    const summary = {
      total: filteredApplications.length,
      healthy: filteredApplications.filter(app => app.health.status === 'healthy').length,
      degraded: filteredApplications.filter(app => app.health.status === 'degraded').length,
      critical: filteredApplications.filter(app => app.health.status === 'critical').length,
      unknown: filteredApplications.filter(app => app.health.status === 'unknown').length,
      totalPods: filteredApplications.reduce((sum, app) => sum + app.pods.desired, 0),
      runningPods: filteredApplications.reduce((sum, app) => sum + app.pods.running, 0),
      totalRestarts: filteredApplications.reduce((sum, app) => sum + app.pods.restarts, 0),
    };

    return NextResponse.json({
      applications: filteredApplications,
      summary,
      lastUpdate: new Date().toISOString(),
      cluster,
      namespace,
    });
  } catch (error) {
    console.error('Error fetching application monitoring data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    );
  }
}

// Update monitoring configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, appName, config } = body;

    switch (action) {
      case 'refresh':
        // Trigger a refresh of monitoring data for specific app
        if (appName) {
          const monitoring = await applicationMonitor.getApplicationMonitoring(
            appName, 
            config?.namespace || 'default'
          );
          return NextResponse.json({ application: monitoring });
        }
        break;
        
      case 'add_application':
        // Add a new application to monitoring
        // This would typically save to database
        return NextResponse.json({ message: 'Application added to monitoring' });
        
      case 'remove_application':
        // Remove application from monitoring
        return NextResponse.json({ message: 'Application removed from monitoring' });
        
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error updating monitoring configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update monitoring configuration' },
      { status: 500 }
    );
  }
}
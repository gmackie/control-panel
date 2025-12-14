import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(req: NextRequest) {
  try {
    // Get all ingresses (good indicator of deployed apps)
    const ingressCommand = `kubectl get ingress -A -o json`;
    const { stdout: ingressOutput } = await execAsync(ingressCommand, {
      env: {
        ...process.env,
        KUBECONFIG: '/Users/mackieg/.kube/config-hetzner'
      }
    });

    const ingresses = JSON.parse(ingressOutput);

    // Get ArgoCD applications
    let argoApps = [];
    try {
      const argoCommand = `argocd app list --output json`;
      const { stdout: argoOutput } = await execAsync(argoCommand, {
        env: {
          ...process.env,
          KUBECONFIG: '/Users/mackieg/.kube/config-hetzner'
        }
      });
      argoApps = JSON.parse(argoOutput) || [];
    } catch (error) {
      console.error('ArgoCD list failed:', error);
    }

    // Get pod counts per namespace
    const namespaceCommand = `kubectl get pods -A -o json`;
    const { stdout: podOutput } = await execAsync(namespaceCommand, {
      env: {
        ...process.env,
        KUBECONFIG: '/Users/mackieg/.kube/config-hetzner'
      }
    });

    const pods = JSON.parse(podOutput);
    const podCounts: Record<string, number> = {};
    const podStatuses: Record<string, string[]> = {};

    pods.items?.forEach((pod: any) => {
      const ns = pod.metadata.namespace;
      if (!podCounts[ns]) podCounts[ns] = 0;
      if (!podStatuses[ns]) podStatuses[ns] = [];
      
      podCounts[ns]++;
      podStatuses[ns].push(pod.status.phase);
    });

    // Build deployment list
    const deployments = ingresses.items
      ?.filter((ing: any) => !['kube-system', 'ingress-nginx', 'cert-manager'].includes(ing.metadata.namespace))
      .map((ing: any) => {
        const namespace = ing.metadata.namespace;
        const argoApp = argoApps.find((app: any) => app.metadata.name === namespace);
        
        return {
          name: ing.metadata.name,
          namespace,
          url: ing.spec.rules?.[0]?.host ? `https://${ing.spec.rules[0].host}` : null,
          domains: ing.spec.rules?.map((r: any) => r.host) || [],
          tls: !!ing.spec.tls,
          podCount: podCounts[namespace] || 0,
          podStatuses: podStatuses[namespace] || [],
          healthy: podStatuses[namespace]?.every(status => status === 'Running'),
          argocd: argoApp ? {
            syncStatus: argoApp.status?.sync?.status,
            healthStatus: argoApp.status?.health?.status,
            repo: argoApp.spec?.source?.repoURL
          } : null,
          createdAt: ing.metadata.creationTimestamp
        };
      }) || [];

    // Sort by creation date (newest first)
    deployments.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      total: deployments.length,
      deployments
    });

  } catch (error) {
    console.error('List deployments error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to list deployments', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
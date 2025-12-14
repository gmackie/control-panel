import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const appName = searchParams.get('app');
    
    if (!appName) {
      return NextResponse.json(
        { error: 'App name is required' },
        { status: 400 }
      );
    }

    // Check pod status
    const podCommand = `kubectl get pods -n ${appName} -o json`;
    const { stdout: podOutput } = await execAsync(podCommand, {
      env: {
        ...process.env,
        KUBECONFIG: '/Users/mackieg/.kube/config-hetzner'
      }
    });

    const pods = JSON.parse(podOutput);
    
    // Check ingress status
    const ingressCommand = `kubectl get ingress -n ${appName} -o json`;
    const { stdout: ingressOutput } = await execAsync(ingressCommand, {
      env: {
        ...process.env,
        KUBECONFIG: '/Users/mackieg/.kube/config-hetzner'
      }
    });

    const ingresses = JSON.parse(ingressOutput);

    // Check ArgoCD app status
    let argoStatus = null;
    try {
      const argoCommand = `argocd app get ${appName} --output json`;
      const { stdout: argoOutput } = await execAsync(argoCommand, {
        env: {
          ...process.env,
          KUBECONFIG: '/Users/mackieg/.kube/config-hetzner'
        }
      });
      argoStatus = JSON.parse(argoOutput);
    } catch (error) {
      // ArgoCD might not be available or app might not exist
      console.error('ArgoCD status check failed:', error);
    }

    const status = {
      appName,
      namespace: appName,
      pods: pods.items?.map((pod: any) => ({
        name: pod.metadata.name,
        ready: pod.status.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True',
        status: pod.status.phase,
        restarts: pod.status.containerStatuses?.[0]?.restartCount || 0,
        age: pod.metadata.creationTimestamp
      })) || [],
      ingresses: ingresses.items?.map((ing: any) => ({
        name: ing.metadata.name,
        hosts: ing.spec.rules?.map((r: any) => r.host) || [],
        tls: ing.spec.tls ? true : false,
        loadBalancer: ing.status.loadBalancer?.ingress?.[0]?.ip || 'pending'
      })) || [],
      argocd: argoStatus ? {
        syncStatus: argoStatus.status?.sync?.status,
        healthStatus: argoStatus.status?.health?.status,
        lastSync: argoStatus.status?.operationState?.finishedAt
      } : null,
      overall: 'unknown'
    };

    // Determine overall status
    const allPodsReady = status.pods.length > 0 && status.pods.every((p: any) => p.ready);
    const hasIngress = status.ingresses.length > 0;
    
    if (allPodsReady && hasIngress) {
      status.overall = 'healthy';
    } else if (status.pods.length > 0) {
      status.overall = 'deploying';
    } else {
      status.overall = 'pending';
    }

    return NextResponse.json(status);

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get status', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
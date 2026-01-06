import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getK8sClient } from '@/lib/cluster/k8s-api-client';

const SYSTEM_NAMESPACES = [
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'kubernetes-dashboard',
  'default',
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const k8sClient = getK8sClient();
    if (!k8sClient) {
      return NextResponse.json({ error: 'K8s client not configured' }, { status: 500 });
    }

    const deployments = await k8sClient.getAllDeployments();
    const ingresses = await k8sClient.getAllIngresses();

    const result = deployments
      .filter(dep => !SYSTEM_NAMESPACES.includes(dep.metadata.namespace))
      .map(dep => {
        const matchingIngress = ingresses.find(
          ing =>
            ing.metadata.namespace === dep.metadata.namespace &&
            (ing.metadata.name === dep.metadata.name ||
              ing.metadata.name.includes(dep.metadata.name))
        );

        return {
          name: dep.metadata.name,
          namespace: dep.metadata.namespace,
          replicas: dep.spec?.replicas || 1,
          readyReplicas: dep.status?.readyReplicas || 0,
          availableReplicas: dep.status?.availableReplicas || 0,
          image: dep.spec?.template?.spec?.containers?.[0]?.image,
          createdAt: dep.metadata.creationTimestamp,
          ingress: matchingIngress?.spec?.rules?.[0]?.host
            ? {
                host: matchingIngress.spec.rules[0].host,
                tls: !!matchingIngress.spec.tls?.length,
              }
            : undefined,
        };
      });

    return NextResponse.json({ deployments: result });
  } catch (error) {
    console.error('Error fetching K8s deployments:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getK8sClient, K8sPod, K8sDeployment, K8sService, K8sIngress } from '@/lib/cluster/k8s-api-client';

const SYSTEM_NAMESPACES = [
  'kube-system',
  'kube-public',
  'kube-node-lease',
];

interface NamespaceSummary {
  name: string;
  podCount: number;
  runningPods: number;
  deploymentCount: number;
  serviceCount: number;
  ingressCount: number;
}

interface PodSummary {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  node?: string;
  ip?: string;
  containers: Array<{
    name: string;
    image: string;
    ready: boolean;
    restartCount: number;
    state: string;
  }>;
}

interface DeploymentSummary {
  name: string;
  namespace: string;
  replicas: string;
  ready: number;
  available: number;
  age: string;
  image?: string;
  ingress?: {
    host: string;
    tls: boolean;
  };
}

interface ServiceSummary {
  name: string;
  namespace: string;
  type: string;
  clusterIP?: string;
  ports: string;
  selector?: string;
}

interface IngressSummary {
  name: string;
  namespace: string;
  hosts: string[];
  tls: boolean;
  paths: Array<{
    path: string;
    service: string;
    port: number;
  }>;
}

function formatAge(timestamp: string): string {
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now.getTime() - created.getTime();
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function getPodStatus(pod: K8sPod): string {
  if (pod.status.phase === 'Running') {
    const containerStatuses = pod.status.containerStatuses || [];
    const allReady = containerStatuses.every(c => c.ready);
    if (!allReady) {
      const waiting = containerStatuses.find(c => c.state.waiting);
      if (waiting?.state.waiting?.reason) {
        return waiting.state.waiting.reason;
      }
    }
  }
  return pod.status.phase;
}

function getContainerState(container: NonNullable<K8sPod['status']['containerStatuses']>[0]): string {
  if (container.state.running) return 'Running';
  if (container.state.waiting) return container.state.waiting.reason || 'Waiting';
  if (container.state.terminated) return container.state.terminated.reason || 'Terminated';
  return 'Unknown';
}

function summarizePod(pod: K8sPod): PodSummary {
  const containerStatuses = pod.status.containerStatuses || [];
  const readyCount = containerStatuses.filter(c => c.ready).length;
  const totalCount = pod.spec.containers.length;
  const totalRestarts = containerStatuses.reduce((sum, c) => sum + c.restartCount, 0);
  
  return {
    name: pod.metadata.name,
    namespace: pod.metadata.namespace,
    status: getPodStatus(pod),
    ready: `${readyCount}/${totalCount}`,
    restarts: totalRestarts,
    age: formatAge(pod.metadata.creationTimestamp),
    node: pod.spec.nodeName,
    ip: pod.status.podIP,
    containers: containerStatuses.map(c => ({
      name: c.name,
      image: c.image,
      ready: c.ready,
      restartCount: c.restartCount,
      state: getContainerState(c),
    })),
  };
}

function summarizeDeployment(dep: K8sDeployment, ingresses: K8sIngress[]): DeploymentSummary {
  const matchingIngress = ingresses.find(
    ing =>
      ing.metadata.namespace === dep.metadata.namespace &&
      (ing.metadata.name === dep.metadata.name ||
        ing.metadata.name.includes(dep.metadata.name))
  );

  return {
    name: dep.metadata.name,
    namespace: dep.metadata.namespace,
    replicas: `${dep.status.readyReplicas || 0}/${dep.spec.replicas}`,
    ready: dep.status.readyReplicas || 0,
    available: dep.status.availableReplicas || 0,
    age: formatAge(dep.metadata.creationTimestamp),
    image: dep.spec.template.spec.containers[0]?.image,
    ingress: matchingIngress?.spec?.rules?.[0]?.host
      ? {
          host: matchingIngress.spec.rules[0].host,
          tls: !!matchingIngress.spec.tls?.length,
        }
      : undefined,
  };
}

function summarizeService(svc: K8sService): ServiceSummary {
  const ports = svc.spec.ports
    ?.map(p => `${p.port}${p.name ? `/${p.name}` : ''}`)
    .join(', ') || '';
  
  const selector = svc.spec.selector
    ? Object.entries(svc.spec.selector).map(([k, v]) => `${k}=${v}`).join(',')
    : undefined;

  return {
    name: svc.metadata.name,
    namespace: svc.metadata.namespace,
    type: svc.spec.type,
    ports,
    selector,
  };
}

function summarizeIngress(ing: K8sIngress): IngressSummary {
  const hosts = ing.spec.rules?.map(r => r.host) || [];
  const paths = ing.spec.rules?.flatMap(r =>
    r.http?.paths.map(p => ({
      path: p.path,
      service: p.backend.service.name,
      port: p.backend.service.port.number,
    })) || []
  ) || [];

  return {
    name: ing.metadata.name,
    namespace: ing.metadata.namespace,
    hosts,
    tls: !!ing.spec.tls?.length,
    paths,
  };
}

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

    const [namespaces, allPods, allDeployments, allServices, allIngresses] = await Promise.all([
      k8sClient.getNamespaces(),
      k8sClient.getAllPods(),
      k8sClient.getAllDeployments(),
      k8sClient.getAllServices(),
      k8sClient.getAllIngresses(),
    ]);

    const userNamespaces = namespaces
      .filter(ns => !SYSTEM_NAMESPACES.includes(ns.metadata.name))
      .map(ns => ns.metadata.name);

    const userPods = allPods.filter(p => !SYSTEM_NAMESPACES.includes(p.metadata.namespace));
    const userDeployments = allDeployments.filter(d => !SYSTEM_NAMESPACES.includes(d.metadata.namespace));
    const userServices = allServices.filter(s => !SYSTEM_NAMESPACES.includes(s.metadata.namespace));
    const userIngresses = allIngresses.filter(i => !SYSTEM_NAMESPACES.includes(i.metadata.namespace));

    const namespaceSummaries: NamespaceSummary[] = userNamespaces.map(nsName => {
      const nsPods = userPods.filter(p => p.metadata.namespace === nsName);
      const nsDeployments = userDeployments.filter(d => d.metadata.namespace === nsName);
      const nsServices = userServices.filter(s => s.metadata.namespace === nsName);
      const nsIngresses = userIngresses.filter(i => i.metadata.namespace === nsName);

      return {
        name: nsName,
        podCount: nsPods.length,
        runningPods: nsPods.filter(p => p.status.phase === 'Running').length,
        deploymentCount: nsDeployments.length,
        serviceCount: nsServices.length,
        ingressCount: nsIngresses.length,
      };
    }).sort((a, b) => b.podCount - a.podCount);

    const pods = userPods.map(summarizePod);
    const deployments = userDeployments.map(d => summarizeDeployment(d, userIngresses));
    const services = userServices.map(summarizeService);
    const ingresses = userIngresses.map(summarizeIngress);

    const runningPods = userPods.filter(p => p.status.phase === 'Running').length;
    const pendingPods = userPods.filter(p => p.status.phase === 'Pending').length;
    const failedPods = userPods.filter(p => p.status.phase === 'Failed').length;

    const healthyDeployments = userDeployments.filter(
      d => d.status.readyReplicas === d.spec.replicas && d.spec.replicas > 0
    ).length;

    return NextResponse.json({
      namespaces: namespaceSummaries,
      pods,
      deployments,
      services,
      ingresses,
      summary: {
        namespaces: userNamespaces.length,
        pods: {
          total: userPods.length,
          running: runningPods,
          pending: pendingPods,
          failed: failedPods,
        },
        deployments: {
          total: userDeployments.length,
          healthy: healthyDeployments,
        },
        services: userServices.length,
        ingresses: userIngresses.length,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching K8s resources:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

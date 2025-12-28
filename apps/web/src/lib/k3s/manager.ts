import { K3sNode, ClusterConfig, NodeScalingRequest } from '@/types/cluster';
import { HetznerClient } from '@/lib/hetzner/client';

const K3S_INSTALL_SCRIPT = `#!/bin/bash
curl -sfL https://get.k3s.io | sh -s - \\
  --write-kubeconfig-mode 644 \\
  --tls-san {PUBLIC_IP} \\
  --node-external-ip {PUBLIC_IP} \\
  {EXTRA_ARGS}
`;

const K3S_AGENT_SCRIPT = `#!/bin/bash
curl -sfL https://get.k3s.io | K3S_URL=https://{MASTER_IP}:6443 K3S_TOKEN={TOKEN} sh -s - \\
  --node-external-ip {PUBLIC_IP}
`;

export class K3sClusterManager {
  private hetznerClient: HetznerClient;
  private k8sApiUrl: string;
  private k8sToken: string;

  constructor(
    hetznerApiToken: string,
    k8sApiUrl: string,
    k8sToken: string
  ) {
    this.hetznerClient = new HetznerClient(hetznerApiToken);
    this.k8sApiUrl = k8sApiUrl;
    this.k8sToken = k8sToken;
  }

  private async k8sRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.k8sApiUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.k8sToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Kubernetes API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getClusterInfo(): Promise<ClusterConfig> {
    // Get nodes
    const nodesResponse = await this.k8sRequest<{
      items: any[];
    }>('/api/v1/nodes');

    // Get node metrics
    const metricsResponse = await this.k8sRequest<{
      items: any[];
    }>('/apis/metrics.k8s.io/v1beta1/nodes');

    // Get Hetzner servers
    const hetznerServers = await this.hetznerClient.listServers('k3s=true');

    // Map nodes with their Hetzner server info and metrics
    const nodes: K3sNode[] = nodesResponse.items.map((node) => {
      const metrics = metricsResponse.items.find(
        (m) => m.metadata.name === node.metadata.name
      );
      const hetznerServer = hetznerServers.find(
        (s) => s.name === node.metadata.name
      );

      return {
        name: node.metadata.name,
        status: node.status.conditions.find((c: any) => c.type === 'Ready')
          ?.status === 'True'
          ? 'ready'
          : 'notready',
        role: node.metadata.labels['node-role.kubernetes.io/master']
          ? 'master'
          : 'worker',
        version: node.status.nodeInfo.kubeletVersion,
        internalIP: node.status.addresses.find((a: any) => a.type === 'InternalIP')
          ?.address,
        externalIP: node.status.addresses.find((a: any) => a.type === 'ExternalIP')
          ?.address,
        os: node.status.nodeInfo.osImage,
        kernelVersion: node.status.nodeInfo.kernelVersion,
        containerRuntime: node.status.nodeInfo.containerRuntimeVersion,
        cpu: {
          capacity: node.status.capacity.cpu,
          allocatable: node.status.allocatable.cpu,
          usage: metrics ? parseInt(metrics.usage.cpu) / 1000000000 : 0,
        },
        memory: {
          capacity: node.status.capacity.memory,
          allocatable: node.status.allocatable.memory,
          usage: metrics ? parseInt(metrics.usage.memory) / 1024 / 1024 : 0,
        },
        pods: {
          capacity: node.status.capacity.pods,
          current: 0, // Will be calculated from pod list
        },
        conditions: node.status.conditions,
        hetznerServer,
      };
    });

    // Get cluster version
    const versionResponse = await this.k8sRequest<any>('/version');

    // Calculate totals
    const totalCPU = nodes.reduce(
      (sum, node) => sum + parseInt(node.cpu.capacity),
      0
    );
    const totalMemory = nodes.reduce(
      (sum, node) => sum + parseInt(node.memory.capacity),
      0
    );
    const totalPods = nodes.reduce(
      (sum, node) => sum + parseInt(node.pods.capacity),
      0
    );
    const usedCPU = nodes.reduce((sum, node) => sum + node.cpu.usage, 0);
    const usedMemory = nodes.reduce((sum, node) => sum + node.memory.usage, 0);

    return {
      name: 'gmac-io-k3s',
      version: versionResponse.gitVersion,
      endpoint: this.k8sApiUrl,
      nodes,
      totalCPU,
      totalMemory,
      totalPods,
      usedCPU,
      usedMemory,
      runningPods: 0, // Will be calculated from pod list
    };
  }

  async addNode(request: NodeScalingRequest): Promise<void> {
    if (request.action !== 'add') {
      throw new Error('Invalid action for addNode');
    }

    // Get existing nodes to find master
    const nodes = await this.getClusterInfo();
    const masterNode = nodes.nodes.find((n) => n.role === 'master');
    if (!masterNode || !masterNode.hetznerServer) {
      throw new Error('No master node found');
    }

    // Generate node name
    const nodeCount = nodes.nodes.filter(
      (n) => n.role === request.nodeType
    ).length;
    const nodeName = `${request.nodeType}-${nodeCount + 1}`;

    // Get K3s token from master
    const tokenCommand = 'sudo cat /var/lib/rancher/k3s/server/node-token';
    // In production, you'd SSH to the master to get this token

    // Prepare user data script
    const userData =
      request.nodeType === 'master'
        ? K3S_INSTALL_SCRIPT.replace('{PUBLIC_IP}', '{SERVER_IP}').replace(
            '{EXTRA_ARGS}',
            '--cluster-init'
          )
        : K3S_AGENT_SCRIPT.replace('{MASTER_IP}', masterNode.externalIP || '')
            .replace('{TOKEN}', '{K3S_TOKEN}')
            .replace('{PUBLIC_IP}', '{SERVER_IP}');

    // Create server
    const server = await this.hetznerClient.createServer({
      name: nodeName,
      server_type: request.serverType || 'cx22',
      image: 'ubuntu-22.04',
      location: request.location,
      ssh_keys: request.sshKey ? [request.sshKey] : undefined,
      user_data: userData,
      labels: {
        k3s: 'true',
        role: request.nodeType,
        cluster: 'gmac-io',
      },
    });

    // Wait for server to be ready
    // In production, you'd poll the server status
  }

  async removeNode(nodeName: string): Promise<void> {
    // Drain node first
    await this.k8sRequest(`/api/v1/nodes/${nodeName}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/strategic-merge-patch+json',
      },
      body: JSON.stringify({
        spec: {
          unschedulable: true,
        },
      }),
    });

    // Delete pods from node
    const podsResponse = await this.k8sRequest<{ items: any[] }>(
      `/api/v1/pods?fieldSelector=spec.nodeName=${nodeName}`
    );

    for (const pod of podsResponse.items) {
      if (pod.metadata.namespace !== 'kube-system') {
        await this.k8sRequest(
          `/api/v1/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}`,
          { method: 'DELETE' }
        );
      }
    }

    // Remove node from cluster
    await this.k8sRequest(`/api/v1/nodes/${nodeName}`, {
      method: 'DELETE',
    });

    // Delete Hetzner server
    const servers = await this.hetznerClient.listServers(`name=${nodeName}`);
    if (servers.length > 0) {
      await this.hetznerClient.deleteServer(servers[0].id);
    }
  }

  async scaleNodes(
    nodeType: 'master' | 'worker',
    targetCount: number
  ): Promise<void> {
    const cluster = await this.getClusterInfo();
    const currentNodes = cluster.nodes.filter((n) => n.role === nodeType);
    const currentCount = currentNodes.length;

    if (targetCount > currentCount) {
      // Scale up
      const nodesToAdd = targetCount - currentCount;
      for (let i = 0; i < nodesToAdd; i++) {
        await this.addNode({
          action: 'add',
          nodeType,
        });
      }
    } else if (targetCount < currentCount) {
      // Scale down
      const nodesToRemove = currentCount - targetCount;
      const sortedNodes = currentNodes.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      for (let i = 0; i < nodesToRemove; i++) {
        const nodeToRemove = sortedNodes[sortedNodes.length - 1 - i];
        await this.removeNode(nodeToRemove.name);
      }
    }
  }

  async getNodeMetrics(nodeName: string): Promise<any> {
    const node = await this.k8sRequest<any>(`/api/v1/nodes/${nodeName}`);
    const metrics = await this.k8sRequest<any>(
      `/apis/metrics.k8s.io/v1beta1/nodes/${nodeName}`
    );

    // Get Hetzner server metrics if available
    const servers = await this.hetznerClient.listServers(`name=${nodeName}`);
    let hetznerMetrics = null;
    if (servers.length > 0) {
      const end = new Date();
      const start = new Date(end.getTime() - 60 * 60 * 1000); // Last hour
      hetznerMetrics = {
        cpu: await this.hetznerClient.getMetrics(servers[0].id, 'cpu', start, end),
        network: await this.hetznerClient.getMetrics(
          servers[0].id,
          'network',
          start,
          end
        ),
      };
    }

    return {
      kubernetes: {
        node,
        metrics,
      },
      hetzner: hetznerMetrics,
    };
  }
}

// Compatibility shim for create-wizard route import
export class K3sManager {
  // Placeholder implementation to satisfy imports without requiring constructor args
}

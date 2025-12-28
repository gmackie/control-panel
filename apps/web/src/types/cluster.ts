export interface HetznerServer {
  id: number;
  name: string;
  status: 'running' | 'initializing' | 'starting' | 'stopping' | 'off' | 'deleting' | 'migrating' | 'rebuilding' | 'unknown';
  public_net: {
    ipv4: {
      ip: string;
      blocked: boolean;
    };
    ipv6: {
      ip: string;
      blocked: boolean;
    };
  };
  server_type: {
    id: number;
    name: string;
    description: string;
    cores: number;
    memory: number;
    disk: number;
    cpu_type: string;
    prices: Array<{
      location: string;
      price_hourly: {
        net: string;
        gross: string;
      };
      price_monthly: {
        net: string;
        gross: string;
      };
    }>;
  };
  datacenter: {
    id: number;
    name: string;
    description: string;
    location: {
      id: number;
      name: string;
      description: string;
      country: string;
      city: string;
      latitude: number;
      longitude: number;
    };
  };
  created: string;
  labels: Record<string, string>;
}

export interface K3sNode {
  name: string;
  status: 'ready' | 'notready' | 'unknown';
  role: 'master' | 'worker';
  version: string;
  internalIP: string;
  externalIP?: string;
  os: string;
  kernelVersion: string;
  containerRuntime: string;
  cpu: {
    capacity: string;
    allocatable: string;
    usage: number;
  };
  memory: {
    capacity: string;
    allocatable: string;
    usage: number;
  };
  pods: {
    capacity: string;
    current: number;
  };
  conditions: Array<{
    type: string;
    status: string;
    lastHeartbeatTime: string;
    lastTransitionTime: string;
    reason: string;
    message: string;
  }>;
  hetznerServer?: HetznerServer;
}

export interface ClusterConfig {
  name: string;
  version: string;
  endpoint: string;
  nodes: K3sNode[];
  totalCPU: number;
  totalMemory: number;
  totalPods: number;
  usedCPU: number;
  usedMemory: number;
  runningPods: number;
}

export interface ServerType {
  id: number;
  name: string;
  description: string;
  cores: number;
  memory: number;
  disk: number;
  cpu_type: string;
  architecture: 'x86' | 'arm';
  traffic: number;
  prices: Array<{
    location: string;
    price_hourly: {
      net: string;
      gross: string;
    };
    price_monthly: {
      net: string;
      gross: string;
    };
  }>;
}

export interface Location {
  id: number;
  name: string;
  description: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  network_zone: string;
}

export interface NodeScalingRequest {
  action: 'add' | 'remove';
  nodeType: 'master' | 'worker';
  serverType?: string;
  location?: string;
  nodeName?: string;
  sshKey?: string;
}

export interface ClusterStats {
  nodes: {
    total: number;
    ready: number;
    notReady: number;
    masters: number;
    workers: number;
  };
  resources: {
    cpu: {
      total: number;
      used: number;
      percentage: number;
    };
    memory: {
      total: number;
      used: number;
      percentage: number;
    };
    pods: {
      total: number;
      running: number;
      pending: number;
      failed: number;
    };
  };
  cost: {
    hourly: number;
    monthly: number;
    currency: string;
  };
}
import { ClusterModule } from './base';
import { KubeconfigManager } from './kubeconfig-manager';
import { SimpleNodeOnboardingModule } from './node-onboarding-simple';
import { HetznerClient } from '@/lib/hetzner/client';

export interface AutoscalingPolicy {
  name: string;
  enabled: boolean;
  minNodes: number;
  maxNodes: number;
  targetCPUUtilization?: number;
  targetMemoryUtilization?: number;
  targetPodCount?: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number; // seconds
  scaleDownCooldown: number; // seconds
  nodeSelector?: Record<string, string>;
}

export interface ClusterMetrics {
  cpuUsage: number;
  memoryUsage: number;
  podCount: number;
  nodeCount: number;
  timestamp: Date;
}

export interface AutoscalerConfig {
  checkInterval: number; // seconds
  dryRun: boolean;
  policies: AutoscalingPolicy[];
  hetznerApiToken: string;
  defaultServerType: string;
  defaultLocation: string;
}

export class ClusterAutoscaler implements ClusterModule {
  name = 'ClusterAutoscaler';
  version = '1.0.0';
  description = 'Automatic cluster scaling based on metrics';

  private kubeconfigManager?: KubeconfigManager;
  private nodeOnboarding?: SimpleNodeOnboardingModule;
  private hetznerClient?: HetznerClient;
  private policies: Map<string, AutoscalingPolicy> = new Map();
  private lastScaleAction: Map<string, Date> = new Map();
  private metricsHistory: ClusterMetrics[] = [];
  private checkInterval?: NodeJS.Timeout;

  constructor(private config: AutoscalerConfig) {
    this.config.policies.forEach(policy => {
      this.policies.set(policy.name, policy);
    });
  }

  async initialize(): Promise<void> {
    this.hetznerClient = new HetznerClient(this.config.hetznerApiToken);
    console.log('Cluster Autoscaler initialized');
  }

  setDependencies(kubeconfigManager: KubeconfigManager, nodeOnboarding: SimpleNodeOnboardingModule) {
    this.kubeconfigManager = kubeconfigManager;
    this.nodeOnboarding = nodeOnboarding;
  }

  async startAutoscaling(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Initial check
    await this.checkAndScale();

    // Schedule periodic checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkAndScale();
      } catch (error) {
        console.error('Autoscaling check failed:', error);
      }
    }, this.config.checkInterval * 1000);

    console.log(`Autoscaler started with check interval: ${this.config.checkInterval}s`);
  }

  async stopAutoscaling(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    console.log('Autoscaler stopped');
  }

  private async checkAndScale(): Promise<void> {
    const metrics = await this.collectMetrics();
    this.metricsHistory.push(metrics);

    // Keep only last hour of metrics
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > oneHourAgo);

    for (const [name, policy] of this.policies) {
      if (!policy.enabled) continue;

      const decision = this.evaluatePolicy(policy, metrics);
      if (decision !== 'none') {
        await this.executeScalingDecision(policy, decision, metrics);
      }
    }
  }

  private async collectMetrics(): Promise<ClusterMetrics> {
    if (!this.kubeconfigManager) {
      throw new Error('KubeconfigManager not set');
    }

    const kubectl = this.kubeconfigManager.getKubectlCommand('default');

    // Get node metrics
    const nodesOutput = await kubectl('get nodes -o json');
    const nodes = JSON.parse(nodesOutput);

    // Get metrics from metrics server
    const metricsOutput = await kubectl('top nodes --no-headers').catch(() => '');

    // Parse metrics
    let totalCPU = 0;
    let totalMemory = 0;
    let nodeCount = 0;

    const lines = metricsOutput.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const cpu = parseInt(parts[1]);
        const memory = parseInt(parts[3]);
        totalCPU += cpu;
        totalMemory += memory;
        nodeCount++;
      }
    }

    // Get pod count
    const podsOutput = await kubectl('get pods --all-namespaces --no-headers | wc -l');
    const podCount = parseInt(podsOutput.trim()) || 0;

    return {
      cpuUsage: nodeCount > 0 ? totalCPU / nodeCount : 0,
      memoryUsage: nodeCount > 0 ? totalMemory / nodeCount : 0,
      podCount,
      nodeCount,
      timestamp: new Date()
    };
  }

  private evaluatePolicy(policy: AutoscalingPolicy, metrics: ClusterMetrics): 'scale-up' | 'scale-down' | 'none' {
    // Check if we're in cooldown period
    const lastAction = this.lastScaleAction.get(policy.name);
    if (lastAction) {
      const now = new Date();
      const timeSinceLastAction = (now.getTime() - lastAction.getTime()) / 1000;
      
      if (timeSinceLastAction < policy.scaleUpCooldown || timeSinceLastAction < policy.scaleDownCooldown) {
        return 'none';
      }
    }

    // Check if we need to scale up
    let scaleUpNeeded = false;
    if (policy.targetCPUUtilization && metrics.cpuUsage > policy.targetCPUUtilization * policy.scaleUpThreshold) {
      scaleUpNeeded = true;
    }
    if (policy.targetMemoryUtilization && metrics.memoryUsage > policy.targetMemoryUtilization * policy.scaleUpThreshold) {
      scaleUpNeeded = true;
    }
    if (policy.targetPodCount && metrics.podCount > policy.targetPodCount * policy.scaleUpThreshold) {
      scaleUpNeeded = true;
    }

    if (scaleUpNeeded && metrics.nodeCount < policy.maxNodes) {
      return 'scale-up';
    }

    // Check if we need to scale down
    let scaleDownPossible = true;
    if (policy.targetCPUUtilization && metrics.cpuUsage > policy.targetCPUUtilization * policy.scaleDownThreshold) {
      scaleDownPossible = false;
    }
    if (policy.targetMemoryUtilization && metrics.memoryUsage > policy.targetMemoryUtilization * policy.scaleDownThreshold) {
      scaleDownPossible = false;
    }
    if (policy.targetPodCount && metrics.podCount > policy.targetPodCount * policy.scaleDownThreshold) {
      scaleDownPossible = false;
    }

    if (scaleDownPossible && metrics.nodeCount > policy.minNodes) {
      return 'scale-down';
    }

    return 'none';
  }

  private async executeScalingDecision(
    policy: AutoscalingPolicy,
    decision: 'scale-up' | 'scale-down',
    metrics: ClusterMetrics
  ): Promise<void> {
    console.log(`Autoscaler: ${decision} triggered by policy ${policy.name}`);
    console.log(`Current metrics:`, metrics);

    if (this.config.dryRun) {
      console.log('Dry run mode - no actual scaling performed');
      return;
    }

    this.lastScaleAction.set(policy.name, new Date());

    if (decision === 'scale-up') {
      await this.scaleUp(policy);
    } else {
      await this.scaleDown(policy);
    }
  }

  private async scaleUp(policy: AutoscalingPolicy): Promise<void> {
    if (!this.nodeOnboarding) {
      throw new Error('NodeOnboarding not set');
    }

    console.log(`Scaling up: adding new worker node`);
    
    try {
      const result = await this.nodeOnboarding.onboardNode({
        serverType: this.config.defaultServerType,
        location: this.config.defaultLocation,
        role: 'worker',
        labels: policy.nodeSelector
      });

      console.log(`Successfully added node: ${result.nodeName}`);
      
      // Emit event for UI updates
      this.emitScalingEvent({
        type: 'scale-up',
        policy: policy.name,
        nodeId: result.nodeId,
        nodeName: result.nodeName,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to scale up:', error);
      throw error;
    }
  }

  private async scaleDown(policy: AutoscalingPolicy): Promise<void> {
    if (!this.kubeconfigManager || !this.hetznerClient) {
      throw new Error('Dependencies not set');
    }

    const kubectl = this.kubeconfigManager.getKubectlCommand('default');

    // Get list of worker nodes
    const nodesOutput = await kubectl('get nodes -l node-role.kubernetes.io/worker=true -o json');
    const nodes = JSON.parse(nodesOutput);

    if (!nodes.items || nodes.items.length === 0) {
      console.log('No worker nodes available for scale down');
      return;
    }

    // Find the newest worker node to remove
    const workerNodes = nodes.items.sort((a: any, b: any) => {
      const timeA = new Date(a.metadata.creationTimestamp).getTime();
      const timeB = new Date(b.metadata.creationTimestamp).getTime();
      return timeB - timeA; // Newest first
    });

    const nodeToRemove = workerNodes[0];
    const nodeName = nodeToRemove.metadata.name;

    console.log(`Scaling down: removing node ${nodeName}`);

    try {
      // Cordon the node (prevent new pods)
      await kubectl(`cordon ${nodeName}`);

      // Drain the node (move pods to other nodes)
      await kubectl(`drain ${nodeName} --ignore-daemonsets --delete-emptydir-data --force`);

      // Remove from cluster
      await kubectl(`delete node ${nodeName}`);

      // Delete the server from Hetzner
      const servers = await this.hetznerClient.listServers();
      const server = servers.find(s => s.name === nodeName);
      
      if (server) {
        await this.hetznerClient.deleteServer(server.id);
        console.log(`Successfully removed node: ${nodeName}`);
      }

      // Emit event for UI updates
      this.emitScalingEvent({
        type: 'scale-down',
        policy: policy.name,
        nodeId: server?.id.toString() || '',
        nodeName: nodeName,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to scale down:', error);
      throw error;
    }
  }

  private emitScalingEvent(event: any): void {
    // This would typically emit to an event bus or websocket
    // For now, just log it
    console.log('Scaling event:', event);
  }

  async getMetricsHistory(): Promise<ClusterMetrics[]> {
    return [...this.metricsHistory];
  }

  async getPolicies(): Promise<AutoscalingPolicy[]> {
    return Array.from(this.policies.values());
  }

  async updatePolicy(name: string, updates: Partial<AutoscalingPolicy>): Promise<void> {
    const policy = this.policies.get(name);
    if (!policy) {
      throw new Error(`Policy ${name} not found`);
    }

    const updatedPolicy = { ...policy, ...updates };
    this.policies.set(name, updatedPolicy);
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      if (!this.kubeconfigManager || !this.nodeOnboarding) {
        return { healthy: false, message: 'Dependencies not initialized' };
      }

      // Check if we can collect metrics
      await this.collectMetrics();

      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, message: error.message };
    }
  }

  async cleanup(): Promise<void> {
    await this.stopAutoscaling();
  }
}
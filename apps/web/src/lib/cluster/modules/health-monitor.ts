import { ClusterModule } from './base';
import { KubeconfigManager } from './kubeconfig-manager';
import { EventEmitter } from 'events';

export interface NodeHealthMetrics {
  nodeName: string;
  timestamp: Date;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  conditions: {
    ready: boolean;
    memoryPressure: boolean;
    diskPressure: boolean;
    pidPressure: boolean;
    networkUnavailable: boolean;
  };
  resources: {
    cpu: {
      capacity: number;
      allocatable: number;
      usage: number;
      percentage: number;
    };
    memory: {
      capacity: number;
      allocatable: number;
      usage: number;
      percentage: number;
    };
    pods: {
      capacity: number;
      current: number;
      percentage: number;
    };
  };
  systemInfo: {
    kernelVersion: string;
    osImage: string;
    containerRuntimeVersion: string;
    kubeletVersion: string;
    architecture: string;
  };
  lastHeartbeat: Date;
}

export interface HealthAlert {
  id: string;
  nodeName: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'heartbeat' | 'condition';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface HealthMonitorConfig {
  checkInterval: number; // seconds
  metricsRetention: number; // hours
  thresholds: {
    cpu: {
      warning: number;
      critical: number;
    };
    memory: {
      warning: number;
      critical: number;
    };
    disk: {
      warning: number;
      critical: number;
    };
    heartbeat: {
      warning: number; // seconds
      critical: number; // seconds
    };
  };
}

export class HealthMonitor extends EventEmitter implements ClusterModule {
  name = 'HealthMonitor';
  version = '1.0.0';
  description = 'Monitors node health and system metrics';

  private kubeconfigManager?: KubeconfigManager;
  private config: HealthMonitorConfig;
  private checkInterval?: NodeJS.Timeout;
  private metricsHistory: Map<string, NodeHealthMetrics[]> = new Map();
  private alerts: Map<string, HealthAlert> = new Map();
  private lastCheck: Map<string, Date> = new Map();

  constructor(config: HealthMonitorConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('Health Monitor initialized');
  }

  setDependencies(kubeconfigManager: KubeconfigManager) {
    this.kubeconfigManager = kubeconfigManager;
  }

  async startMonitoring(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Initial check
    await this.checkAllNodes();

    // Schedule periodic checks
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkAllNodes();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.config.checkInterval * 1000);

    console.log(`Health monitoring started with interval: ${this.config.checkInterval}s`);
  }

  async stopMonitoring(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    console.log('Health monitoring stopped');
  }

  private async checkAllNodes(): Promise<void> {
    if (!this.kubeconfigManager) {
      throw new Error('KubeconfigManager not set');
    }

    const kubectl = this.kubeconfigManager.getKubectlCommand('default');

    try {
      // Get node information
      const nodesJson = await kubectl('get nodes -o json');
      const nodes = JSON.parse(nodesJson);

      // Get node metrics
      const metricsJson = await kubectl('top nodes --no-headers').catch(() => '');
      const metricsMap = this.parseNodeMetrics(metricsJson);

      // Get pod information
      const podsJson = await kubectl('get pods --all-namespaces -o json');
      const pods = JSON.parse(podsJson);
      const podsByNode = this.groupPodsByNode(pods.items);

      // Process each node
      for (const node of nodes.items) {
        const nodeName = node.metadata.name;
        const metrics = await this.collectNodeMetrics(node, metricsMap.get(nodeName), podsByNode.get(nodeName) || []);
        
        // Store metrics
        this.storeMetrics(nodeName, metrics);
        
        // Check for issues
        await this.evaluateNodeHealth(metrics);
        
        // Update last check time
        this.lastCheck.set(nodeName, new Date());
      }

      // Check for missing nodes (heartbeat)
      this.checkHeartbeats();

      // Clean up old metrics
      this.cleanupOldMetrics();
    } catch (error) {
      console.error('Error checking node health:', error);
      throw error;
    }
  }

  private parseNodeMetrics(metricsOutput: string): Map<string, { cpu: string; memory: string }> {
    const map = new Map();
    const lines = metricsOutput.trim().split('\n').filter(Boolean);
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        map.set(parts[0], {
          cpu: parts[1],
          memory: parts[3]
        });
      }
    }
    
    return map;
  }

  private groupPodsByNode(pods: any[]): Map<string, any[]> {
    const map = new Map();
    
    for (const pod of pods) {
      const nodeName = pod.spec.nodeName;
      if (nodeName) {
        if (!map.has(nodeName)) {
          map.set(nodeName, []);
        }
        map.get(nodeName)!.push(pod);
      }
    }
    
    return map;
  }

  private async collectNodeMetrics(
    node: any,
    topMetrics: { cpu: string; memory: string } | undefined,
    pods: any[]
  ): Promise<NodeHealthMetrics> {
    const conditions = this.parseNodeConditions(node.status.conditions);
    const resources = this.calculateResourceUsage(node, topMetrics, pods);
    const systemInfo = this.extractSystemInfo(node.status.nodeInfo);
    const status = this.determineNodeStatus(conditions, resources);

    return {
      nodeName: node.metadata.name,
      timestamp: new Date(),
      status,
      conditions,
      resources,
      systemInfo,
      lastHeartbeat: new Date(node.status.conditions.find((c: any) => c.type === 'Ready')?.lastHeartbeatTime || Date.now())
    };
  }

  private parseNodeConditions(conditions: any[]): NodeHealthMetrics['conditions'] {
    const result = {
      ready: false,
      memoryPressure: false,
      diskPressure: false,
      pidPressure: false,
      networkUnavailable: false
    };

    for (const condition of conditions) {
      switch (condition.type) {
        case 'Ready':
          result.ready = condition.status === 'True';
          break;
        case 'MemoryPressure':
          result.memoryPressure = condition.status === 'True';
          break;
        case 'DiskPressure':
          result.diskPressure = condition.status === 'True';
          break;
        case 'PIDPressure':
          result.pidPressure = condition.status === 'True';
          break;
        case 'NetworkUnavailable':
          result.networkUnavailable = condition.status === 'True';
          break;
      }
    }

    return result;
  }

  private calculateResourceUsage(
    node: any,
    topMetrics: { cpu: string; memory: string } | undefined,
    pods: any[]
  ): NodeHealthMetrics['resources'] {
    // Parse capacity and allocatable
    const capacity = node.status.capacity;
    const allocatable = node.status.allocatable;

    // Parse CPU
    const cpuCapacity = this.parseCPU(capacity.cpu);
    const cpuAllocatable = this.parseCPU(allocatable.cpu);
    const cpuUsage = topMetrics ? this.parseCPU(topMetrics.cpu) : 0;

    // Parse Memory
    const memoryCapacity = this.parseMemory(capacity.memory);
    const memoryAllocatable = this.parseMemory(allocatable.memory);
    const memoryUsage = topMetrics ? this.parseMemory(topMetrics.memory) : 0;

    // Pod count
    const podCapacity = parseInt(capacity.pods) || 110;
    const podCurrent = pods.length;

    return {
      cpu: {
        capacity: cpuCapacity,
        allocatable: cpuAllocatable,
        usage: cpuUsage,
        percentage: cpuAllocatable > 0 ? (cpuUsage / cpuAllocatable) * 100 : 0
      },
      memory: {
        capacity: memoryCapacity,
        allocatable: memoryAllocatable,
        usage: memoryUsage,
        percentage: memoryAllocatable > 0 ? (memoryUsage / memoryAllocatable) * 100 : 0
      },
      pods: {
        capacity: podCapacity,
        current: podCurrent,
        percentage: podCapacity > 0 ? (podCurrent / podCapacity) * 100 : 0
      }
    };
  }

  private parseCPU(cpu: string): number {
    if (!cpu) return 0;
    
    // Handle millicores (e.g., "100m")
    if (cpu.endsWith('m')) {
      return parseInt(cpu) / 1000;
    }
    
    // Handle cores (e.g., "2")
    return parseInt(cpu) || 0;
  }

  private parseMemory(memory: string): number {
    if (!memory) return 0;
    
    const units: Record<string, number> = {
      'Ki': 1024,
      'Mi': 1024 * 1024,
      'Gi': 1024 * 1024 * 1024,
      'K': 1000,
      'M': 1000 * 1000,
      'G': 1000 * 1000 * 1000
    };
    
    for (const [unit, multiplier] of Object.entries(units)) {
      if (memory.endsWith(unit)) {
        return parseInt(memory) * multiplier;
      }
    }
    
    return parseInt(memory) || 0;
  }

  private extractSystemInfo(nodeInfo: any): NodeHealthMetrics['systemInfo'] {
    return {
      kernelVersion: nodeInfo.kernelVersion || 'Unknown',
      osImage: nodeInfo.osImage || 'Unknown',
      containerRuntimeVersion: nodeInfo.containerRuntimeVersion || 'Unknown',
      kubeletVersion: nodeInfo.kubeletVersion || 'Unknown',
      architecture: nodeInfo.architecture || 'Unknown'
    };
  }

  private determineNodeStatus(
    conditions: NodeHealthMetrics['conditions'],
    resources: NodeHealthMetrics['resources']
  ): NodeHealthMetrics['status'] {
    // Critical conditions
    if (!conditions.ready || conditions.networkUnavailable) {
      return 'critical';
    }

    // Resource pressure
    if (conditions.memoryPressure || conditions.diskPressure || conditions.pidPressure) {
      return 'critical';
    }

    // Check resource thresholds
    if (resources.cpu.percentage >= this.config.thresholds.cpu.critical ||
        resources.memory.percentage >= this.config.thresholds.memory.critical) {
      return 'critical';
    }

    if (resources.cpu.percentage >= this.config.thresholds.cpu.warning ||
        resources.memory.percentage >= this.config.thresholds.memory.warning) {
      return 'warning';
    }

    return 'healthy';
  }

  private storeMetrics(nodeName: string, metrics: NodeHealthMetrics): void {
    if (!this.metricsHistory.has(nodeName)) {
      this.metricsHistory.set(nodeName, []);
    }
    
    const history = this.metricsHistory.get(nodeName)!;
    history.push(metrics);
    
    // Emit metrics event
    this.emit('metrics', { nodeName, metrics });
  }

  private async evaluateNodeHealth(metrics: NodeHealthMetrics): Promise<void> {
    const alerts: HealthAlert[] = [];

    // Check CPU
    if (metrics.resources.cpu.percentage >= this.config.thresholds.cpu.critical) {
      alerts.push(this.createAlert(
        metrics.nodeName,
        'cpu',
        'critical',
        `CPU usage critical: ${metrics.resources.cpu.percentage.toFixed(1)}%`
      ));
    } else if (metrics.resources.cpu.percentage >= this.config.thresholds.cpu.warning) {
      alerts.push(this.createAlert(
        metrics.nodeName,
        'cpu',
        'warning',
        `CPU usage high: ${metrics.resources.cpu.percentage.toFixed(1)}%`
      ));
    }

    // Check Memory
    if (metrics.resources.memory.percentage >= this.config.thresholds.memory.critical) {
      alerts.push(this.createAlert(
        metrics.nodeName,
        'memory',
        'critical',
        `Memory usage critical: ${metrics.resources.memory.percentage.toFixed(1)}%`
      ));
    } else if (metrics.resources.memory.percentage >= this.config.thresholds.memory.warning) {
      alerts.push(this.createAlert(
        metrics.nodeName,
        'memory',
        'warning',
        `Memory usage high: ${metrics.resources.memory.percentage.toFixed(1)}%`
      ));
    }

    // Check conditions
    if (!metrics.conditions.ready) {
      alerts.push(this.createAlert(
        metrics.nodeName,
        'condition',
        'critical',
        'Node is not ready'
      ));
    }

    if (metrics.conditions.diskPressure) {
      alerts.push(this.createAlert(
        metrics.nodeName,
        'disk',
        'critical',
        'Node has disk pressure'
      ));
    }

    if (metrics.conditions.networkUnavailable) {
      alerts.push(this.createAlert(
        metrics.nodeName,
        'network',
        'critical',
        'Node network is unavailable'
      ));
    }

    // Process alerts
    for (const alert of alerts) {
      this.processAlert(alert);
    }

    // Resolve cleared alerts
    this.resolveAlerts(metrics.nodeName, alerts);
  }

  private createAlert(
    nodeName: string,
    type: HealthAlert['type'],
    severity: HealthAlert['severity'],
    message: string
  ): HealthAlert {
    return {
      id: `${nodeName}-${type}-${Date.now()}`,
      nodeName,
      type,
      severity,
      message,
      timestamp: new Date(),
      resolved: false
    };
  }

  private processAlert(alert: HealthAlert): void {
    const existingAlert = Array.from(this.alerts.values()).find(
      a => a.nodeName === alert.nodeName && a.type === alert.type && !a.resolved
    );

    if (!existingAlert) {
      this.alerts.set(alert.id, alert);
      this.emit('alert', alert);
      console.log(`[HealthMonitor] Alert: ${alert.message}`);
    }
  }

  private resolveAlerts(nodeName: string, currentAlerts: HealthAlert[]): void {
    const alertTypes = new Set(currentAlerts.map(a => a.type));
    
    for (const [id, alert] of this.alerts) {
      if (alert.nodeName === nodeName && !alert.resolved && !alertTypes.has(alert.type)) {
        alert.resolved = true;
        alert.resolvedAt = new Date();
        this.emit('alertResolved', alert);
        console.log(`[HealthMonitor] Alert resolved: ${alert.message}`);
      }
    }
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    
    for (const [nodeName, lastCheck] of this.lastCheck) {
      const timeSinceCheck = (now - lastCheck.getTime()) / 1000;
      
      if (timeSinceCheck > this.config.thresholds.heartbeat.critical) {
        this.processAlert(this.createAlert(
          nodeName,
          'heartbeat',
          'critical',
          `No heartbeat for ${Math.round(timeSinceCheck)}s`
        ));
      } else if (timeSinceCheck > this.config.thresholds.heartbeat.warning) {
        this.processAlert(this.createAlert(
          nodeName,
          'heartbeat',
          'warning',
          `Heartbeat delayed for ${Math.round(timeSinceCheck)}s`
        ));
      }
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - (this.config.metricsRetention * 60 * 60 * 1000);
    
    for (const [nodeName, metrics] of this.metricsHistory) {
      const filtered = metrics.filter(m => m.timestamp.getTime() > cutoff);
      this.metricsHistory.set(nodeName, filtered);
    }

    // Clean up resolved alerts older than retention period
    for (const [id, alert] of this.alerts) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt.getTime() < cutoff) {
        this.alerts.delete(id);
      }
    }
  }

  async getNodeMetrics(nodeName?: string): Promise<Map<string, NodeHealthMetrics[]>> {
    if (nodeName) {
      const metrics = this.metricsHistory.get(nodeName);
      return new Map(metrics ? [[nodeName, metrics]] : []);
    }
    return new Map(this.metricsHistory);
  }

  async getAlerts(activeOnly: boolean = true): Promise<HealthAlert[]> {
    const alerts = Array.from(this.alerts.values());
    return activeOnly ? alerts.filter(a => !a.resolved) : alerts;
  }

  async getNodeSummary(): Promise<Map<string, NodeHealthMetrics['status']>> {
    const summary = new Map<string, NodeHealthMetrics['status']>();
    
    for (const [nodeName, metrics] of this.metricsHistory) {
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        summary.set(nodeName, latest.status);
      }
    }
    
    return summary;
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      if (!this.kubeconfigManager) {
        return { healthy: false, message: 'Dependencies not initialized' };
      }

      const nodeCount = this.metricsHistory.size;
      const activeAlerts = await this.getAlerts(true);

      return { 
        healthy: true, 
        message: `Monitoring ${nodeCount} nodes, ${activeAlerts.length} active alerts`
      };
    } catch (error: any) {
      return { healthy: false, message: error.message };
    }
  }

  async cleanup(): Promise<void> {
    await this.stopMonitoring();
    this.removeAllListeners();
  }
}
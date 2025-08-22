import { ClusterModule, ClusterModuleRegistry, ModuleConfig } from './modules/base';
import { SimpleNodeOnboardingModule } from './modules/node-onboarding-simple';
import { KubeconfigManager } from './modules/kubeconfig-manager';
import { RegistryManager } from './modules/registry-manager';
import { DeploymentManager } from './modules/deployment-manager';
import { ClusterAutoscaler, AutoscalingPolicy } from './modules/autoscaler';
import { HealthMonitor, HealthMonitorConfig } from './modules/health-monitor';
import { CostTracker, CostTrackerConfig } from './modules/cost-tracker';

export interface OrchestratorConfig {
  hetznerApiToken: string;
  sshKeyPath: string;
  clusterName: string;
  kubeconfigEncryptionKey?: string;
  registry?: {
    enabled: boolean;
    type: 'harbor' | 'registry' | 'distribution';
    url: string;
    auth: {
      username: string;
      password: string;
    };
    storage: {
      type: 's3' | 'filesystem';
      config: Record<string, any>;
    };
  };
  autoscaling?: {
    enabled: boolean;
    checkInterval: number;
    dryRun: boolean;
    defaultServerType: string;
    defaultLocation: string;
    policies: AutoscalingPolicy[];
  };
  healthMonitoring?: {
    enabled: boolean;
    checkInterval: number;
    metricsRetention: number;
    thresholds: {
      cpu: { warning: number; critical: number };
      memory: { warning: number; critical: number };
      disk: { warning: number; critical: number };
      heartbeat: { warning: number; critical: number };
    };
  };
  costTracking?: {
    enabled: boolean;
    checkInterval: number;
    historyRetention: number;
    enableOptimizations: boolean;
    alertThresholds: {
      daily: number;
      monthly: number;
      unusualSpike: number;
    };
  };
}

export class ClusterOrchestrator implements ClusterModuleRegistry {
  modules: Map<string, ClusterModule> = new Map();
  configs: Map<string, ModuleConfig> = new Map();
  
  private config: OrchestratorConfig;
  private initialized = false;

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize core modules
    await this.initializeKubeconfigManager();
    await this.initializeNodeOnboarding();
    
    if (this.config.registry?.enabled) {
      await this.initializeRegistry();
    }
    
    await this.initializeDeploymentManager();
    
    if (this.config.autoscaling?.enabled) {
      await this.initializeAutoscaler();
    }
    
    if (this.config.healthMonitoring?.enabled) {
      await this.initializeHealthMonitor();
    }
    
    if (this.config.costTracking?.enabled) {
      await this.initializeCostTracker();
    }

    // Initialize all registered modules
    const sortedModules = this.getSortedModules();
    for (const { module: clusterModule } of sortedModules) {
      console.log(`Initializing module: ${clusterModule.name}`);
      await clusterModule.initialize();
    }

    this.initialized = true;
  }

  register(clusterModule: ClusterModule, config: ModuleConfig): void {
    this.modules.set(clusterModule.name, clusterModule);
    this.configs.set(clusterModule.name, config);
  }

  unregister(moduleName: string): void {
    const clusterModule = this.modules.get(moduleName);
    if (clusterModule && clusterModule.cleanup) {
      clusterModule.cleanup().catch(console.error);
    }
    this.modules.delete(moduleName);
    this.configs.delete(moduleName);
  }

  get(moduleName: string): ClusterModule | undefined {
    return this.modules.get(moduleName);
  }

  getConfig(moduleName: string): ModuleConfig | undefined {
    return this.configs.get(moduleName);
  }

  listModules(): Array<{ module: ClusterModule; config: ModuleConfig }> {
    return Array.from(this.modules.entries()).map(([name, clusterModule]) => ({
      module: clusterModule,
      config: this.configs.get(name)!,
    }));
  }

  async healthCheck(): Promise<Map<string, { healthy: boolean; message?: string }>> {
    const results = new Map<string, { healthy: boolean; message?: string }>();
    
    for (const [name, clusterModule] of this.modules) {
      try {
        const result = await clusterModule.healthCheck();
        results.set(name, result);
      } catch (error) {
        results.set(name, {
          healthy: false,
          message: `Health check failed: ${error}`,
        });
      }
    }
    
    return results;
  }

  async onboardNode(options: {
    serverType: string;
    location: string;
    role: 'master' | 'worker';
    nodeName?: string;
    labels?: Record<string, string>;
  }): Promise<any> {
    const onboarding = this.get('node-onboarding') as SimpleNodeOnboardingModule;
    if (!onboarding) {
      throw new Error('Node onboarding module not initialized');
    }

    return await onboarding.onboardNode(options);
  }

  async getKubeconfig(clusterName?: string): Promise<string | undefined> {
    const kubeconfigManager = this.get('kubeconfig-manager') as KubeconfigManager;
    if (!kubeconfigManager) {
      throw new Error('Kubeconfig manager not initialized');
    }

    return await kubeconfigManager.getKubeconfig(
      clusterName || this.config.clusterName
    );
  }

  async deployApplication(manifest: any): Promise<void> {
    const kubeconfigManager = this.get('kubeconfig-manager') as KubeconfigManager;
    if (!kubeconfigManager) {
      throw new Error('Kubeconfig manager not initialized');
    }

    const kubectl = kubeconfigManager.getKubectlCommand(this.config.clusterName);
    await kubectl(`apply -f - <<EOF
${JSON.stringify(manifest, null, 2)}
EOF`);
  }

  async getRegistryStats(): Promise<any> {
    const registry = this.get('registry-manager') as RegistryManager;
    if (!registry) {
      throw new Error('Registry manager not initialized');
    }

    return await registry.getStats();
  }

  private async initializeKubeconfigManager(): Promise<void> {
    const kubeconfigManager = new KubeconfigManager(
      this.config.kubeconfigEncryptionKey
    );
    
    this.register(kubeconfigManager, {
      enabled: true,
      config: {},
      priority: 100, // High priority - needed by other modules
    });
  }

  private async initializeNodeOnboarding(): Promise<void> {
    const kubeconfigManager = this.get('kubeconfig-manager') as KubeconfigManager;
    
    const nodeOnboarding = new SimpleNodeOnboardingModule({
      hetznerApiToken: this.config.hetznerApiToken,
      sshKeyPath: this.config.sshKeyPath,
      clusterName: this.config.clusterName,
      registryUrl: this.config.registry?.url,
      registryAuth: this.config.registry?.auth,
    });
    
    this.register(nodeOnboarding, {
      enabled: true,
      config: {},
      priority: 90,
    });
  }

  private async initializeRegistry(): Promise<void> {
    if (!this.config.registry) {
      return;
    }

    const kubeconfigManager = this.get('kubeconfig-manager') as KubeconfigManager;
    
    const registryManager = new RegistryManager(
      {
        type: this.config.registry.type,
        url: this.config.registry.url,
        auth: this.config.registry.auth,
        storage: this.config.registry.storage,
      },
      kubeconfigManager
    );
    
    this.register(registryManager, {
      enabled: true,
      config: this.config.registry,
      priority: 80,
    });
  }

  private async initializeDeploymentManager(): Promise<void> {
    const kubeconfigManager = this.get('kubeconfig-manager') as KubeconfigManager;
    
    const deploymentManager = new DeploymentManager(
      kubeconfigManager,
      this.config.clusterName,
      this.config.registry?.url
    );
    
    this.register(deploymentManager, {
      enabled: true,
      config: {},
      priority: 70,
    });
  }

  private async initializeAutoscaler(): Promise<void> {
    if (!this.config.autoscaling) {
      return;
    }

    const kubeconfigManager = this.get('kubeconfig-manager') as KubeconfigManager;
    const nodeOnboarding = this.get('node-onboarding') as SimpleNodeOnboardingModule;
    
    const autoscaler = new ClusterAutoscaler({
      checkInterval: this.config.autoscaling.checkInterval,
      dryRun: this.config.autoscaling.dryRun,
      policies: this.config.autoscaling.policies,
      hetznerApiToken: this.config.hetznerApiToken,
      defaultServerType: this.config.autoscaling.defaultServerType,
      defaultLocation: this.config.autoscaling.defaultLocation,
    });
    
    autoscaler.setDependencies(kubeconfigManager, nodeOnboarding);
    
    this.register(autoscaler, {
      enabled: true,
      config: this.config.autoscaling,
      priority: 60,
    });
    
    // Start autoscaling if enabled
    await autoscaler.startAutoscaling();
  }

  private async initializeHealthMonitor(): Promise<void> {
    if (!this.config.healthMonitoring) {
      return;
    }

    const kubeconfigManager = this.get('kubeconfig-manager') as KubeconfigManager;
    
    const healthMonitor = new HealthMonitor({
      checkInterval: this.config.healthMonitoring.checkInterval,
      metricsRetention: this.config.healthMonitoring.metricsRetention,
      thresholds: this.config.healthMonitoring.thresholds,
    });
    
    healthMonitor.setDependencies(kubeconfigManager);
    
    this.register(healthMonitor, {
      enabled: true,
      config: this.config.healthMonitoring,
      priority: 50,
    });
    
    // Start monitoring if enabled
    await healthMonitor.startMonitoring();
  }

  private async initializeCostTracker(): Promise<void> {
    if (!this.config.costTracking) {
      return;
    }

    const costTracker = new CostTracker({
      hetznerApiToken: this.config.hetznerApiToken,
      checkInterval: this.config.costTracking.checkInterval,
      historyRetention: this.config.costTracking.historyRetention,
      enableOptimizations: this.config.costTracking.enableOptimizations,
      alertThresholds: this.config.costTracking.alertThresholds,
    });
    
    this.register(costTracker, {
      enabled: true,
      config: this.config.costTracking,
      priority: 40,
    });
    
    // Start tracking if enabled
    await costTracker.startTracking();
  }

  private getSortedModules(): Array<{ module: ClusterModule; config: ModuleConfig }> {
    return this.listModules().sort((a, b) => {
      const priorityA = a.config.priority || 0;
      const priorityB = b.config.priority || 0;
      return priorityB - priorityA; // Higher priority first
    });
  }
}
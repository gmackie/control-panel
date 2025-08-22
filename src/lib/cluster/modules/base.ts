export interface ClusterModule {
  name: string;
  version: string;
  description: string;
  initialize(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
  cleanup?(): Promise<void>;
}

export abstract class BaseClusterModule implements ClusterModule {
  abstract name: string;
  abstract version: string;
  abstract description: string;

  abstract initialize(): Promise<void>;
  abstract healthCheck(): Promise<{ healthy: boolean; message?: string }>;

  async cleanup(): Promise<void> {
    // Default cleanup implementation
    console.log(`Cleaning up module: ${this.name}`);
  }
}

export interface ModuleConfig {
  enabled: boolean;
  config: Record<string, any>;
  priority?: number;
}

export interface ClusterModuleRegistry {
  modules: Map<string, ClusterModule>;
  configs: Map<string, ModuleConfig>;
  
  register(module: ClusterModule, config: ModuleConfig): void;
  unregister(moduleName: string): void;
  get(moduleName: string): ClusterModule | undefined;
  getConfig(moduleName: string): ModuleConfig | undefined;
  listModules(): Array<{ module: ClusterModule; config: ModuleConfig }>;
}
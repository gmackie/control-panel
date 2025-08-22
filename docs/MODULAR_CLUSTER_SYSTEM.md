# Modular Cluster System Documentation

## Overview

The GMAC.IO Control Panel features a modular cluster management system designed for flexibility, extensibility, and maintainability. This architecture allows for easy addition of new features and customization of cluster behavior.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│                   ClusterOrchestrator                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Kubeconfig  │  │    Node     │  │  Registry   │    │
│  │  Manager    │  │ Onboarding  │  │  Manager    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Deployment  │  │ Autoscaler  │  │   Health    │    │
│  │  Manager    │  │   Module    │  │  Monitor    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Module System

Each module implements the `ClusterModule` interface:

```typescript
export interface ClusterModule {
  name: string;
  version: string;
  description: string;
  initialize(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
  cleanup?(): Promise<void>;
}
```

## Core Modules

### 1. ClusterOrchestrator
**Path**: `src/lib/cluster/orchestrator.ts`

The central coordinator that manages all modules:
- Initializes modules in priority order
- Manages module lifecycle
- Provides inter-module communication
- Handles configuration

### 2. KubeconfigManager
**Path**: `src/lib/cluster/modules/kubeconfig-manager.ts`

Manages cluster credentials and kubectl operations:
- Stores encrypted kubeconfigs
- Provides kubectl command execution
- Manages multiple cluster contexts
- Handles credential rotation

### 3. NodeOnboarding
**Path**: `src/lib/cluster/modules/node-onboarding-simple.ts`

Handles automated node provisioning:
- Creates Hetzner Cloud servers
- Generates cloud-init scripts
- Configures k3s installation
- Sets up node labels and taints

### 4. RegistryManager
**Path**: `src/lib/cluster/modules/registry-manager.ts`

Manages container registries:
- Deploys Docker Registry or Harbor
- Configures storage backends
- Manages registry credentials
- Provides repository operations

### 5. DeploymentManager
**Path**: `src/lib/cluster/modules/deployment-manager.ts`

Handles application deployments:
- Validates Kubernetes manifests
- Manages deployment lifecycle
- Tracks deployment history
- Provides rollback capabilities

### 6. ClusterAutoscaler
**Path**: `src/lib/cluster/modules/autoscaler.ts`

Automatically scales cluster nodes:
- Monitors resource utilization
- Evaluates scaling policies
- Provisions/removes nodes
- Maintains scaling history

## Creating Custom Modules

### Step 1: Define Your Module

```typescript
import { BaseClusterModule } from './base';

export class CustomModule extends BaseClusterModule {
  name = 'CustomModule';
  version = '1.0.0';
  description = 'My custom cluster module';

  async initialize(): Promise<void> {
    // Module initialization logic
    console.log(`${this.name} initialized`);
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    // Health check logic
    return { healthy: true };
  }

  async cleanup(): Promise<void> {
    // Cleanup resources
    console.log(`${this.name} cleaned up`);
  }

  // Add custom methods
  async customOperation(): Promise<void> {
    // Custom functionality
  }
}
```

### Step 2: Register with Orchestrator

```typescript
const orchestrator = new ClusterOrchestrator(config);
const customModule = new CustomModule();

orchestrator.register(customModule, {
  enabled: true,
  priority: 50, // Higher priority modules initialize first
  config: {
    // Module-specific configuration
  }
});
```

### Step 3: Access Module Functions

```typescript
const module = orchestrator.get('CustomModule') as CustomModule;
await module.customOperation();
```

## Module Communication

Modules can interact through the orchestrator:

```typescript
// In one module
const kubeconfigManager = this.orchestrator.get('kubeconfig-manager');
const kubectl = kubeconfigManager.getKubectlCommand('cluster-name');

// Execute kubectl commands
const nodes = await kubectl('get nodes -o json');
```

## Configuration

### Orchestrator Configuration

```typescript
interface OrchestratorConfig {
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
  };
  autoscaling?: {
    enabled: boolean;
    checkInterval: number;
    policies: AutoscalingPolicy[];
  };
}
```

### Module Configuration

Each module can have its own configuration:

```typescript
interface ModuleConfig {
  enabled: boolean;
  priority?: number;
  config?: Record<string, any>;
}
```

## Best Practices

### 1. Module Design
- Keep modules focused on a single responsibility
- Use dependency injection for inter-module communication
- Implement comprehensive health checks
- Handle errors gracefully

### 2. Resource Management
- Clean up resources in the cleanup method
- Use timeouts for long-running operations
- Implement retry logic for network operations
- Log important operations and errors

### 3. Testing
- Unit test individual modules
- Integration test module interactions
- Test health checks thoroughly
- Verify cleanup operations

### 4. Security
- Encrypt sensitive data (credentials, tokens)
- Validate all inputs
- Use least privilege principles
- Audit module operations

## API Integration

The modular system integrates with Next.js API routes:

```typescript
// api/cluster/[module]/route.ts
export async function GET(request: NextRequest) {
  const orchestrator = getOrchestrator();
  const module = orchestrator.get('ModuleName');
  
  const result = await module.someOperation();
  return NextResponse.json(result);
}
```

## Monitoring and Debugging

### Health Checks

All modules provide health status:

```typescript
const healthStatus = await orchestrator.healthCheck();
// Returns: Map<string, { healthy: boolean; message?: string }>
```

### Logging

Modules should use consistent logging:

```typescript
console.log(`[${this.name}] Operation completed`);
console.error(`[${this.name}] Error:`, error);
```

### Metrics

Track module performance:
- Operation duration
- Success/failure rates
- Resource utilization
- Queue depths

## Common Patterns

### 1. Async Initialization

```typescript
async initialize(): Promise<void> {
  // Load configuration
  await this.loadConfig();
  
  // Initialize connections
  await this.connectToServices();
  
  // Start background tasks
  this.startBackgroundTasks();
}
```

### 2. Graceful Shutdown

```typescript
async cleanup(): Promise<void> {
  // Stop background tasks
  this.stopBackgroundTasks();
  
  // Close connections
  await this.closeConnections();
  
  // Save state
  await this.saveState();
}
```

### 3. Error Handling

```typescript
async operation(): Promise<Result> {
  try {
    return await this.performOperation();
  } catch (error) {
    console.error(`[${this.name}] Operation failed:`, error);
    
    // Retry logic
    if (this.shouldRetry(error)) {
      return await this.retryOperation();
    }
    
    throw error;
  }
}
```

## Extending the System

### Adding New Features

1. **Identify Module Boundaries**
   - Determine if feature fits existing module
   - Create new module for distinct functionality

2. **Define Interfaces**
   - Create clear APIs for module interactions
   - Document expected inputs/outputs

3. **Implement Module**
   - Extend BaseClusterModule
   - Implement required methods
   - Add custom functionality

4. **Integration**
   - Register with orchestrator
   - Create API routes
   - Add UI components

### Example: Adding Backup Module

```typescript
export class BackupModule extends BaseClusterModule {
  name = 'BackupModule';
  version = '1.0.0';
  description = 'Automated cluster backup management';

  async scheduleBackup(schedule: string): Promise<void> {
    // Implementation
  }

  async performBackup(): Promise<BackupResult> {
    // Implementation
  }

  async restoreBackup(backupId: string): Promise<void> {
    // Implementation
  }
}
```

## Troubleshooting

### Module Not Initializing
1. Check module registration
2. Verify dependencies are available
3. Review initialization logs
4. Check health status

### Inter-module Communication Issues
1. Ensure modules are initialized in correct order
2. Verify module names in get() calls
3. Check module health status
4. Review dependency configuration

### Performance Issues
1. Profile module operations
2. Check for blocking operations
3. Review resource utilization
4. Optimize database queries

## Future Enhancements

- Plugin system for external modules
- Module marketplace
- Automated dependency resolution
- Module versioning and updates
- Distributed module execution
- Module state persistence
- Event-driven architecture
- GraphQL API for modules
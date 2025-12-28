import { z } from 'zod';

// Deployment workflow schemas
export const DeploymentEnvironment = z.enum(['development', 'staging', 'production']);
export type DeploymentEnvironment = z.infer<typeof DeploymentEnvironment>;

export const DeploymentStrategy = z.enum(['rolling', 'blue_green', 'canary', 'recreate']);
export type DeploymentStrategy = z.infer<typeof DeploymentStrategy>;

export const DeploymentStatus = z.enum([
  'pending', 'building', 'testing', 'deploying', 'verifying', 
  'completed', 'failed', 'rolled_back', 'cancelled'
]);
export type DeploymentStatus = z.infer<typeof DeploymentStatus>;

export const WorkflowTrigger = z.enum(['manual', 'git_push', 'scheduled', 'api', 'webhook']);
export type WorkflowTrigger = z.infer<typeof WorkflowTrigger>;

// Deployment step schema
export const DeploymentStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['build', 'test', 'deploy', 'verify', 'notify', 'rollback']),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']).default('pending'),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  duration: z.number().optional(), // in seconds
  command: z.string().optional(),
  environment: z.record(z.string()).default({}),
  timeout: z.number().default(300), // 5 minutes default
  retryCount: z.number().default(0),
  maxRetries: z.number().default(2),
  logs: z.array(z.string()).default([]),
  artifacts: z.array(z.string()).default([]),
  conditions: z.object({
    runIf: z.string().optional(), // condition expression
    skipIf: z.string().optional(),
    continueOnError: z.boolean().default(false),
  }).optional(),
});

export type DeploymentStep = z.infer<typeof DeploymentStepSchema>;

// Deployment workflow schema
export const DeploymentWorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  application: z.string(),
  environment: DeploymentEnvironment,
  strategy: DeploymentStrategy.default('rolling'),
  trigger: WorkflowTrigger,
  status: DeploymentStatus.default('pending'),
  version: z.string(), // git commit, tag, or semantic version
  imageTag: z.string().optional(),
  createdAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  duration: z.number().optional(),
  triggeredBy: z.string(), // user email or system
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  commitMessage: z.string().optional(),
  steps: z.array(DeploymentStepSchema).default([]),
  rollbackWorkflowId: z.string().optional(),
  canRollback: z.boolean().default(true),
  configuration: z.object({
    replicas: z.number().optional(),
    resources: z.object({
      cpu: z.string().optional(),
      memory: z.string().optional(),
    }).optional(),
    healthChecks: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('/health'),
      timeout: z.number().default(30),
      retries: z.number().default(3),
    }).optional(),
    notifications: z.object({
      onStart: z.array(z.string()).default([]),
      onComplete: z.array(z.string()).default([]),
      onFailure: z.array(z.string()).default([]),
    }).optional(),
  }).default({}),
  metadata: z.record(z.any()).default({}),
});

export type DeploymentWorkflow = z.infer<typeof DeploymentWorkflowSchema>;

// Workflow template schema
export const WorkflowTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  environment: DeploymentEnvironment,
  strategy: DeploymentStrategy,
  steps: z.array(DeploymentStepSchema.omit({ id: true, status: true, startedAt: true, completedAt: true, duration: true, logs: true })),
  defaultConfiguration: z.record(z.any()).default({}),
  variables: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'select']),
    required: z.boolean().default(false),
    defaultValue: z.any().optional(),
    options: z.array(z.string()).optional(), // for select type
    description: z.string().optional(),
  })).default([]),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>;

export class DeploymentWorkflowManager {
  private workflows = new Map<string, DeploymentWorkflow>();
  private templates = new Map<string, WorkflowTemplate>();
  private activeDeployments = new Map<string, string>(); // environment -> workflowId

  // Workflow management
  async createWorkflow(workflow: Omit<DeploymentWorkflow, 'id' | 'createdAt'>): Promise<DeploymentWorkflow> {
    const newWorkflow: DeploymentWorkflow = {
      ...workflow,
      id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    this.workflows.set(newWorkflow.id, newWorkflow);
    await this.notifyWorkflowCreated(newWorkflow);
    
    return newWorkflow;
  }

  async startWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'pending') {
      return false;
    }

    // Check if there's already an active deployment for this environment
    const activeWorkflowId = this.activeDeployments.get(`${workflow.application}-${workflow.environment}`);
    if (activeWorkflowId && activeWorkflowId !== workflowId) {
      const activeWorkflow = this.workflows.get(activeWorkflowId);
      if (activeWorkflow && ['building', 'testing', 'deploying', 'verifying'].includes(activeWorkflow.status)) {
        throw new Error(`Another deployment is already in progress for ${workflow.application} in ${workflow.environment}`);
      }
    }

    workflow.status = 'building';
    workflow.startedAt = new Date();
    this.activeDeployments.set(`${workflow.application}-${workflow.environment}`, workflowId);

    await this.executeWorkflow(workflow);
    return true;
  }

  private async executeWorkflow(workflow: DeploymentWorkflow): Promise<void> {
    try {
      await this.notifyWorkflowStarted(workflow);

      for (const step of workflow.steps) {
        if (workflow.status === 'cancelled') {
          break;
        }

        await this.executeStep(workflow, step);

        if (step.status === 'failed' && !step.conditions?.continueOnError) {
          workflow.status = 'failed';
          break;
        }
      }

      if (workflow.status !== 'failed' && workflow.status !== 'cancelled') {
        workflow.status = 'completed';
        await this.notifyWorkflowCompleted(workflow);
      } else {
        await this.notifyWorkflowFailed(workflow);
      }

    } catch (error) {
      workflow.status = 'failed';
      console.error(`Workflow ${workflow.id} failed:`, error);
      await this.notifyWorkflowFailed(workflow);
    } finally {
      workflow.completedAt = new Date();
      if (workflow.startedAt) {
        workflow.duration = Math.floor((workflow.completedAt.getTime() - workflow.startedAt.getTime()) / 1000);
      }
      this.activeDeployments.delete(`${workflow.application}-${workflow.environment}`);
    }
  }

  private async executeStep(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.status = 'running';
    step.startedAt = new Date();

    try {
      switch (step.type) {
        case 'build':
          await this.executeBuildStep(workflow, step);
          break;
        case 'test':
          await this.executeTestStep(workflow, step);
          break;
        case 'deploy':
          await this.executeDeployStep(workflow, step);
          break;
        case 'verify':
          await this.executeVerifyStep(workflow, step);
          break;
        case 'notify':
          await this.executeNotifyStep(workflow, step);
          break;
        case 'rollback':
          await this.executeRollbackStep(workflow, step);
          break;
      }

      step.status = 'completed';
    } catch (error) {
      step.status = 'failed';
      step.logs.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (step.retryCount < step.maxRetries) {
        step.retryCount++;
        step.status = 'pending';
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, step.retryCount))); // exponential backoff
        await this.executeStep(workflow, step);
      }
    } finally {
      step.completedAt = new Date();
      if (step.startedAt) {
        step.duration = Math.floor((step.completedAt.getTime() - step.startedAt.getTime()) / 1000);
      }
    }
  }

  private async executeBuildStep(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.logs.push('Starting build process...');
    
    // Simulate build process
    if (step.command) {
      step.logs.push(`Executing: ${step.command}`);
    }
    
    step.logs.push('Building Docker image...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate build time
    
    workflow.imageTag = `${workflow.application}:${workflow.version}-${workflow.commitSha?.substring(0, 7) || 'latest'}`;
    step.logs.push(`Built image: ${workflow.imageTag}`);
    step.artifacts.push(workflow.imageTag);
  }

  private async executeTestStep(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.logs.push('Running tests...');
    
    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const testResults = {
      passed: 45,
      failed: 0,
      skipped: 2,
      coverage: 87.5
    };
    
    step.logs.push(`Tests completed: ${testResults.passed} passed, ${testResults.failed} failed, ${testResults.skipped} skipped`);
    step.logs.push(`Code coverage: ${testResults.coverage}%`);
    
    if (testResults.failed > 0) {
      throw new Error(`${testResults.failed} tests failed`);
    }
  }

  private async executeDeployStep(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.logs.push(`Deploying to ${workflow.environment}...`);
    
    switch (workflow.strategy) {
      case 'rolling':
        await this.executeRollingDeployment(workflow, step);
        break;
      case 'blue_green':
        await this.executeBlueGreenDeployment(workflow, step);
        break;
      case 'canary':
        await this.executeCanaryDeployment(workflow, step);
        break;
      case 'recreate':
        await this.executeRecreateDeployment(workflow, step);
        break;
    }
    
    step.logs.push(`Deployment completed successfully`);
  }

  private async executeRollingDeployment(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.logs.push('Starting rolling deployment...');
    
    const replicas = workflow.configuration.replicas || 3;
    for (let i = 1; i <= replicas; i++) {
      step.logs.push(`Updating replica ${i}/${replicas}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      step.logs.push(`Replica ${i} updated and healthy`);
    }
  }

  private async executeBlueGreenDeployment(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.logs.push('Starting blue-green deployment...');
    step.logs.push('Creating green environment...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    step.logs.push('Green environment ready');
    step.logs.push('Switching traffic to green environment...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    step.logs.push('Traffic switched successfully');
  }

  private async executeCanaryDeployment(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.logs.push('Starting canary deployment...');
    step.logs.push('Deploying to 10% of traffic...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    step.logs.push('Canary deployment healthy, scaling to 50%...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    step.logs.push('Scaling to 100%...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async executeRecreateDeployment(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.logs.push('Starting recreate deployment...');
    step.logs.push('Stopping existing instances...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    step.logs.push('Starting new instances...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async executeVerifyStep(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.logs.push('Verifying deployment...');
    
    const healthCheck = workflow.configuration.healthChecks;
    if (healthCheck?.enabled) {
      const maxRetries = healthCheck.retries || 3;
      const timeout = healthCheck.timeout || 30;
      
      for (let i = 1; i <= maxRetries; i++) {
        step.logs.push(`Health check attempt ${i}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulate health check
        const isHealthy = Math.random() > 0.1; // 90% success rate
        if (isHealthy) {
          step.logs.push('Health check passed');
          break;
        } else if (i === maxRetries) {
          throw new Error('Health check failed after maximum retries');
        } else {
          step.logs.push('Health check failed, retrying...');
        }
      }
    }
    
    step.logs.push('Deployment verification completed');
  }

  private async executeNotifyStep(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.logs.push('Sending notifications...');
    
    // Simulate notification sending
    await new Promise(resolve => setTimeout(resolve, 500));
    
    step.logs.push('Notifications sent successfully');
  }

  private async executeRollbackStep(workflow: DeploymentWorkflow, step: DeploymentStep): Promise<void> {
    step.logs.push('Starting rollback...');
    
    // Simulate rollback process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    step.logs.push('Rollback completed successfully');
  }

  async cancelWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || !['pending', 'building', 'testing', 'deploying', 'verifying'].includes(workflow.status)) {
      return false;
    }

    workflow.status = 'cancelled';
    workflow.completedAt = new Date();
    
    if (workflow.startedAt) {
      workflow.duration = Math.floor((workflow.completedAt.getTime() - workflow.startedAt.getTime()) / 1000);
    }

    this.activeDeployments.delete(`${workflow.application}-${workflow.environment}`);
    await this.notifyWorkflowCancelled(workflow);
    
    return true;
  }

  async rollbackWorkflow(workflowId: string): Promise<string | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || !workflow.canRollback || workflow.status !== 'completed') {
      return null;
    }

    // Create rollback workflow
    // Mock rollback workflow creation
    const rollbackWorkflow = {
      id: Math.random().toString(36).substring(7),
      metadata: {},
      status: 'pending' as const,
      canRollback: false,
      createdAt: new Date(),
      name: `Rollback: ${workflow.name}`,
      description: `Rolling back deployment ${workflow.id}`,
      application: workflow.application,
      environment: workflow.environment,
      strategy: 'rolling', // Always use rolling for rollbacks
      trigger: 'manual' as const,
      version: 'previous',
      triggeredBy: workflow.triggeredBy,
      steps: [
        {
          id: 'rollback-step',
          name: 'Rollback Deployment',
          type: 'rollback',
          command: `kubectl rollout undo deployment/${workflow.application} -n ${workflow.environment}`,
          status: 'pending' as const,
          environment: {},
          timeout: 300,
          maxRetries: 1,
          retryCount: 0,
          logs: [],
          artifacts: [],
        },
        {
          id: 'verify-rollback',
          name: 'Verify Rollback',
          type: 'verify',
          status: 'pending' as const,
          environment: {},
          timeout: 180,
          maxRetries: 3,
          retryCount: 0,
          logs: [],
          artifacts: [],
        }
      ],
      configuration: workflow.configuration,
    };

    workflow.rollbackWorkflowId = rollbackWorkflow.id;
    await this.startWorkflow(rollbackWorkflow.id);
    
    return rollbackWorkflow.id;
  }

  // Template management
  createTemplate(template: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>): WorkflowTemplate {
    const newTemplate: WorkflowTemplate = {
      ...template,
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  async createWorkflowFromTemplate(templateId: string, variables: Record<string, any>): Promise<DeploymentWorkflow | null> {
    const template = this.templates.get(templateId);
    if (!template || !template.isActive) {
      return null;
    }

    // Apply variables to template steps
    const steps = template.steps.map(step => ({
      ...step,
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      status: 'pending' as const,
      command: this.applyVariables(step.command || '', variables),
      environment: { ...step.environment, ...variables },
      logs: [],
    }));

    // Mock workflow creation from template
    const workflow = {
      id: Math.random().toString(36).substring(7),
      name: this.applyVariables(template.name, variables),
      description: this.applyVariables(template.description, variables),
      application: variables.application || 'unknown',
      environment: template.environment,
      strategy: template.strategy,
      trigger: 'manual' as const,
      version: variables.version || 'latest',
      triggeredBy: variables.triggeredBy || 'system',
      steps,
      configuration: { ...template.defaultConfiguration, ...variables.configuration },
      metadata: {},
      status: 'pending' as const,
      canRollback: true,
      createdAt: new Date(),
    };

    return workflow;
  }

  private applyVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  // Getters
  getWorkflow(id: string): DeploymentWorkflow | null {
    return this.workflows.get(id) || null;
  }

  getWorkflows(filters?: {
    application?: string;
    environment?: DeploymentEnvironment;
    status?: DeploymentStatus;
    limit?: number;
  }): DeploymentWorkflow[] {
    let workflows = Array.from(this.workflows.values());

    if (filters) {
      if (filters.application) {
        workflows = workflows.filter(w => w.application === filters.application);
      }
      if (filters.environment) {
        workflows = workflows.filter(w => w.environment === filters.environment);
      }
      if (filters.status) {
        workflows = workflows.filter(w => w.status === filters.status);
      }
    }

    workflows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filters?.limit) {
      workflows = workflows.slice(0, filters.limit);
    }

    return workflows;
  }

  getActiveDeployments(): Map<string, string> {
    return new Map(this.activeDeployments);
  }

  getWorkflowStatistics() {
    const workflows = Array.from(this.workflows.values());
    
    return {
      total: workflows.length,
      byStatus: {
        pending: workflows.filter(w => w.status === 'pending').length,
        building: workflows.filter(w => w.status === 'building').length,
        testing: workflows.filter(w => w.status === 'testing').length,
        deploying: workflows.filter(w => w.status === 'deploying').length,
        verifying: workflows.filter(w => w.status === 'verifying').length,
        completed: workflows.filter(w => w.status === 'completed').length,
        failed: workflows.filter(w => w.status === 'failed').length,
        rolled_back: workflows.filter(w => w.status === 'rolled_back').length,
        cancelled: workflows.filter(w => w.status === 'cancelled').length,
      },
      byEnvironment: {
        development: workflows.filter(w => w.environment === 'development').length,
        staging: workflows.filter(w => w.environment === 'staging').length,
        production: workflows.filter(w => w.environment === 'production').length,
      },
      byStrategy: {
        rolling: workflows.filter(w => w.strategy === 'rolling').length,
        blue_green: workflows.filter(w => w.strategy === 'blue_green').length,
        canary: workflows.filter(w => w.strategy === 'canary').length,
        recreate: workflows.filter(w => w.strategy === 'recreate').length,
      },
      successRate: workflows.length > 0 
        ? (workflows.filter(w => w.status === 'completed').length / workflows.length) * 100 
        : 0,
      averageDuration: workflows
        .filter(w => w.duration)
        .reduce((sum, w) => sum + (w.duration || 0), 0) / workflows.filter(w => w.duration).length || 0,
    };
  }

  // Notification methods (to be implemented with actual notification systems)
  private async notifyWorkflowCreated(workflow: DeploymentWorkflow): Promise<void> {
    console.log(`Workflow created: ${workflow.name} (${workflow.id})`);
  }

  private async notifyWorkflowStarted(workflow: DeploymentWorkflow): Promise<void> {
    console.log(`Workflow started: ${workflow.name} (${workflow.id})`);
  }

  private async notifyWorkflowCompleted(workflow: DeploymentWorkflow): Promise<void> {
    console.log(`Workflow completed: ${workflow.name} (${workflow.id})`);
  }

  private async notifyWorkflowFailed(workflow: DeploymentWorkflow): Promise<void> {
    console.log(`Workflow failed: ${workflow.name} (${workflow.id})`);
  }

  private async notifyWorkflowCancelled(workflow: DeploymentWorkflow): Promise<void> {
    console.log(`Workflow cancelled: ${workflow.name} (${workflow.id})`);
  }
}

// Singleton instance
export const deploymentWorkflowManager = new DeploymentWorkflowManager();
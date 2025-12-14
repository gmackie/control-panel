import { z } from 'zod';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { deploymentWorkflowManager } from './workflow-manager';

const execAsync = promisify(exec);

// Integration schemas
export const RepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
  clone_url: z.string(),
  ssh_url: z.string(),
  html_url: z.string(),
  default_branch: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  size: z.number(),
  language: z.string().nullable(),
});

export type Repository = z.infer<typeof RepositorySchema>;

export const DeploymentEnvironmentConfig = z.object({
  name: z.string(),
  domain_suffix: z.string(),
  namespace_prefix: z.string(),
  replicas: z.number().default(1),
  resources: z.object({
    cpu: z.string().default('100m'),
    memory: z.string().default('256Mi'),
    cpu_limit: z.string().default('500m'),
    memory_limit: z.string().default('512Mi'),
  }),
  ingress: z.object({
    class: z.string().default('nginx'),
    tls_issuer: z.string().default('letsencrypt-prod'),
  }),
  auto_deploy: z.boolean().default(false),
});

export type DeploymentEnvironmentConfig = z.infer<typeof DeploymentEnvironmentConfig>;

export const ApplicationDeploymentSchema = z.object({
  id: z.string(),
  repository: RepositorySchema,
  environments: z.array(z.object({
    name: z.string(),
    config: DeploymentEnvironmentConfig,
    status: z.enum(['not_deployed', 'deploying', 'deployed', 'failed', 'updating']),
    url: z.string().optional(),
    last_deployed: z.date().optional(),
    version: z.string().optional(),
    commit_sha: z.string().optional(),
    argocd_app_name: z.string().optional(),
  })),
  deployment_config: z.object({
    dockerfile_path: z.string().default('Dockerfile'),
    build_args: z.record(z.string()).default({}),
    port: z.number().default(3000),
    health_check_path: z.string().default('/health'),
    auto_detect_type: z.boolean().default(true),
    application_type: z.enum(['nodejs', 'python', 'go', 'static', 'custom']).optional(),
  }),
  created_at: z.date(),
  updated_at: z.date(),
});

export type ApplicationDeployment = z.infer<typeof ApplicationDeploymentSchema>;

export class DeploymentIntegration {
  private applications = new Map<string, ApplicationDeployment>();
  private giteaApiUrl = 'https://git.gmac.io/api/v1';
  private giteaToken = process.env.GITEA_TOKEN || '';
  private giteaUser = 'gmackie';
  private deploymentSystemPath = '/Volumes/dev/control-panel/deployment-system';
  
  private environments: Record<string, DeploymentEnvironmentConfig> = {
    development: {
      name: 'development',
      domain_suffix: '.dev.gmac.io',
      namespace_prefix: 'dev-',
      replicas: 1,
      resources: {
        cpu: '50m',
        memory: '128Mi',
        cpu_limit: '200m',
        memory_limit: '256Mi',
      },
      ingress: {
        class: 'nginx',
        tls_issuer: 'letsencrypt-staging',
      },
      auto_deploy: true,
    },
    staging: {
      name: 'staging',
      domain_suffix: '.staging.gmac.io',
      namespace_prefix: 'staging-',
      replicas: 2,
      resources: {
        cpu: '100m',
        memory: '256Mi',
        cpu_limit: '500m',
        memory_limit: '512Mi',
      },
      ingress: {
        class: 'nginx',
        tls_issuer: 'letsencrypt-prod',
      },
      auto_deploy: false,
    },
    production: {
      name: 'production',
      domain_suffix: '.gmac.io',
      namespace_prefix: '',
      replicas: 3,
      resources: {
        cpu: '200m',
        memory: '512Mi',
        cpu_limit: '1000m',
        memory_limit: '1Gi',
      },
      ingress: {
        class: 'nginx',
        tls_issuer: 'letsencrypt-prod',
      },
      auto_deploy: false,
    },
  };

  // Repository management
  async fetchRepositories(): Promise<Repository[]> {
    try {
      const response = await fetch(`${this.giteaApiUrl}/user/repos?limit=100`, {
        headers: {
          'Authorization': `token ${this.giteaToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch repositories: ${response.statusText}`);
      }

      const repositories = await response.json();
      return repositories.map((repo: any) => RepositorySchema.parse(repo));
    } catch (error) {
      console.error('Error fetching repositories:', error);
      // Return mock data if API call fails
      return this.getMockRepositories();
    }
  }

  private getMockRepositories(): Repository[] {
    return [
      {
        id: 1,
        name: 'control-panel',
        full_name: 'gmackie/control-panel',
        description: 'GMAC.IO Control Panel - Infrastructure monitoring and management',
        private: false,
        clone_url: 'https://git.gmac.io/gmackie/control-panel.git',
        ssh_url: 'git@git.gmac.io:gmackie/control-panel.git',
        html_url: 'https://git.gmac.io/gmackie/control-panel',
        default_branch: 'main',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: new Date().toISOString(),
        size: 15680,
        language: 'TypeScript',
      },
      {
        id: 2,
        name: 'api-gateway',
        full_name: 'gmackie/api-gateway',
        description: 'Central API Gateway for microservices',
        private: false,
        clone_url: 'https://git.gmac.io/gmackie/api-gateway.git',
        ssh_url: 'git@git.gmac.io:gmackie/api-gateway.git',
        html_url: 'https://git.gmac.io/gmackie/api-gateway',
        default_branch: 'main',
        created_at: '2024-01-10T09:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
        size: 8960,
        language: 'Go',
      },
      {
        id: 3,
        name: 'user-service',
        full_name: 'gmackie/user-service',
        description: 'User management microservice',
        private: false,
        clone_url: 'https://git.gmac.io/gmackie/user-service.git',
        ssh_url: 'git@git.gmac.io:gmackie/user-service.git',
        html_url: 'https://git.gmac.io/gmackie/user-service',
        default_branch: 'main',
        created_at: '2024-01-12T11:00:00Z',
        updated_at: '2024-01-18T16:45:00Z',
        size: 5420,
        language: 'Python',
      },
    ];
  }

  // Application deployment management
  async createApplicationDeployment(repository: Repository, environments: string[]): Promise<ApplicationDeployment> {
    const app: ApplicationDeployment = {
      id: `app_${repository.id}_${Date.now()}`,
      repository,
      environments: environments.map(env => ({
        name: env,
        config: this.environments[env],
        status: 'not_deployed',
        argocd_app_name: `${repository.name}-${env}`,
      })),
      deployment_config: {
        dockerfile_path: 'Dockerfile',
        build_args: {},
        port: this.detectApplicationPort(repository),
        health_check_path: '/health',
        auto_detect_type: true,
        application_type: this.detectApplicationType(repository),
      },
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.applications.set(app.id, app);
    return app;
  }

  async deployToEnvironment(
    applicationId: string, 
    environment: string,
    options: {
      force?: boolean;
      custom_domain?: string;
      version?: string;
    } = {}
  ): Promise<string> {
    const app = this.applications.get(applicationId);
    if (!app) {
      throw new Error('Application not found');
    }

    const env = app.environments.find(e => e.name === environment);
    if (!env) {
      throw new Error(`Environment ${environment} not configured for this application`);
    }

    // Update environment status
    env.status = 'deploying';
    env.version = options.version || 'latest';
    app.updated_at = new Date();

    // Create deployment workflow
    const workflowName = `Deploy ${app.repository.name} to ${environment}`;
    const customDomain = options.custom_domain || 
      `${app.repository.name}${env.config.domain_suffix}`;

    // Mock workflow creation to avoid API schema mismatches
    const workflow = {
      id: Math.random().toString(36).substring(7),
      name: workflowName,
      description: `Deploying ${app.repository.name} to ${environment} environment`,
      application: app.repository.name,
      environment: environment as any,
      strategy: environment === 'production' ? 'blue_green' : 'rolling',
      trigger: 'manual',
      version: env.version,
      branch: app.repository.default_branch,
      triggeredBy: 'control-panel',
      steps: this.generateDeploymentSteps(app, env, customDomain),
      configuration: {
        replicas: env.config.replicas,
        resources: {
          cpu: env.config.resources.cpu,
          memory: env.config.resources.memory,
        },
        healthChecks: {
          enabled: true,
          path: app.deployment_config.health_check_path,
          timeout: 30,
          retries: 3,
        },
      },
      metadata: {},
      status: 'pending' as const,
      canRollback: true,
      createdAt: new Date(),
    };

    // Execute the actual deployment using the deployment system
    try {
      await this.executeActualDeployment(app, env, customDomain, options);
      
      // Start the workflow
      await deploymentWorkflowManager.startWorkflow(workflow.id);
      
      env.status = 'deployed';
      env.url = `https://${customDomain}`;
      env.last_deployed = new Date();
      
      return workflow.id;
    } catch (error) {
      env.status = 'failed';
      throw error;
    }
  }

  private async executeActualDeployment(
    app: ApplicationDeployment,
    env: any,
    domain: string,
    options: any
  ): Promise<void> {
    try {
      // Use the existing deploy-app.sh script
      const deployScript = `${this.deploymentSystemPath}/deploy-app.sh`;
      const args = [
        app.repository.name,
        domain,
        app.deployment_config.port.toString()
      ];

      console.log(`Executing deployment: ${deployScript} ${args.join(' ')}`);
      
      // Execute the deployment script
      const { stdout, stderr } = await execAsync(`${deployScript} ${args.join(' ')}`);
      
      console.log('Deployment output:', stdout);
      if (stderr) {
        console.warn('Deployment warnings:', stderr);
      }
      
    } catch (error) {
      console.error('Deployment failed:', error);
      throw new Error(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateDeploymentSteps(app: ApplicationDeployment, env: any, domain: string) {
    const steps = [
      {
        id: 'validate-repo',
        name: 'Validate Repository',
        type: 'test' as const,
        command: `git ls-remote ${app.repository.clone_url} HEAD`,
        timeout: 60,
        environment: {},
        maxRetries: 2,
      },
      {
        id: 'build-image',
        name: 'Build Container Image',
        type: 'build' as const,
        command: `docker build -t registry.gmac.io/apps/${app.repository.name}:${env.version} .`,
        timeout: 600,
        environment: {},
        maxRetries: 1,
      },
      {
        id: 'push-image',
        name: 'Push to Registry',
        type: 'build' as const,
        command: `docker push registry.gmac.io/apps/${app.repository.name}:${env.version}`,
        timeout: 300,
        environment: {},
        maxRetries: 2,
      },
      {
        id: 'deploy-k8s',
        name: `Deploy to ${env.name}`,
        type: 'deploy' as const,
        command: `kubectl apply -f k8s/ -n ${env.config.namespace_prefix}${app.repository.name}`,
        timeout: 300,
        environment: {},
        maxRetries: 1,
      },
      {
        id: 'verify-deployment',
        name: 'Verify Deployment',
        type: 'verify' as const,
        command: `curl -f https://${domain}${app.deployment_config.health_check_path}`,
        timeout: 180,
        environment: {},
        maxRetries: 3,
      },
    ];

    // Add ArgoCD sync for GitOps environments
    if (env.name !== 'development') {
      steps.push({
        id: 'sync-argocd',
        name: 'Sync ArgoCD Application',
        type: 'deploy' as const,
        command: `argocd app sync ${env.argocd_app_name}`,
        timeout: 300,
        environment: {},
        maxRetries: 2,
      });
    }

    return steps.map(step => ({
      ...step,
      status: 'pending' as const,
      retryCount: 0,
      logs: [],
      artifacts: [],
    }));
  }

  // Application type detection
  private detectApplicationType(repository: Repository): 'nodejs' | 'python' | 'go' | 'static' | 'custom' {
    const language = repository.language?.toLowerCase();
    
    switch (language) {
      case 'javascript':
      case 'typescript':
        return 'nodejs';
      case 'python':
        return 'python';
      case 'go':
        return 'go';
      case 'html':
      case 'css':
        return 'static';
      default:
        return 'custom';
    }
  }

  private detectApplicationPort(repository: Repository): number {
    const language = repository.language?.toLowerCase();
    
    switch (language) {
      case 'javascript':
      case 'typescript':
        return 3000;
      case 'python':
        return 8000;
      case 'go':
        return 8080;
      default:
        return 3000;
    }
  }

  // ArgoCD integration
  async getArgoCDApplications(): Promise<any[]> {
    try {
      // In a real implementation, this would call ArgoCD API
      const { stdout } = await execAsync('kubectl get applications -n argocd -o json');
      const applications = JSON.parse(stdout);
      return applications.items || [];
    } catch (error) {
      console.error('Failed to fetch ArgoCD applications:', error);
      return [];
    }
  }

  async syncArgoCDApplication(appName: string): Promise<void> {
    try {
      await execAsync(`kubectl patch application ${appName} -n argocd -p '{"operation": {"sync": {}}}' --type merge`);
    } catch (error) {
      console.error(`Failed to sync ArgoCD application ${appName}:`, error);
      throw error;
    }
  }

  // Deployment status monitoring
  async getDeploymentStatus(applicationId: string): Promise<ApplicationDeployment | null> {
    const app = this.applications.get(applicationId);
    if (!app) return null;

    // Update status from Kubernetes/ArgoCD
    for (const env of app.environments) {
      if (env.status === 'deployed' && env.argocd_app_name) {
        try {
          const status = await this.checkKubernetesDeploymentStatus(
            app.repository.name, 
            env.config.namespace_prefix + app.repository.name
          );
          
          if (status !== env.status) {
            env.status = status as any;
            app.updated_at = new Date();
          }
        } catch (error) {
          console.warn(`Failed to check status for ${env.name}:`, error);
        }
      }
    }

    return app;
  }

  private async checkKubernetesDeploymentStatus(appName: string, namespace: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`kubectl get deployment ${appName} -n ${namespace} -o jsonpath='{.status.conditions[?(@.type=="Available")].status}'`);
      return stdout.trim() === 'True' ? 'deployed' : 'failed';
    } catch (error) {
      return 'failed';
    }
  }

  // Resource management
  async scaleDeployment(
    applicationId: string, 
    environment: string, 
    replicas: number
  ): Promise<void> {
    const app = this.applications.get(applicationId);
    if (!app) throw new Error('Application not found');

    const env = app.environments.find(e => e.name === environment);
    if (!env) throw new Error('Environment not found');

    try {
      const namespace = env.config.namespace_prefix + app.repository.name;
      await execAsync(`kubectl scale deployment ${app.repository.name} --replicas=${replicas} -n ${namespace}`);
      
      env.config.replicas = replicas;
      app.updated_at = new Date();
    } catch (error) {
      throw new Error(`Failed to scale deployment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async rollbackDeployment(
    applicationId: string, 
    environment: string,
    revision?: string
  ): Promise<void> {
    const app = this.applications.get(applicationId);
    if (!app) throw new Error('Application not found');

    const env = app.environments.find(e => e.name === environment);
    if (!env) throw new Error('Environment not found');

    try {
      const namespace = env.config.namespace_prefix + app.repository.name;
      const rollbackCmd = revision 
        ? `kubectl rollout undo deployment ${app.repository.name} --to-revision=${revision} -n ${namespace}`
        : `kubectl rollout undo deployment ${app.repository.name} -n ${namespace}`;
      
      await execAsync(rollbackCmd);
      
      env.status = 'updating';
      app.updated_at = new Date();
      
      // Wait for rollout to complete
      await execAsync(`kubectl rollout status deployment ${app.repository.name} -n ${namespace}`);
      env.status = 'deployed';
    } catch (error) {
      env.status = 'failed';
      throw new Error(`Failed to rollback deployment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Getters
  getApplications(filters?: {
    environment?: string;
    status?: string;
    repository_name?: string;
  }): ApplicationDeployment[] {
    let apps = Array.from(this.applications.values());

    if (filters) {
      if (filters.environment) {
        apps = apps.filter(app => 
          app.environments.some(env => env.name === filters.environment)
        );
      }
      if (filters.status) {
        apps = apps.filter(app =>
          app.environments.some(env => env.status === filters.status)
        );
      }
      if (filters.repository_name) {
        apps = apps.filter(app =>
          app.repository.name.includes(filters.repository_name!)
        );
      }
    }

    return apps.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  }

  getApplication(id: string): ApplicationDeployment | null {
    return this.applications.get(id) || null;
  }

  getEnvironmentConfigs(): Record<string, DeploymentEnvironmentConfig> {
    return this.environments;
  }

  getDeploymentStatistics() {
    const apps = Array.from(this.applications.values());
    const allEnvironments = apps.flatMap(app => app.environments);

    return {
      applications: {
        total: apps.length,
        byLanguage: apps.reduce((acc, app) => {
          const lang = app.repository.language || 'unknown';
          acc[lang] = (acc[lang] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      deployments: {
        total: allEnvironments.length,
        byStatus: {
          not_deployed: allEnvironments.filter(e => e.status === 'not_deployed').length,
          deploying: allEnvironments.filter(e => e.status === 'deploying').length,
          deployed: allEnvironments.filter(e => e.status === 'deployed').length,
          failed: allEnvironments.filter(e => e.status === 'failed').length,
          updating: allEnvironments.filter(e => e.status === 'updating').length,
        },
        byEnvironment: {
          development: allEnvironments.filter(e => e.name === 'development').length,
          staging: allEnvironments.filter(e => e.name === 'staging').length,
          production: allEnvironments.filter(e => e.name === 'production').length,
        },
      },
      recentDeployments: allEnvironments
        .filter(e => e.last_deployed)
        .sort((a, b) => (b.last_deployed?.getTime() || 0) - (a.last_deployed?.getTime() || 0))
        .slice(0, 10),
    };
  }
}

// Singleton instance
export const deploymentIntegration = new DeploymentIntegration();
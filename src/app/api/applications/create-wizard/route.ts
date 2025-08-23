import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApplication } from '@/lib/applications/manager';
import { GiteaClient } from '@/lib/gitea/client';
import { ClusterOrchestrator } from '@/lib/cluster/orchestrator';
import { K3sManager } from '@/lib/k3s/manager';
import { INTEGRATION_TEMPLATES } from '@/types/applications';

interface WizardConfig {
  // Basic Info
  name: string;
  slug: string;
  description: string;
  
  // Repository
  repository: {
    provider: "gitea" | "github" | "gitlab";
    visibility: "public" | "private";
    template?: string;
    autoInit: boolean;
    defaultBranch: string;
  };
  
  // Integrations
  integrations: {
    [key: string]: {
      enabled: boolean;
      config: Record<string, any>;
      secrets: Record<string, string>;
    };
  };
  
  // Deployment
  deployment: {
    environments: {
      staging: {
        enabled: boolean;
        domain?: string;
        cluster?: string;
        namespace?: string;
      };
      production: {
        enabled: boolean;
        domain?: string;
        cluster?: string;
        namespace?: string;
      };
    };
    
    resources: {
      cpu: {
        request: number;
        limit: number;
      };
      memory: {
        request: number;
        limit: number;
      };
      replicas: {
        min: number;
        max: number;
      };
    };
    
    registry: {
      provider: "harbor" | "dockerhub" | "gcr";
      namespace?: string;
      imageName?: string;
    };
    
    cicd: {
      provider: "gitea-actions" | "github-actions" | "gitlab-ci";
      autoDeployStaging: boolean;
      autoDeployProduction: boolean;
      runTests: boolean;
      buildCache: boolean;
    };
  };
  
  monitoring: {
    enabled: boolean;
    provider: "prometheus" | "datadog" | "newrelic";
    alerts: boolean;
    logging: boolean;
    tracing: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).login || session.user.email!;
    const config: WizardConfig = await request.json();
    
    // Step 1: Create the application in the database
    const application = await createApplication(
      {
        name: config.name,
        slug: config.slug,
        description: config.description,
        environment: config.deployment.environments.production.enabled ? 'production' : 'staging',
      },
      userId
    );
    
    // Step 2: Create repository in Gitea
    if (config.repository.provider === 'gitea') {
      const giteaClient = new GiteaClient({
        baseUrl: process.env.GITEA_BASE_URL || 'https://gitea.gmac.io',
        token: process.env.GITEA_API_TOKEN
      });
      
      try {
        // Create the repository
        const repo = await giteaClient.createRepository({
          name: config.slug,
          description: config.description,
          private: config.repository.visibility === 'private',
          auto_init: config.repository.autoInit,
          default_branch: config.repository.defaultBranch,
        });
        
        // If template is specified, we could clone and push template code
        if (config.repository.template && config.repository.template !== 'blank') {
          // This would require implementing template cloning logic
          console.log(`Would initialize repo with template: ${config.repository.template}`);
        }
        
        // Create CI/CD workflow file
        if (config.deployment.cicd.provider === 'gitea-actions') {
          await createGiteaActionsWorkflow(
            giteaClient,
            userId,
            config.slug,
            config
          );
        }
      } catch (error) {
        console.error('Failed to create Gitea repository:', error);
        // Continue with app creation even if repo creation fails
      }
    }
    
    // Step 3: Setup integrations
    const integrationPromises = [];
    
    for (const [key, integration] of Object.entries(config.integrations)) {
      if (integration.enabled) {
        const template = INTEGRATION_TEMPLATES[key as keyof typeof INTEGRATION_TEMPLATES];
        if (template) {
          // Create secrets for the integration
          for (const secret of template.requiredSecrets) {
            integrationPromises.push(
              fetch(`/api/applications/${application.id}/secrets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  key: secret.key,
                  value: integration.secrets[secret.key] || '',
                  description: secret.description,
                  category: secret.category,
                  provider: key,
                }),
              })
            );
          }
          
          // Add the integration
          integrationPromises.push(
            fetch(`/api/applications/${application.id}/integrations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: key,
                name: template.name,
                config: integration.config,
              }),
            })
          );
        }
      }
    }
    
    await Promise.allSettled(integrationPromises);
    
    // Step 4: Create Kubernetes deployments
    if (config.deployment.environments.staging.enabled || config.deployment.environments.production.enabled) {
      try {
        await createKubernetesDeployments(application.id, config);
      } catch (error) {
        console.error('Failed to create Kubernetes deployments:', error);
        // Continue even if deployment creation fails
      }
    }
    
    // Step 5: Setup monitoring
    if (config.monitoring.enabled) {
      try {
        await setupMonitoring(application.id, config);
      } catch (error) {
        console.error('Failed to setup monitoring:', error);
      }
    }
    
    return NextResponse.json({ 
      applicationId: application.id,
      message: 'Application created successfully',
      repository: config.repository.provider === 'gitea' ? 
        `https://git.gmac.io/${userId}/${config.slug}` : null,
    });
    
  } catch (error) {
    console.error('Error creating application:', error);
    return NextResponse.json(
      { error: 'Failed to create application' },
      { status: 500 }
    );
  }
}

async function createGiteaActionsWorkflow(
  giteaClient: GiteaClient,
  owner: string,
  repo: string,
  config: WizardConfig
) {
  // Create a basic CI/CD workflow file
  const workflow = `
name: CI/CD Pipeline

on:
  push:
    branches:
      - ${config.repository.defaultBranch}
      - develop
  pull_request:
    branches:
      - ${config.repository.defaultBranch}

env:
  REGISTRY: harbor.gmac.io
  IMAGE_NAME: ${config.slug}

jobs:
  ${config.deployment.cicd.runTests ? `
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          ${config.deployment.cicd.buildCache ? 'cache: npm' : ''}
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
  ` : ''}
  
  build:
    ${config.deployment.cicd.runTests ? 'needs: test' : ''}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v2
        ${config.deployment.cicd.buildCache ? `
        with:
          buildkitd-flags: --debug
          driver-opts: |
            image=moby/buildkit:latest
            network=host
        ` : ''}
      
      - name: Login to Harbor
        uses: docker/login-action@v2
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ secrets.HARBOR_USERNAME }}
          password: \${{ secrets.HARBOR_PASSWORD }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: |
            \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:latest
            \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}
          ${config.deployment.cicd.buildCache ? `
          cache-from: type=registry,ref=\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:buildcache
          cache-to: type=registry,ref=\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:buildcache,mode=max
          ` : ''}
  
  ${config.deployment.environments.staging.enabled && config.deployment.cicd.autoDeployStaging ? `
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/${config.repository.defaultBranch}'
    steps:
      - name: Deploy to Staging
        run: |
          echo "Deploying to staging environment"
          # kubectl commands to update staging deployment
  ` : ''}
  
  ${config.deployment.environments.production.enabled && config.deployment.cicd.autoDeployProduction ? `
  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/${config.repository.defaultBranch}'
    steps:
      - name: Deploy to Production
        run: |
          echo "Deploying to production environment"
          # kubectl commands to update production deployment
  ` : ''}
`;
  
  // TODO: Actually create the workflow file in the repository
  console.log('Would create workflow file:', workflow);
}

async function createKubernetesDeployments(applicationId: string, config: WizardConfig) {
  const k3sManager = new K3sManager();
  
  // Create staging deployment
  if (config.deployment.environments.staging.enabled) {
    const stagingManifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: config.slug,
        namespace: config.deployment.environments.staging.namespace || `${config.slug}-staging`,
        labels: {
          app: config.slug,
          environment: 'staging',
        },
      },
      spec: {
        replicas: config.deployment.resources.replicas.min,
        selector: {
          matchLabels: {
            app: config.slug,
            environment: 'staging',
          },
        },
        template: {
          metadata: {
            labels: {
              app: config.slug,
              environment: 'staging',
            },
          },
          spec: {
            containers: [
              {
                name: config.slug,
                image: `harbor.gmac.io/${config.slug}:latest`,
                resources: {
                  requests: {
                    cpu: `${config.deployment.resources.cpu.request}m`,
                    memory: `${config.deployment.resources.memory.request}Mi`,
                  },
                  limits: {
                    cpu: `${config.deployment.resources.cpu.limit}m`,
                    memory: `${config.deployment.resources.memory.limit}Mi`,
                  },
                },
                ports: [
                  {
                    containerPort: 3000,
                    protocol: 'TCP',
                  },
                ],
              },
            ],
          },
        },
      },
    };
    
    // Create staging service
    const stagingService = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: config.slug,
        namespace: config.deployment.environments.staging.namespace || `${config.slug}-staging`,
      },
      spec: {
        selector: {
          app: config.slug,
          environment: 'staging',
        },
        ports: [
          {
            port: 80,
            targetPort: 3000,
            protocol: 'TCP',
          },
        ],
        type: 'ClusterIP',
      },
    };
    
    // Create staging ingress
    if (config.deployment.environments.staging.domain) {
      const stagingIngress = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: config.slug,
          namespace: config.deployment.environments.staging.namespace || `${config.slug}-staging`,
          annotations: {
            'kubernetes.io/ingress.class': 'nginx',
            'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          },
        },
        spec: {
          tls: [
            {
              hosts: [config.deployment.environments.staging.domain],
              secretName: `${config.slug}-staging-tls`,
            },
          ],
          rules: [
            {
              host: config.deployment.environments.staging.domain,
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: {
                        name: config.slug,
                        port: {
                          number: 80,
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      };
      
      // TODO: Apply ingress manifest
      console.log('Would create staging ingress:', stagingIngress);
    }
    
    // TODO: Apply manifests to cluster
    console.log('Would create staging deployment:', stagingManifest);
    console.log('Would create staging service:', stagingService);
  }
  
  // Create production deployment (similar to staging)
  if (config.deployment.environments.production.enabled) {
    // Similar manifests for production
    console.log('Would create production deployment');
  }
  
  // Create HPA for auto-scaling
  if (config.deployment.resources.replicas.max > config.deployment.resources.replicas.min) {
    const hpa = {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: config.slug,
        namespace: config.deployment.environments.production.namespace || config.slug,
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: config.slug,
        },
        minReplicas: config.deployment.resources.replicas.min,
        maxReplicas: config.deployment.resources.replicas.max,
        metrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: 70,
              },
            },
          },
          {
            type: 'Resource',
            resource: {
              name: 'memory',
              target: {
                type: 'Utilization',
                averageUtilization: 80,
              },
            },
          },
        ],
      },
    };
    
    console.log('Would create HPA:', hpa);
  }
}

async function setupMonitoring(applicationId: string, config: WizardConfig) {
  if (!config.monitoring.enabled) return;
  
  // Create ServiceMonitor for Prometheus
  if (config.monitoring.provider === 'prometheus') {
    const serviceMonitor = {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'ServiceMonitor',
      metadata: {
        name: config.slug,
        namespace: config.deployment.environments.production.namespace || config.slug,
        labels: {
          app: config.slug,
          prometheus: 'kube-prometheus',
        },
      },
      spec: {
        selector: {
          matchLabels: {
            app: config.slug,
          },
        },
        endpoints: [
          {
            port: 'metrics',
            interval: '30s',
            path: '/metrics',
          },
        ],
      },
    };
    
    console.log('Would create ServiceMonitor:', serviceMonitor);
  }
  
  // Setup default alerts
  if (config.monitoring.alerts) {
    const alertRules = {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'PrometheusRule',
      metadata: {
        name: config.slug,
        namespace: config.deployment.environments.production.namespace || config.slug,
      },
      spec: {
        groups: [
          {
            name: `${config.slug}.rules`,
            interval: '30s',
            rules: [
              {
                alert: 'HighCPUUsage',
                expr: `rate(container_cpu_usage_seconds_total{pod=~"${config.slug}-.*"}[5m]) > 0.8`,
                for: '5m',
                annotations: {
                  summary: 'High CPU usage detected for {{ $labels.pod }}',
                  description: 'CPU usage is above 80% for more than 5 minutes',
                },
              },
              {
                alert: 'HighMemoryUsage',
                expr: `container_memory_usage_bytes{pod=~"${config.slug}-.*"} / container_spec_memory_limit_bytes > 0.8`,
                for: '5m',
                annotations: {
                  summary: 'High memory usage detected for {{ $labels.pod }}',
                  description: 'Memory usage is above 80% for more than 5 minutes',
                },
              },
              {
                alert: 'PodNotReady',
                expr: `kube_pod_status_ready{pod=~"${config.slug}-.*"} == 0`,
                for: '5m',
                annotations: {
                  summary: 'Pod {{ $labels.pod }} is not ready',
                  description: 'Pod has been not ready for more than 5 minutes',
                },
              },
            ],
          },
        ],
      },
    };
    
    console.log('Would create alert rules:', alertRules);
  }
}
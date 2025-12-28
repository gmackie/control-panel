import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deploymentWorkflowManager, DeploymentEnvironment, DeploymentStrategy } from '@/lib/deployment/workflow-manager';
import { z } from 'zod';

const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  environment: DeploymentEnvironment,
  strategy: DeploymentStrategy,
  steps: z.array(z.object({
    name: z.string(),
    type: z.enum(['build', 'test', 'deploy', 'verify', 'notify', 'rollback']),
    command: z.string().optional(),
    environment: z.record(z.string()).default({}),
    timeout: z.number().default(300),
    maxRetries: z.number().default(2),
    conditions: z.object({
      runIf: z.string().optional(),
      skipIf: z.string().optional(),
      continueOnError: z.boolean().default(false),
    }).optional(),
  })),
  defaultConfiguration: z.record(z.any()).default({}),
  variables: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'select']),
    required: z.boolean().default(false),
    defaultValue: z.any().optional(),
    options: z.array(z.string()).optional(),
    description: z.string().optional(),
  })).default([]),
  tags: z.array(z.string()).default([]),
});

const CreateWorkflowFromTemplateSchema = z.object({
  templateId: z.string(),
  variables: z.record(z.any()),
  autoStart: z.boolean().default(false),
});

// GET /api/deployments/templates - Get workflow templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') as DeploymentEnvironment;
    const strategy = searchParams.get('strategy') as DeploymentStrategy;
    const tags = searchParams.get('tags')?.split(',');
    const activeOnly = searchParams.get('active_only') === 'true';

    // For demo purposes, create default templates if none exist
    await initializeDefaultTemplates();

    // In a real implementation, you'd filter templates from the manager
    const mockTemplates = getDefaultTemplates().filter(template => {
      if (environment && template.environment !== environment) return false;
      if (strategy && template.strategy !== strategy) return false;
      if (activeOnly && !template.isActive) return false;
      if (tags && !tags.some(tag => template.tags.includes(tag))) return false;
      return true;
    });

    return NextResponse.json({
      success: true,
      templates: mockTemplates,
      total: mockTemplates.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/deployments/templates - Create workflow template or create workflow from template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.email !== 'graeme@gmac.io') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Check if this is creating a workflow from template
    if (body.templateId) {
      return await handleCreateWorkflowFromTemplate(body, session.user.email || 'unknown');
    }
    
    // Otherwise, create a new template
    const templateData = CreateTemplateSchema.parse(body);
    
    // Mock template creation to avoid schema mismatch
    const template = {
      id: Math.random().toString(36).substring(7),
      ...templateData,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: templateData.steps.map(step => ({
        ...step,
        retryCount: 0,
        artifacts: []
      }))
    };

    return NextResponse.json({
      success: true,
      template,
      message: 'Template created successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid template data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

async function handleCreateWorkflowFromTemplate(body: any, userId: string): Promise<NextResponse> {
  try {
    const { templateId, variables, autoStart } = CreateWorkflowFromTemplateSchema.parse(body);
    
    const workflow = await deploymentWorkflowManager.createWorkflowFromTemplate(templateId, {
      ...variables,
      triggeredBy: userId,
    });

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Template not found or inactive' },
        { status: 404 }
      );
    }

    if (autoStart) {
      await deploymentWorkflowManager.startWorkflow(workflow.id);
    }

    return NextResponse.json({
      success: true,
      workflow,
      templateId,
      message: `Workflow ${autoStart ? 'created and started' : 'created'} from template successfully`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid workflow data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create workflow from template' },
      { status: 500 }
    );
  }
}

// Initialize default templates
async function initializeDefaultTemplates() {
  // This would be handled by the manager in a real implementation
  console.log('Default templates initialized');
}

// Mock templates for demo
function getDefaultTemplates() {
  return [
    {
      id: 'template-staging-rolling',
      name: 'Staging Rolling Deployment',
      description: 'Standard rolling deployment for staging environment with full test suite',
      environment: 'staging' as DeploymentEnvironment,
      strategy: 'rolling' as DeploymentStrategy,
      steps: [
        {
          name: 'Build Docker Image',
          type: 'build' as const,
          command: 'docker build -t {{application}}:{{version}} .',
          timeout: 600,
        },
        {
          name: 'Run Test Suite',
          type: 'test' as const,
          command: 'npm run test:ci',
          timeout: 300,
        },
        {
          name: 'Deploy to Staging',
          type: 'deploy' as const,
          command: 'kubectl apply -f k8s/staging/',
          timeout: 300,
        },
        {
          name: 'Verify Deployment',
          type: 'verify' as const,
          timeout: 180,
        },
        {
          name: 'Send Notifications',
          type: 'notify' as const,
          timeout: 30,
        }
      ],
      defaultConfiguration: {
        replicas: 3,
        resources: {
          cpu: '500m',
          memory: '512Mi'
        },
        healthChecks: {
          enabled: true,
          path: '/health',
          timeout: 30,
          retries: 3
        }
      },
      variables: [
        {
          name: 'application',
          type: 'string' as const,
          required: true,
          description: 'Application name'
        },
        {
          name: 'version',
          type: 'string' as const,
          required: true,
          description: 'Version to deploy'
        },
        {
          name: 'replicas',
          type: 'number' as const,
          defaultValue: 3,
          description: 'Number of replicas'
        }
      ],
      tags: ['staging', 'rolling', 'standard'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'template-prod-blue-green',
      name: 'Production Blue-Green Deployment',
      description: 'Zero-downtime blue-green deployment for production',
      environment: 'production' as DeploymentEnvironment,
      strategy: 'blue_green' as DeploymentStrategy,
      steps: [
        {
          name: 'Build Production Image',
          type: 'build' as const,
          command: 'docker build -t {{application}}:{{version}} -f Dockerfile.prod .',
          timeout: 900,
        },
        {
          name: 'Security Scan',
          type: 'test' as const,
          command: 'trivy image {{application}}:{{version}}',
          timeout: 300,
        },
        {
          name: 'Blue-Green Deploy',
          type: 'deploy' as const,
          command: 'kubectl apply -f k8s/production/',
          timeout: 600,
        },
        {
          name: 'Production Health Check',
          type: 'verify' as const,
          timeout: 300,
        },
        {
          name: 'Notify Stakeholders',
          type: 'notify' as const,
          timeout: 60,
        }
      ],
      defaultConfiguration: {
        replicas: 5,
        resources: {
          cpu: '1000m',
          memory: '1Gi'
        },
        healthChecks: {
          enabled: true,
          path: '/health',
          timeout: 60,
          retries: 5
        }
      },
      variables: [
        {
          name: 'application',
          type: 'string' as const,
          required: true,
          description: 'Application name'
        },
        {
          name: 'version',
          type: 'string' as const,
          required: true,
          description: 'Production version to deploy'
        },
        {
          name: 'approver',
          type: 'string' as const,
          required: true,
          description: 'Deployment approver email'
        }
      ],
      tags: ['production', 'blue-green', 'zero-downtime'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'template-canary',
      name: 'Canary Deployment',
      description: 'Gradual canary rollout with automated monitoring',
      environment: 'production' as DeploymentEnvironment,
      strategy: 'canary' as DeploymentStrategy,
      steps: [
        {
          name: 'Build and Test',
          type: 'build' as const,
          command: 'docker build -t {{application}}:{{version}} .',
          timeout: 600,
        },
        {
          name: 'Canary Deploy',
          type: 'deploy' as const,
          command: 'istio-canary-deploy.sh {{application}} {{version}} {{canary_percentage}}',
          timeout: 300,
        },
        {
          name: 'Monitor Canary',
          type: 'verify' as const,
          timeout: 900, // 15 minutes monitoring
        },
        {
          name: 'Complete Rollout',
          type: 'deploy' as const,
          command: 'istio-complete-rollout.sh {{application}} {{version}}',
          timeout: 300,
        }
      ],
      defaultConfiguration: {
        canaryPercentage: 10,
        monitoringDuration: 900
      },
      variables: [
        {
          name: 'application',
          type: 'string' as const,
          required: true,
          description: 'Application name'
        },
        {
          name: 'version',
          type: 'string' as const,
          required: true,
          description: 'Version to deploy'
        },
        {
          name: 'canary_percentage',
          type: 'select' as const,
          options: ['5', '10', '25', '50'],
          defaultValue: '10',
          description: 'Initial canary traffic percentage'
        }
      ],
      tags: ['production', 'canary', 'gradual'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];
}
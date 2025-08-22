import { 
  Deployment, 
  Pod, 
  Pipeline,
  PipelineStage,
  PipelineStep,
  CreateDeploymentRequest,
  DeploymentHealth,
  Container,
  PodEvent 
} from '@/types/deployments';

// In-memory storage for demo purposes
const deployments: Map<string, Deployment> = new Map();
const pods: Map<string, Pod[]> = new Map();

// Helper functions
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Deployment management
export async function createDeployment(
  data: CreateDeploymentRequest
): Promise<Deployment> {
  const id = generateId();
  
  const pipeline: Pipeline = {
    id: generateId(),
    name: data.pipeline?.name || `Deploy ${data.version}`,
    stages: createDefaultPipelineStages(data.environment),
    status: 'running',
    startedAt: new Date().toISOString(),
    trigger: data.pipeline?.trigger || 'manual',
  };
  
  const deployment: Deployment = {
    id,
    applicationId: data.applicationId,
    environment: data.environment,
    version: data.version,
    commitSha: data.commitSha,
    commitMessage: data.commitMessage,
    imageTag: data.imageTag,
    status: 'building',
    health: {
      status: 'unknown',
      checks: [],
      lastChecked: new Date().toISOString(),
    },
    pods: [],
    pipeline,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  deployments.set(id, deployment);
  
  // Simulate deployment progression
  simulateDeployment(deployment);
  
  return deployment;
}

export async function getDeployment(id: string): Promise<Deployment | null> {
  return deployments.get(id) || null;
}

export async function getDeployments(
  applicationId: string,
  environment?: 'staging' | 'production'
): Promise<Deployment[]> {
  return Array.from(deployments.values()).filter(
    d => d.applicationId === applicationId && 
    (!environment || d.environment === environment)
  );
}

export async function getLatestDeployment(
  applicationId: string,
  environment: 'staging' | 'production'
): Promise<Deployment | null> {
  const appDeployments = await getDeployments(applicationId, environment);
  return appDeployments
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    [0] || null;
}

// Pod management
export async function getPodsForDeployment(deploymentId: string): Promise<Pod[]> {
  return pods.get(deploymentId) || [];
}

export async function getPodDetails(deploymentId: string, podId: string): Promise<Pod | null> {
  const deploymentPods = pods.get(deploymentId) || [];
  return deploymentPods.find(p => p.id === podId) || null;
}

export async function updatePodMetrics(
  deploymentId: string,
  podId: string,
  metrics: { cpu: Pod['cpu'], memory: Pod['memory'] }
): Promise<void> {
  const deploymentPods = pods.get(deploymentId) || [];
  const pod = deploymentPods.find(p => p.id === podId);
  
  if (pod) {
    pod.cpu = metrics.cpu;
    pod.memory = metrics.memory;
    pods.set(deploymentId, deploymentPods);
  }
}

// Health checks
export async function updateDeploymentHealth(
  deploymentId: string,
  health: DeploymentHealth
): Promise<void> {
  const deployment = deployments.get(deploymentId);
  if (deployment) {
    deployment.health = health;
    deployment.updatedAt = new Date().toISOString();
    deployments.set(deploymentId, deployment);
  }
}

// Helper functions
function createDefaultPipelineStages(environment: string): PipelineStage[] {
  const stages: PipelineStage[] = [
    {
      id: generateId(),
      name: 'Build',
      status: 'running',
      steps: [
        {
          id: generateId(),
          name: 'Checkout code',
          status: 'succeeded',
          startedAt: new Date().toISOString(),
          finishedAt: new Date(Date.now() + 2000).toISOString(),
          duration: 2,
        },
        {
          id: generateId(),
          name: 'Build Docker image',
          status: 'running',
          startedAt: new Date().toISOString(),
        },
        {
          id: generateId(),
          name: 'Push to registry',
          status: 'pending',
        },
      ],
    },
    {
      id: generateId(),
      name: 'Test',
      status: 'pending',
      steps: [
        {
          id: generateId(),
          name: 'Run unit tests',
          status: 'pending',
        },
        {
          id: generateId(),
          name: 'Run integration tests',
          status: 'pending',
        },
      ],
    },
  ];
  
  if (environment === 'production') {
    stages.push({
      id: generateId(),
      name: 'Staging Deploy',
      status: 'pending',
      steps: [
        {
          id: generateId(),
          name: 'Deploy to staging',
          status: 'pending',
        },
        {
          id: generateId(),
          name: 'Run smoke tests',
          status: 'pending',
        },
      ],
    });
  }
  
  stages.push({
    id: generateId(),
    name: 'Deploy',
    status: 'pending',
    steps: [
      {
        id: generateId(),
        name: 'Update Kubernetes manifests',
        status: 'pending',
      },
      {
        id: generateId(),
        name: 'Apply deployment',
        status: 'pending',
      },
      {
        id: generateId(),
        name: 'Wait for rollout',
        status: 'pending',
      },
    ],
  });
  
  return stages;
}

function simulateDeployment(deployment: Deployment) {
  // Simulate pipeline progression
  let stageIndex = 0;
  let stepIndex = 0;
  
  const progressPipeline = () => {
    if (stageIndex >= deployment.pipeline.stages.length) {
      // Deployment complete
      deployment.status = 'running';
      deployment.pipeline.status = 'succeeded';
      deployment.pipeline.finishedAt = new Date().toISOString();
      deployment.deployedAt = new Date().toISOString();
      
      // Create pods
      createPodsForDeployment(deployment);
      
      deployments.set(deployment.id, deployment);
      return;
    }
    
    const stage = deployment.pipeline.stages[stageIndex];
    const step = stage.steps[stepIndex];
    
    if (!stage.startedAt) {
      stage.status = 'running';
      stage.startedAt = new Date().toISOString();
    }
    
    // Progress current step
    if (step.status === 'pending') {
      step.status = 'running';
      step.startedAt = new Date().toISOString();
    } else if (step.status === 'running') {
      step.status = 'succeeded';
      step.finishedAt = new Date().toISOString();
      step.duration = 2 + Math.random() * 8; // 2-10 seconds
      step.exitCode = 0;
      
      stepIndex++;
      
      if (stepIndex >= stage.steps.length) {
        // Stage complete
        stage.status = 'succeeded';
        stage.finishedAt = new Date().toISOString();
        stage.duration = stage.steps.reduce((sum, s) => sum + (s.duration || 0), 0);
        
        stageIndex++;
        stepIndex = 0;
      }
    }
    
    deployments.set(deployment.id, deployment);
    
    // Continue after delay
    setTimeout(progressPipeline, 2000 + Math.random() * 3000);
  };
  
  setTimeout(progressPipeline, 1000);
}

function createPodsForDeployment(deployment: Deployment) {
  const replicas = deployment.environment === 'production' ? 3 : 1;
  const deploymentPods: Pod[] = [];
  
  for (let i = 0; i < replicas; i++) {
    const pod: Pod = {
      id: generateId(),
      name: `${deployment.applicationId}-${deployment.environment}-${generateId()}`,
      namespace: deployment.environment,
      status: 'running',
      ready: true,
      restarts: 0,
      age: '0s',
      cpu: {
        usage: 10 + Math.random() * 40,
        limit: 1000,
        request: 100,
      },
      memory: {
        usage: 128 + Math.random() * 256,
        limit: 1024,
        request: 256,
      },
      containers: [
        {
          name: 'app',
          image: `${deployment.applicationId}:${deployment.imageTag}`,
          imageID: `sha256:${generateId()}${generateId()}`,
          state: 'running',
          ready: true,
          restartCount: 0,
          started: new Date().toISOString(),
        },
      ],
      events: [
        {
          type: 'Normal',
          reason: 'Scheduled',
          message: 'Successfully assigned pod to node',
          count: 1,
          firstTimestamp: new Date().toISOString(),
          lastTimestamp: new Date().toISOString(),
        },
        {
          type: 'Normal',
          reason: 'Pulled',
          message: 'Container image already present on machine',
          count: 1,
          firstTimestamp: new Date().toISOString(),
          lastTimestamp: new Date().toISOString(),
        },
        {
          type: 'Normal',
          reason: 'Created',
          message: 'Created container app',
          count: 1,
          firstTimestamp: new Date().toISOString(),
          lastTimestamp: new Date().toISOString(),
        },
        {
          type: 'Normal',
          reason: 'Started',
          message: 'Started container app',
          count: 1,
          firstTimestamp: new Date().toISOString(),
          lastTimestamp: new Date().toISOString(),
        },
      ],
      node: `node-${Math.floor(Math.random() * 3) + 1}`,
      ip: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    };
    
    deploymentPods.push(pod);
  }
  
  deployment.pods = deploymentPods;
  pods.set(deployment.id, deploymentPods);
  
  // Update deployment health
  deployment.health = {
    status: 'healthy',
    checks: [
      {
        name: 'HTTP Health Check',
        type: 'http',
        status: 'passing',
        message: 'HTTP 200 OK',
        lastChecked: new Date().toISOString(),
        duration: 15,
      },
      {
        name: 'Database Connection',
        type: 'tcp',
        status: 'passing',
        message: 'Connected successfully',
        lastChecked: new Date().toISOString(),
        duration: 5,
      },
    ],
    lastChecked: new Date().toISOString(),
  };
  
  deployments.set(deployment.id, deployment);
}

// Initialize with sample data
const sampleDeployment: Deployment = {
  id: '1',
  applicationId: '1',
  environment: 'production',
  version: 'v1.2.3',
  commitSha: 'abc123def456',
  commitMessage: 'feat: Add user authentication',
  commitAuthor: 'John Doe',
  imageTag: 'v1.2.3',
  imageDigest: 'sha256:1234567890abcdef',
  status: 'running',
  health: {
    status: 'healthy',
    checks: [
      {
        name: 'HTTP Health Check',
        type: 'http',
        status: 'passing',
        message: 'HTTP 200 OK',
        lastChecked: new Date().toISOString(),
        duration: 15,
      },
    ],
    lastChecked: new Date().toISOString(),
  },
  pods: [],
  pipeline: {
    id: 'pipeline-1',
    name: 'Deploy v1.2.3',
    stages: [],
    status: 'succeeded',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    finishedAt: new Date(Date.now() - 3000000).toISOString(),
    duration: 600,
    trigger: 'commit',
  },
  createdAt: new Date(Date.now() - 3600000).toISOString(),
  updatedAt: new Date().toISOString(),
  deployedAt: new Date(Date.now() - 3000000).toISOString(),
  deployedBy: 'github-actions',
};

deployments.set(sampleDeployment.id, sampleDeployment);
createPodsForDeployment(sampleDeployment);
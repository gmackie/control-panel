import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DeployRequest {
  // Required
  image: string;          // Full image path e.g., "library/control-panel"
  tag: string;            // Tag to deploy e.g., "latest"
  
  // Optional - will be inferred if not provided
  name?: string;          // Deployment name (defaults to image name)
  namespace?: string;     // Target namespace (defaults based on environment)
  environment?: 'staging' | 'production';
  
  // Deployment options
  replicas?: number;
  port?: number;
  createIngress?: boolean;
  domain?: string;
}

interface DeploymentResult {
  success: boolean;
  deployment: {
    name: string;
    namespace: string;
    image: string;
    replicas: number;
  };
  service?: {
    name: string;
    port: number;
  };
  ingress?: {
    host: string;
    url: string;
  };
  message: string;
}

const REGISTRY_URL = process.env.HARBOR_URL || process.env.REGISTRY_URL || 'https://registry.gmac.io';
const REGISTRY_HOST = new URL(REGISTRY_URL).host;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: DeployRequest = await request.json();
    const { image, tag, environment = 'staging' } = body;

    if (!image || !tag) {
      return NextResponse.json(
        { error: 'Image and tag are required' },
        { status: 400 }
      );
    }

    // Extract app name from image path (e.g., "library/control-panel" -> "control-panel")
    const appName = body.name || image.split('/').pop() || image;
    const namespace = body.namespace || (environment === 'production' ? appName : `${appName}-staging`);
    const replicas = body.replicas || (environment === 'production' ? 2 : 1);
    const port = body.port || 3000;
    const fullImage = `${REGISTRY_HOST}/${image}:${tag}`;

    // Build kubectl command
    const kubectlBase = 'kubectl';
    
    // Step 1: Create namespace if it doesn't exist
    await runKubectl(`create namespace ${namespace} --dry-run=client -o yaml | ${kubectlBase} apply -f -`);

    // Step 2: Create or update deployment
    const deploymentYaml = generateDeploymentYaml({
      name: appName,
      namespace,
      image: fullImage,
      replicas,
      port,
    });

    await applyYaml(deploymentYaml);

    // Step 3: Create service
    const serviceYaml = generateServiceYaml({
      name: appName,
      namespace,
      port,
    });

    await applyYaml(serviceYaml);

    // Step 4: Create ingress if requested
    let ingressInfo;
    if (body.createIngress !== false) {
      const domain = body.domain || `${appName}${environment === 'staging' ? '-staging' : ''}.gmac.io`;
      
      const ingressYaml = generateIngressYaml({
        name: appName,
        namespace,
        host: domain,
        port,
      });

      await applyYaml(ingressYaml);
      
      ingressInfo = {
        host: domain,
        url: `https://${domain}`,
      };
    }

    // Step 5: Wait for rollout (with timeout)
    try {
      await runKubectl(
        `rollout status deployment/${appName} -n ${namespace} --timeout=120s`
      );
    } catch (rolloutError) {
      console.warn('Rollout status check timed out, deployment may still be in progress');
    }

    const result: DeploymentResult = {
      success: true,
      deployment: {
        name: appName,
        namespace,
        image: fullImage,
        replicas,
      },
      service: {
        name: appName,
        port,
      },
      ingress: ingressInfo,
      message: `Successfully deployed ${appName} to ${namespace} using ${fullImage}`,
    };

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Deployment error:', error);
    const message = error instanceof Error ? error.message : 'Failed to deploy';
    return NextResponse.json(
      { error: message, details: String(error) },
      { status: 500 }
    );
  }
}

// GET - List current deployments for a specific image
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const image = searchParams.get('image');

    if (!image) {
      // Return all deployments with our label
      const result = await runKubectl(
        `get deployments -A -l managed-by=gmac-control-panel -o json`
      );
      const deployments = JSON.parse(result);
      
      return NextResponse.json({
        deployments: deployments.items.map((d: any) => ({
          name: d.metadata.name,
          namespace: d.metadata.namespace,
          image: d.spec.template.spec.containers[0]?.image,
          replicas: {
            desired: d.spec.replicas,
            ready: d.status.readyReplicas || 0,
            available: d.status.availableReplicas || 0,
          },
          createdAt: d.metadata.creationTimestamp,
        })),
      });
    }

    // Find deployments using this specific image
    const result = await runKubectl(`get deployments -A -o json`);
    const allDeployments = JSON.parse(result);
    
    const matchingDeployments = allDeployments.items.filter((d: any) => {
      const containerImage = d.spec.template.spec.containers[0]?.image || '';
      return containerImage.includes(image);
    });

    return NextResponse.json({
      image,
      deployments: matchingDeployments.map((d: any) => ({
        name: d.metadata.name,
        namespace: d.metadata.namespace,
        image: d.spec.template.spec.containers[0]?.image,
        replicas: {
          desired: d.spec.replicas,
          ready: d.status.readyReplicas || 0,
          available: d.status.availableReplicas || 0,
        },
        createdAt: d.metadata.creationTimestamp,
      })),
    });

  } catch (error: unknown) {
    console.error('Error listing deployments:', error);
    const message = error instanceof Error ? error.message : 'Failed to list deployments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Helper functions
async function runKubectl(command: string): Promise<string> {
  const { stdout } = await execAsync(`kubectl ${command}`, {
    env: {
      ...process.env,
      KUBECONFIG: process.env.KUBECONFIG || '/Users/mackieg/.kube/config-hetzner',
    },
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
  });
  return stdout;
}

async function applyYaml(yaml: string): Promise<void> {
  await execAsync(`kubectl apply -f -`, {
    env: {
      ...process.env,
      KUBECONFIG: process.env.KUBECONFIG || '/Users/mackieg/.kube/config-hetzner',
    },
    input: yaml,
  } as any);
}

function generateDeploymentYaml(config: {
  name: string;
  namespace: string;
  image: string;
  replicas: number;
  port: number;
}): string {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${config.name}
  namespace: ${config.namespace}
  labels:
    app: ${config.name}
    managed-by: gmac-control-panel
spec:
  replicas: ${config.replicas}
  selector:
    matchLabels:
      app: ${config.name}
  template:
    metadata:
      labels:
        app: ${config.name}
    spec:
      imagePullSecrets:
        - name: harbor-registry
      containers:
        - name: ${config.name}
          image: ${config.image}
          imagePullPolicy: Always
          ports:
            - containerPort: ${config.port}
              name: http
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          readinessProbe:
            httpGet:
              path: /
              port: ${config.port}
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /
              port: ${config.port}
            initialDelaySeconds: 30
            periodSeconds: 10
`;
}

function generateServiceYaml(config: {
  name: string;
  namespace: string;
  port: number;
}): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: ${config.name}
  namespace: ${config.namespace}
  labels:
    app: ${config.name}
    managed-by: gmac-control-panel
spec:
  selector:
    app: ${config.name}
  ports:
    - name: http
      port: ${config.port}
      targetPort: ${config.port}
`;
}

function generateIngressYaml(config: {
  name: string;
  namespace: string;
  host: string;
  port: number;
}): string {
  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${config.name}
  namespace: ${config.namespace}
  labels:
    app: ${config.name}
    managed-by: gmac-control-panel
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - ${config.host}
      secretName: ${config.name}-tls
  rules:
    - host: ${config.host}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${config.name}
                port:
                  number: ${config.port}
`;
}

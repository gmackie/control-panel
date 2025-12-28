/**
 * Application Discovery Service
 *
 * Scans Kubernetes clusters to discover existing applications and imports them
 * into the control panel's application management system.
 */

import { KubeconfigManager } from '../cluster/modules/kubeconfig-manager';
import { DeploymentManager } from '../cluster/modules/deployment-manager';
import { Application } from '@/types/applications';

export interface DiscoveredApplication {
  name: string;
  namespace: string;
  slug: string;
  description?: string;
  replicas: {
    desired: number;
    ready: number;
    available: number;
  };
  image?: string;
  resources?: {
    cpu: { request?: string; limit?: string };
    memory: { request?: string; limit?: string };
  };
  ports?: Array<{ name: string; port: number; targetPort: number }>;
  ingress?: {
    host: string;
    tls: boolean;
  };
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
  repository?: string;
  environment?: string;
  clusterName: string;
  managedByControlPanel: boolean;
}

export interface DiscoveryOptions {
  clusterName?: string;
  namespaces?: string[];
  includeManaged?: boolean; // Include apps already managed by control panel
  includeSystemNamespaces?: boolean; // Include kube-system, kube-public, etc.
}

export class ApplicationDiscoveryService {
  private kubeconfigManager: KubeconfigManager;
  private systemNamespaces = [
    'kube-system',
    'kube-public',
    'kube-node-lease',
    'kubernetes-dashboard',
    'default',
  ];

  constructor(kubeconfigManager: KubeconfigManager) {
    this.kubeconfigManager = kubeconfigManager;
  }

  /**
   * Discover all applications across specified namespaces or entire cluster
   */
  async discoverApplications(
    options: DiscoveryOptions = {}
  ): Promise<DiscoveredApplication[]> {
    const clusters = options.clusterName
      ? [options.clusterName]
      : await this.kubeconfigManager.listClusters();

    const allDiscoveredApps: DiscoveredApplication[] = [];

    for (const cluster of clusters) {
      const kubectl = this.kubeconfigManager.getKubectlCommand(cluster);

      // Get all namespaces or use specified ones
      const namespaces = options.namespaces || await this.getAllNamespaces(kubectl);

      // Filter out system namespaces if needed
      const filteredNamespaces = options.includeSystemNamespaces
        ? namespaces
        : namespaces.filter(ns => !this.systemNamespaces.includes(ns));

      for (const namespace of filteredNamespaces) {
        const apps = await this.discoverInNamespace(kubectl, cluster, namespace, options);
        allDiscoveredApps.push(...apps);
      }
    }

    return allDiscoveredApps;
  }

  /**
   * Discover applications in a specific namespace
   */
  private async discoverInNamespace(
    kubectl: (command: string) => Promise<string>,
    clusterName: string,
    namespace: string,
    options: DiscoveryOptions
  ): Promise<DiscoveredApplication[]> {
    try {
      // Get all deployments in namespace
      const deploymentsJson = await kubectl(
        `get deployments -n ${namespace} -o json`
      );
      const deployments = JSON.parse(deploymentsJson);

      const discoveredApps: DiscoveredApplication[] = [];

      for (const deployment of deployments.items || []) {
        const metadata = deployment.metadata || {};
        const spec = deployment.spec || {};
        const status = deployment.status || {};
        const labels = metadata.labels || {};
        const annotations = metadata.annotations || {};

        // Check if managed by control panel
        const managedByControlPanel = labels['managed-by'] === 'gmac-control-panel';

        // Skip if already managed and includeManaged is false
        if (managedByControlPanel && !options.includeManaged) {
          continue;
        }

        // Extract container info
        const containers = spec.template?.spec?.containers || [];
        const mainContainer = containers[0] || {};

        // Extract ports
        const ports = (mainContainer.ports || []).map((p: any) => ({
          name: p.name || 'http',
          port: p.containerPort,
          targetPort: p.containerPort,
        }));

        // Extract resources
        const resources = mainContainer.resources ? {
          cpu: {
            request: mainContainer.resources.requests?.cpu,
            limit: mainContainer.resources.limits?.cpu,
          },
          memory: {
            request: mainContainer.resources.requests?.memory,
            limit: mainContainer.resources.limits?.memory,
          },
        } : undefined;

        // Try to find associated ingress
        const ingress = await this.findIngress(kubectl, metadata.name, namespace);

        // Extract metadata
        const repository = annotations['gmac.io/repository'] ||
                          annotations['app.kubernetes.io/repository'] ||
                          labels['repository'];

        const environment = labels['environment'] ||
                           annotations['gmac.io/environment'] ||
                           namespace;

        const app: DiscoveredApplication = {
          name: metadata.name,
          namespace: namespace,
          slug: this.generateSlug(metadata.name),
          description: annotations['description'] ||
                      annotations['gmac.io/description'] ||
                      `Discovered from ${namespace}/${metadata.name}`,
          replicas: {
            desired: spec.replicas || 1,
            ready: status.readyReplicas || 0,
            available: status.availableReplicas || 0,
          },
          image: mainContainer.image,
          resources,
          ports: ports.length > 0 ? ports : undefined,
          ingress,
          labels,
          annotations,
          createdAt: metadata.creationTimestamp,
          repository,
          environment,
          clusterName,
          managedByControlPanel,
        };

        discoveredApps.push(app);
      }

      return discoveredApps;
    } catch (error) {
      console.error(`Error discovering apps in namespace ${namespace}:`, error);
      return [];
    }
  }

  /**
   * Find ingress for a deployment
   */
  private async findIngress(
    kubectl: (command: string) => Promise<string>,
    deploymentName: string,
    namespace: string
  ): Promise<{ host: string; tls: boolean } | undefined> {
    try {
      const ingressJson = await kubectl(
        `get ingress -n ${namespace} -o json`
      );
      const ingresses = JSON.parse(ingressJson);

      // Look for ingress that matches deployment name
      const matchingIngress = ingresses.items?.find((ing: any) => {
        const ingressName = ing.metadata?.name;
        return ingressName === deploymentName ||
               ingressName?.includes(deploymentName);
      });

      if (matchingIngress) {
        const spec = matchingIngress.spec || {};
        const host = spec.rules?.[0]?.host;
        const tls = !!spec.tls && spec.tls.length > 0;

        if (host) {
          return { host, tls };
        }
      }
    } catch (error) {
      // No ingress found or error - that's okay
    }

    return undefined;
  }

  /**
   * Get all namespaces in the cluster
   */
  private async getAllNamespaces(
    kubectl: (command: string) => Promise<string>
  ): Promise<string[]> {
    try {
      const namespacesJson = await kubectl('get namespaces -o json');
      const namespaces = JSON.parse(namespacesJson);

      return (namespaces.items || []).map((ns: any) => ns.metadata?.name).filter(Boolean);
    } catch (error) {
      console.error('Error getting namespaces:', error);
      return [];
    }
  }

  /**
   * Import a discovered application into the control panel
   */
  async importApplication(
    discoveredApp: DiscoveredApplication,
    ownerId: string
  ): Promise<Application> {
    // Convert discovered app to Application format
    const validEnvironment = (env: string | undefined): 'development' | 'staging' | 'production' => {
      if (env === 'development' || env === 'staging' || env === 'production') {
        return env;
      }
      // Default to production for unknown environments
      return 'production';
    };

    const application: Application = {
      id: this.generateId(),
      name: discoveredApp.name,
      description: discoveredApp.description ?
        `${discoveredApp.description} (imported from ${discoveredApp.clusterName}/${discoveredApp.namespace})` :
        `Imported from ${discoveredApp.clusterName}/${discoveredApp.namespace}`,
      slug: discoveredApp.slug,
      apiKeys: [],
      secrets: [],
      integrations: [],
      settings: {
        environment: validEnvironment(discoveredApp.environment),
        domain: discoveredApp.ingress?.host,
        features: {},
      },
      createdAt: discoveredApp.createdAt,
      updatedAt: new Date().toISOString(),
      ownerId,
      status: discoveredApp.replicas.ready > 0 ? 'active' : 'inactive',
    };

    // TODO: Save to database instead of in-memory
    // For now, we'll update the deployment labels to mark it as managed
    await this.markAsManaged(discoveredApp);

    return application;
  }

  /**
   * Mark a deployment as managed by control panel
   */
  private async markAsManaged(app: DiscoveredApplication): Promise<void> {
    try {
      const kubectl = this.kubeconfigManager.getKubectlCommand(app.clusterName);

      // Add label to mark as managed
      await kubectl(
        `label deployment ${app.name} -n ${app.namespace} managed-by=gmac-control-panel --overwrite`
      );

      // Add annotations with metadata
      const annotations = [
        `gmac.io/imported-at=${new Date().toISOString()}`,
        `gmac.io/original-namespace=${app.namespace}`,
      ];

      if (app.repository) {
        annotations.push(`gmac.io/repository=${app.repository}`);
      }

      for (const annotation of annotations) {
        await kubectl(
          `annotate deployment ${app.name} -n ${app.namespace} ${annotation} --overwrite`
        );
      }
    } catch (error) {
      console.error('Error marking deployment as managed:', error);
      // Non-fatal - we still imported the app
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `app_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate a URL-safe slug from a name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

/**
 * Get or create singleton instance
 */
let discoveryService: ApplicationDiscoveryService | null = null;

export async function getDiscoveryService(): Promise<ApplicationDiscoveryService> {
  if (!discoveryService) {
    // Initialize kubeconfig manager
    const kubeconfigManager = new KubeconfigManager(
      process.env.KUBECONFIG_ENCRYPTION_KEY
    );
    await kubeconfigManager.initialize();

    discoveryService = new ApplicationDiscoveryService(kubeconfigManager);
  }

  return discoveryService;
}

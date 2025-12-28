/**
 * Resources Router
 * 
 * tRPC procedures for viewing raw Kubernetes resources, Gitea repos, and Harbor images
 */

import { z } from "zod";
import { router, publicProcedure } from "../trpc";

// K8s Resource Types
export interface K8sPod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  node: string;
  ip: string;
  containers: { name: string; image: string; ready: boolean }[];
}

export interface K8sDeployment {
  name: string;
  namespace: string;
  ready: string;
  upToDate: number;
  available: number;
  age: string;
  images: string[];
  replicas: { desired: number; current: number; ready: number };
}

export interface K8sService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP: string | null;
  ports: { port: number; targetPort: number; protocol: string }[];
  age: string;
}

export interface K8sIngress {
  name: string;
  namespace: string;
  hosts: string[];
  paths: { host: string; path: string; service: string; port: number }[];
  tls: boolean;
  age: string;
}

export interface GiteaRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  private: boolean;
  fork: boolean;
  stars: number;
  forks: number;
  openIssues: number;
  size: number;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
}

export interface HarborImage {
  project: string;
  repository: string;
  tags: string[];
  digest: string;
  size: number;
  pushTime: string;
  pullCount: number;
  vulnerabilities?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// Mock data functions - these will be replaced with real API calls
async function fetchK8sPods(_namespace?: string): Promise<K8sPod[]> {
  // TODO: Call k3sService.getPods()
  return [
    {
      name: "control-panel-6d8f9c6b5d-x2k4j",
      namespace: "default",
      status: "Running",
      ready: "1/1",
      restarts: 0,
      age: "2d",
      node: "k3s-worker-1",
      ip: "10.42.0.15",
      containers: [{ name: "control-panel", image: "registry.gmac.io/control-panel:latest", ready: true }],
    },
    {
      name: "truecomps-web-7f8d9e6c5b-a1b2c",
      namespace: "default",
      status: "Running",
      ready: "1/1",
      restarts: 2,
      age: "5d",
      node: "k3s-worker-2",
      ip: "10.42.1.23",
      containers: [{ name: "truecomps-web", image: "registry.gmac.io/truecomps-web:v1.2.0", ready: true }],
    },
    {
      name: "postgres-0",
      namespace: "database",
      status: "Running",
      ready: "1/1",
      restarts: 0,
      age: "30d",
      node: "k3s-master-1",
      ip: "10.42.0.5",
      containers: [{ name: "postgres", image: "postgres:15", ready: true }],
    },
  ];
}

async function fetchK8sDeployments(_namespace?: string): Promise<K8sDeployment[]> {
  return [
    {
      name: "control-panel",
      namespace: "default",
      ready: "2/2",
      upToDate: 2,
      available: 2,
      age: "2d",
      images: ["registry.gmac.io/control-panel:latest"],
      replicas: { desired: 2, current: 2, ready: 2 },
    },
    {
      name: "truecomps-web",
      namespace: "default",
      ready: "3/3",
      upToDate: 3,
      available: 3,
      age: "5d",
      images: ["registry.gmac.io/truecomps-web:v1.2.0"],
      replicas: { desired: 3, current: 3, ready: 3 },
    },
    {
      name: "gitea",
      namespace: "gitea",
      ready: "1/1",
      upToDate: 1,
      available: 1,
      age: "60d",
      images: ["gitea/gitea:1.21"],
      replicas: { desired: 1, current: 1, ready: 1 },
    },
  ];
}

async function fetchK8sServices(_namespace?: string): Promise<K8sService[]> {
  return [
    {
      name: "control-panel",
      namespace: "default",
      type: "ClusterIP",
      clusterIP: "10.43.0.100",
      externalIP: null,
      ports: [{ port: 80, targetPort: 3000, protocol: "TCP" }],
      age: "2d",
    },
    {
      name: "truecomps-web",
      namespace: "default",
      type: "ClusterIP",
      clusterIP: "10.43.0.101",
      externalIP: null,
      ports: [{ port: 80, targetPort: 3000, protocol: "TCP" }],
      age: "5d",
    },
    {
      name: "postgres",
      namespace: "database",
      type: "ClusterIP",
      clusterIP: "10.43.0.50",
      externalIP: null,
      ports: [{ port: 5432, targetPort: 5432, protocol: "TCP" }],
      age: "30d",
    },
  ];
}

async function fetchK8sIngresses(_namespace?: string): Promise<K8sIngress[]> {
  return [
    {
      name: "control-panel",
      namespace: "default",
      hosts: ["control.gmac.io"],
      paths: [{ host: "control.gmac.io", path: "/", service: "control-panel", port: 80 }],
      tls: true,
      age: "2d",
    },
    {
      name: "truecomps",
      namespace: "default",
      hosts: ["truecomps.com", "www.truecomps.com"],
      paths: [
        { host: "truecomps.com", path: "/", service: "truecomps-web", port: 80 },
        { host: "www.truecomps.com", path: "/", service: "truecomps-web", port: 80 },
      ],
      tls: true,
      age: "5d",
    },
    {
      name: "gitea",
      namespace: "gitea",
      hosts: ["git.gmac.io"],
      paths: [{ host: "git.gmac.io", path: "/", service: "gitea-http", port: 3000 }],
      tls: true,
      age: "60d",
    },
  ];
}

async function fetchGiteaRepos(): Promise<GiteaRepo[]> {
  return [
    {
      id: 1,
      name: "control-panel",
      fullName: "gmackie/control-panel",
      description: "GMAC.IO Infrastructure Control Panel",
      htmlUrl: "https://git.gmac.io/gmackie/control-panel",
      cloneUrl: "https://git.gmac.io/gmackie/control-panel.git",
      sshUrl: "git@git.gmac.io:gmackie/control-panel.git",
      defaultBranch: "main",
      private: true,
      fork: false,
      stars: 0,
      forks: 0,
      openIssues: 3,
      size: 15000,
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-12-27T12:00:00Z",
      pushedAt: "2024-12-27T11:30:00Z",
    },
    {
      id: 2,
      name: "truecomps-app",
      fullName: "gmackie/truecomps-app",
      description: "TrueComps Property Tax Appeal Platform",
      htmlUrl: "https://git.gmac.io/gmackie/truecomps-app",
      cloneUrl: "https://git.gmac.io/gmackie/truecomps-app.git",
      sshUrl: "git@git.gmac.io:gmackie/truecomps-app.git",
      defaultBranch: "main",
      private: true,
      fork: false,
      stars: 0,
      forks: 0,
      openIssues: 5,
      size: 25000,
      createdAt: "2024-03-01T10:00:00Z",
      updatedAt: "2024-12-26T18:00:00Z",
      pushedAt: "2024-12-26T17:45:00Z",
    },
  ];
}

async function fetchHarborImages(): Promise<HarborImage[]> {
  return [
    {
      project: "gmac",
      repository: "control-panel",
      tags: ["latest", "v1.0.0", "main-abc123"],
      digest: "sha256:abc123...",
      size: 150000000,
      pushTime: "2024-12-27T11:30:00Z",
      pullCount: 45,
      vulnerabilities: { critical: 0, high: 1, medium: 5, low: 12 },
    },
    {
      project: "gmac",
      repository: "truecomps-web",
      tags: ["latest", "v1.2.0", "v1.1.0"],
      digest: "sha256:def456...",
      size: 200000000,
      pushTime: "2024-12-26T17:45:00Z",
      pullCount: 120,
      vulnerabilities: { critical: 0, high: 0, medium: 3, low: 8 },
    },
    {
      project: "gmac",
      repository: "truecomps-api",
      tags: ["latest", "v1.2.0"],
      digest: "sha256:ghi789...",
      size: 80000000,
      pushTime: "2024-12-26T17:40:00Z",
      pullCount: 85,
      vulnerabilities: { critical: 0, high: 0, medium: 1, low: 4 },
    },
  ];
}

export const resourcesRouter = router({
  /**
   * Get K8s namespaces
   */
  namespaces: publicProcedure.query(async () => {
    return ["default", "kube-system", "gitea", "database", "monitoring", "ingress-nginx"];
  }),

  /**
   * Get K8s pods
   */
  pods: publicProcedure
    .input(z.object({ namespace: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return fetchK8sPods(input?.namespace);
    }),

  /**
   * Get K8s deployments
   */
  deployments: publicProcedure
    .input(z.object({ namespace: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return fetchK8sDeployments(input?.namespace);
    }),

  /**
   * Get K8s services
   */
  services: publicProcedure
    .input(z.object({ namespace: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return fetchK8sServices(input?.namespace);
    }),

  /**
   * Get K8s ingresses
   */
  ingresses: publicProcedure
    .input(z.object({ namespace: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return fetchK8sIngresses(input?.namespace);
    }),

  /**
   * Get Gitea repositories
   */
  repositories: publicProcedure.query(async () => {
    return fetchGiteaRepos();
  }),

  /**
   * Get Harbor images
   */
  images: publicProcedure.query(async () => {
    return fetchHarborImages();
  }),

  /**
   * Get resource summary
   */
  summary: publicProcedure.query(async () => {
    const [pods, deployments, services, ingresses, repos, images] = await Promise.all([
      fetchK8sPods(),
      fetchK8sDeployments(),
      fetchK8sServices(),
      fetchK8sIngresses(),
      fetchGiteaRepos(),
      fetchHarborImages(),
    ]);

    return {
      kubernetes: {
        pods: pods.length,
        deployments: deployments.length,
        services: services.length,
        ingresses: ingresses.length,
        podsRunning: pods.filter(p => p.status === "Running").length,
        podsWithIssues: pods.filter(p => p.restarts > 0).length,
      },
      gitea: {
        repositories: repos.length,
        totalSize: repos.reduce((sum, r) => sum + r.size, 0),
        openIssues: repos.reduce((sum, r) => sum + r.openIssues, 0),
      },
      harbor: {
        images: images.length,
        totalTags: images.reduce((sum, i) => sum + i.tags.length, 0),
        totalSize: images.reduce((sum, i) => sum + i.size, 0),
        vulnerabilities: {
          critical: images.reduce((sum, i) => sum + (i.vulnerabilities?.critical || 0), 0),
          high: images.reduce((sum, i) => sum + (i.vulnerabilities?.high || 0), 0),
        },
      },
    };
  }),
});

/**
 * Infrastructure Router
 * 
 * tRPC procedures for infrastructure management (Gitea, Harbor, Hetzner)
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// Types for infrastructure (exported for type inference)
export interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ContainerImage {
  id: string;
  name: string;
  repository: string;
  tags: string[];
  size: number;
  digest: string;
  pushedAt: string;
  pullCount: number;
}

export interface Server {
  id: string;
  name: string;
  status: "running" | "starting" | "stopping" | "off";
  type: string;
  datacenter: string;
  publicIp: string;
  privateIp: string;
  cpu: number;
  memory: number;
  disk: number;
  monthlyPrice: number;
  createdAt: string;
}

// Mock data
const mockRepositories: Repository[] = [
  {
    id: "repo-1",
    name: "control-panel",
    fullName: "gmackie/control-panel",
    description: "GMAC.IO Control Panel",
    url: "https://git.gmac.io/gmackie/control-panel",
    defaultBranch: "main",
    stars: 5,
    forks: 0,
    openIssues: 3,
    lastCommit: {
      sha: "abc123",
      message: "feat: add monorepo structure",
      author: "gmackie",
      date: new Date().toISOString(),
    },
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockImages: ContainerImage[] = [
  {
    id: "img-1",
    name: "control-panel",
    repository: "gmac/control-panel",
    tags: ["latest", "v1.2.3", "v1.2.2"],
    size: 245000000,
    digest: "sha256:abc123...",
    pushedAt: new Date().toISOString(),
    pullCount: 150,
  },
];

const mockServers: Server[] = [
  {
    id: "srv-1",
    name: "k3s-master-1",
    status: "running",
    type: "cx21",
    datacenter: "fsn1-dc14",
    publicIp: "65.108.x.x",
    privateIp: "10.0.0.1",
    cpu: 2,
    memory: 4096,
    disk: 40,
    monthlyPrice: 5.83,
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
  {
    id: "srv-2",
    name: "k3s-worker-1",
    status: "running",
    type: "cx31",
    datacenter: "fsn1-dc14",
    publicIp: "65.108.x.y",
    privateIp: "10.0.0.2",
    cpu: 4,
    memory: 8192,
    disk: 80,
    monthlyPrice: 10.59,
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
  },
];

export const infrastructureRouter = router({
  /**
   * Get Gitea repositories
   */
  repositories: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      owner: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      let repos = [...mockRepositories];
      if (input?.owner) {
        repos = repos.filter((r) => r.fullName.startsWith(input.owner + "/"));
      }
      return repos.slice(0, input?.limit ?? 20);
    }),

  /**
   * Get a single repository
   */
  repository: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const repo = mockRepositories.find((r) => r.name === input || r.fullName === input);
      if (!repo) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });
      }
      return repo;
    }),

  /**
   * Get Harbor container images
   */
  images: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      repository: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      let images = [...mockImages];
      if (input?.repository) {
        images = images.filter((i) => i.repository === input.repository);
      }
      return images.slice(0, input?.limit ?? 20);
    }),

  /**
   * Get a single image
   */
  image: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const image = mockImages.find((i) => i.name === input || i.repository === input);
      if (!image) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Image not found" });
      }
      return image;
    }),

  /**
   * Get Hetzner servers
   */
  servers: publicProcedure.query(async () => {
    return mockServers;
  }),

  /**
   * Get a single server
   */
  server: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      const server = mockServers.find((s) => s.id === input || s.name === input);
      if (!server) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Server not found" });
      }
      return server;
    }),

  /**
   * Get infrastructure health summary
   */
  health: publicProcedure.query(async () => {
    const servers = mockServers;
    const runningServers = servers.filter((s) => s.status === "running").length;
    
    return {
      gitea: {
        status: "healthy" as const,
        repositoryCount: mockRepositories.length,
        lastSync: new Date().toISOString(),
      },
      harbor: {
        status: "healthy" as const,
        imageCount: mockImages.length,
        storageUsed: mockImages.reduce((acc, i) => acc + i.size, 0),
        lastSync: new Date().toISOString(),
      },
      hetzner: {
        status: runningServers === servers.length ? "healthy" as const : "degraded" as const,
        serverCount: servers.length,
        runningServers,
        totalMonthlyCost: servers.reduce((acc, s) => acc + s.monthlyPrice, 0),
      },
    };
  }),

  /**
   * Power action on a server
   */
  serverPower: protectedProcedure
    .input(z.object({
      serverId: z.string(),
      action: z.enum(["start", "stop", "reboot"]),
    }))
    .mutation(async ({ input }) => {
      const server = mockServers.find((s) => s.id === input.serverId);
      if (!server) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Server not found" });
      }
      
      // In production, call Hetzner API
      return {
        success: true,
        message: `${input.action} action triggered on ${server.name}`,
        serverId: server.id,
      };
    }),

  /**
   * Delete an image tag
   */
  deleteImageTag: protectedProcedure
    .input(z.object({
      repository: z.string(),
      tag: z.string(),
    }))
    .mutation(async ({ input }) => {
      // In production, call Harbor API
      return {
        success: true,
        message: `Deleted ${input.repository}:${input.tag}`,
      };
    }),
});

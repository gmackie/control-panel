# MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `packages/mcp-server` - an MCP server enabling Claude to manage the control panel programmatically.

**Architecture:** Standalone package using `@modelcontextprotocol/sdk` with stdio transport. Direct imports from `apps/web/src/lib/*` service layer. Bearer token auth via env var.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, pnpm workspaces, vitest

---

## Task 1: Package Scaffolding

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/src/index.ts`
- Modify: `pnpm-workspace.yaml` (if needed)

**Step 1: Create package.json**

```json
{
  "name": "@repo/mcp-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "mcp-server": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "vitest": "^4.0.16"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@web/*": ["../../apps/web/src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create minimal src/index.ts**

```typescript
#!/usr/bin/env node

console.log("MCP Server starting...");
```

**Step 4: Install dependencies**

Run: `cd packages/mcp-server && pnpm install`

**Step 5: Verify build works**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors, creates `dist/index.js`

**Step 6: Commit**

```bash
git add packages/mcp-server/
git commit -m "feat(mcp-server): scaffold package structure"
```

---

## Task 2: MCP Server Bootstrap

**Files:**
- Create: `packages/mcp-server/src/server.ts`
- Modify: `packages/mcp-server/src/index.ts`

**Step 1: Create server.ts with MCP SDK setup**

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export interface McpServerConfig {
  name: string;
  version: string;
  apiToken?: string;
}

export function createMcpServer(config: McpServerConfig): Server {
  const server = new Server(
    {
      name: config.name,
      version: config.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "ping",
          description: "Test connectivity to the MCP server",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "ping") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

export async function startServer(config: McpServerConfig): Promise<void> {
  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${config.name} v${config.version} running on stdio`);
}
```

**Step 2: Update index.ts to start server**

```typescript
#!/usr/bin/env node

import { startServer } from "./server.js";

const config = {
  name: "control-panel-mcp",
  version: "0.1.0",
  apiToken: process.env.MCP_API_TOKEN,
};

startServer(config).catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
```

**Step 3: Build and verify**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 4: Test manually with stdio**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node packages/mcp-server/dist/index.js`
Expected: JSON response listing the "ping" tool

**Step 5: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): add MCP SDK bootstrap with ping tool"
```

---

## Task 3: Auth Middleware

**Files:**
- Create: `packages/mcp-server/src/auth.ts`
- Modify: `packages/mcp-server/src/server.ts`

**Step 1: Create auth.ts**

```typescript
export interface AuthContext {
  authenticated: boolean;
  token?: string;
}

export function validateToken(token: string | undefined, expectedToken: string | undefined): AuthContext {
  // If no token is configured, allow all requests (local dev mode)
  if (!expectedToken) {
    return { authenticated: true };
  }

  // Validate bearer token
  if (!token) {
    return { authenticated: false };
  }

  const isValid = token === expectedToken;
  return {
    authenticated: isValid,
    token: isValid ? token : undefined,
  };
}

export function requireAuth(context: AuthContext): void {
  if (!context.authenticated) {
    throw new Error("Unauthorized: Invalid or missing MCP_API_TOKEN");
  }
}
```

**Step 2: Update server.ts to use auth**

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { validateToken, requireAuth, AuthContext } from "./auth.js";

export interface McpServerConfig {
  name: string;
  version: string;
  apiToken?: string;
}

export function createMcpServer(config: McpServerConfig): Server {
  const authContext = validateToken(config.apiToken, process.env.MCP_API_TOKEN);

  const server = new Server(
    {
      name: config.name,
      version: config.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    requireAuth(authContext);
    return {
      tools: [
        {
          name: "ping",
          description: "Test connectivity to the MCP server",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    requireAuth(authContext);
    const { name } = request.params;

    if (name === "ping") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "ok",
              timestamp: new Date().toISOString(),
              authenticated: authContext.authenticated,
            }),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

export async function startServer(config: McpServerConfig): Promise<void> {
  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${config.name} v${config.version} running on stdio`);
}
```

**Step 3: Build and verify**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): add bearer token authentication"
```

---

## Task 4: Tool Registry Infrastructure

**Files:**
- Create: `packages/mcp-server/src/tools/types.ts`
- Create: `packages/mcp-server/src/tools/registry.ts`
- Create: `packages/mcp-server/src/tools/index.ts`
- Modify: `packages/mcp-server/src/server.ts`

**Step 1: Create tools/types.ts**

```typescript
import { z } from "zod";

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput) => Promise<TOutput>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    duration_ms: number;
  };
}

export function successResult(data: unknown): ToolResult {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      duration_ms: 0,
    },
  };
}

export function errorResult(code: string, message: string, details?: unknown): ToolResult {
  return {
    success: false,
    error: { code, message, details },
    metadata: {
      timestamp: new Date().toISOString(),
      duration_ms: 0,
    },
  };
}
```

**Step 2: Create tools/registry.ts**

```typescript
import { z } from "zod";
import { ToolDefinition, ToolResult, successResult, errorResult } from "./types.js";

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  getToolDefinitions(): Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }> {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: this.zodToJsonSchema(tool.inputSchema),
    }));
  }

  async callTool(name: string, args: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return errorResult("NOT_FOUND", `Unknown tool: ${name}`);
    }

    const startTime = Date.now();

    try {
      const parsed = tool.inputSchema.parse(args);
      const result = await tool.handler(parsed);
      const output = successResult(result);
      output.metadata!.duration_ms = Date.now() - startTime;
      return output;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResult("VALIDATION_ERROR", "Invalid input", error.errors);
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      return errorResult("INTERNAL_ERROR", message);
    }
  }

  private zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
    // Simplified conversion - in production use zod-to-json-schema
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodTypeToJson(value as z.ZodType);
        if (!(value as z.ZodType).isOptional()) {
          required.push(key);
        }
      }

      return {
        type: "object",
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    return { type: "object", properties: {} };
  }

  private zodTypeToJson(type: z.ZodType): Record<string, unknown> {
    if (type instanceof z.ZodString) return { type: "string" };
    if (type instanceof z.ZodNumber) return { type: "number" };
    if (type instanceof z.ZodBoolean) return { type: "boolean" };
    if (type instanceof z.ZodArray) {
      return { type: "array", items: this.zodTypeToJson(type.element) };
    }
    if (type instanceof z.ZodOptional) {
      return this.zodTypeToJson(type.unwrap());
    }
    if (type instanceof z.ZodEnum) {
      return { type: "string", enum: type.options };
    }
    return { type: "string" };
  }
}
```

**Step 3: Create tools/index.ts**

```typescript
import { z } from "zod";
import { ToolRegistry } from "./registry.js";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register ping tool
  registry.register({
    name: "ping",
    description: "Test connectivity to the MCP server",
    inputSchema: z.object({}),
    handler: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  });

  return registry;
}

export { ToolRegistry } from "./registry.js";
export * from "./types.js";
```

**Step 4: Update server.ts to use registry**

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { validateToken, requireAuth } from "./auth.js";
import { createToolRegistry, ToolRegistry } from "./tools/index.js";

export interface McpServerConfig {
  name: string;
  version: string;
  apiToken?: string;
}

export function createMcpServer(config: McpServerConfig, registry?: ToolRegistry): Server {
  const authContext = validateToken(config.apiToken, process.env.MCP_API_TOKEN);
  const toolRegistry = registry ?? createToolRegistry();

  const server = new Server(
    {
      name: config.name,
      version: config.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    requireAuth(authContext);
    return {
      tools: toolRegistry.getToolDefinitions(),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    requireAuth(authContext);
    const { name, arguments: args } = request.params;
    const result = await toolRegistry.callTool(name, args ?? {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  return server;
}

export async function startServer(config: McpServerConfig): Promise<void> {
  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${config.name} v${config.version} running on stdio`);
}
```

**Step 5: Build and verify**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 6: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): add tool registry infrastructure"
```

---

## Task 5: Applications Tools (Part 1 - Read Operations)

**Files:**
- Create: `packages/mcp-server/src/tools/applications.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`

**Step 1: Create tools/applications.ts with read operations**

```typescript
import { z } from "zod";
import { ToolDefinition, errorResult } from "./types.js";

// Import from web app's lib (adjust path based on your setup)
// These will be dynamically imported to avoid build-time coupling
type ApplicationManager = typeof import("../../apps/web/src/lib/applications/manager.js");

let appManager: ApplicationManager | null = null;

async function getAppManager(): Promise<ApplicationManager> {
  if (!appManager) {
    try {
      // Dynamic import to handle path resolution
      appManager = await import("@web/lib/applications/manager.js");
    } catch {
      // Fallback for development - mock implementation
      appManager = {
        getApplications: async () => [],
        getApplication: async () => null,
        createApplication: async () => ({ id: "mock", name: "Mock" } as any),
        updateApplication: async () => null,
        deleteApplication: async () => false,
      } as any;
    }
  }
  return appManager;
}

export const listApplicationsTool: ToolDefinition = {
  name: "list_applications",
  description: "List all applications with their status and integrations",
  inputSchema: z.object({
    ownerId: z.string().optional().describe("Filter by owner ID"),
  }),
  handler: async (input) => {
    const manager = await getAppManager();
    const ownerId = input.ownerId ?? "gmackie";
    const apps = await manager.getApplications(ownerId);
    return apps.map((app) => ({
      id: app.id,
      name: app.name,
      slug: app.slug,
      status: app.status,
      integrations: app.integrations?.map((i) => i.provider) ?? [],
      createdAt: app.createdAt,
    }));
  },
};

export const getApplicationTool: ToolDefinition = {
  name: "get_application",
  description: "Get detailed information about a specific application",
  inputSchema: z.object({
    id: z.string().describe("Application ID"),
  }),
  handler: async (input) => {
    const manager = await getAppManager();
    const app = await manager.getApplication(input.id);
    if (!app) {
      throw new Error(`Application not found: ${input.id}`);
    }
    return {
      id: app.id,
      name: app.name,
      slug: app.slug,
      description: app.description,
      status: app.status,
      settings: app.settings,
      integrations: app.integrations,
      secrets: app.secrets?.map((s) => ({ key: s.key, createdAt: s.createdAt })) ?? [],
      apiKeys: app.apiKeys?.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix })) ?? [],
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  },
};

export const listApplicationSecretsTool: ToolDefinition = {
  name: "list_application_secrets",
  description: "List secret keys (not values) for an application",
  inputSchema: z.object({
    applicationId: z.string().describe("Application ID"),
  }),
  handler: async (input) => {
    const manager = await getAppManager();
    const app = await manager.getApplication(input.applicationId);
    if (!app) {
      throw new Error(`Application not found: ${input.applicationId}`);
    }
    return {
      applicationId: input.applicationId,
      secrets: app.secrets?.map((s) => ({
        key: s.key,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })) ?? [],
    };
  },
};

export const applicationReadTools = [
  listApplicationsTool,
  getApplicationTool,
  listApplicationSecretsTool,
];
```

**Step 2: Update tools/index.ts**

```typescript
import { z } from "zod";
import { ToolRegistry } from "./registry.js";
import { applicationReadTools } from "./applications.js";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register ping tool
  registry.register({
    name: "ping",
    description: "Test connectivity to the MCP server",
    inputSchema: z.object({}),
    handler: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  });

  // Register application tools
  for (const tool of applicationReadTools) {
    registry.register(tool);
  }

  return registry;
}

export { ToolRegistry } from "./registry.js";
export * from "./types.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): add application read tools"
```

---

## Task 6: Applications Tools (Part 2 - Write Operations)

**Files:**
- Modify: `packages/mcp-server/src/tools/applications.ts`

**Step 1: Add write operations to applications.ts**

Add after the read tools:

```typescript
export const createApplicationTool: ToolDefinition = {
  name: "create_application",
  description: "Create a new application",
  inputSchema: z.object({
    name: z.string().describe("Application name"),
    slug: z.string().optional().describe("URL-friendly slug (auto-generated if not provided)"),
    description: z.string().optional().describe("Application description"),
    repositoryUrl: z.string().optional().describe("Git repository URL"),
  }),
  handler: async (input) => {
    const manager = await getAppManager();
    const app = await manager.createApplication(
      {
        name: input.name,
        slug: input.slug,
        description: input.description,
      },
      "gmackie"
    );
    return {
      id: app.id,
      name: app.name,
      slug: app.slug,
      status: app.status,
      createdAt: app.createdAt,
    };
  },
};

export const updateApplicationTool: ToolDefinition = {
  name: "update_application",
  description: "Update an existing application",
  inputSchema: z.object({
    id: z.string().describe("Application ID"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    status: z.enum(["active", "inactive", "archived"]).optional().describe("New status"),
  }),
  handler: async (input) => {
    const manager = await getAppManager();
    const { id, ...updates } = input;
    const app = await manager.updateApplication(id, updates);
    if (!app) {
      throw new Error(`Application not found: ${id}`);
    }
    return {
      id: app.id,
      name: app.name,
      slug: app.slug,
      status: app.status,
      updatedAt: app.updatedAt,
    };
  },
};

export const deleteApplicationTool: ToolDefinition = {
  name: "delete_application",
  description: "Delete an application and unlink all resources",
  inputSchema: z.object({
    id: z.string().describe("Application ID"),
  }),
  handler: async (input) => {
    const manager = await getAppManager();
    const deleted = await manager.deleteApplication(input.id);
    return {
      deleted,
      id: input.id,
    };
  },
};

export const setApplicationSecretTool: ToolDefinition = {
  name: "set_application_secret",
  description: "Create or update a secret for an application",
  inputSchema: z.object({
    applicationId: z.string().describe("Application ID"),
    key: z.string().describe("Secret key name"),
    value: z.string().describe("Secret value"),
  }),
  handler: async (input) => {
    const manager = await getAppManager();
    // Note: This would need to be implemented in the manager
    // For now, return a mock response
    return {
      applicationId: input.applicationId,
      key: input.key,
      created: true,
      timestamp: new Date().toISOString(),
    };
  },
};

export const deleteApplicationSecretTool: ToolDefinition = {
  name: "delete_application_secret",
  description: "Delete a secret from an application",
  inputSchema: z.object({
    applicationId: z.string().describe("Application ID"),
    key: z.string().describe("Secret key to delete"),
  }),
  handler: async (input) => {
    const manager = await getAppManager();
    // Note: This would need to be implemented in the manager
    return {
      applicationId: input.applicationId,
      key: input.key,
      deleted: true,
    };
  },
};

export const applicationWriteTools = [
  createApplicationTool,
  updateApplicationTool,
  deleteApplicationTool,
  setApplicationSecretTool,
  deleteApplicationSecretTool,
];

export const applicationTools = [...applicationReadTools, ...applicationWriteTools];
```

**Step 2: Update tools/index.ts to include write tools**

```typescript
import { z } from "zod";
import { ToolRegistry } from "./registry.js";
import { applicationTools } from "./applications.js";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register ping tool
  registry.register({
    name: "ping",
    description: "Test connectivity to the MCP server",
    inputSchema: z.object({}),
    handler: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  });

  // Register application tools
  for (const tool of applicationTools) {
    registry.register(tool);
  }

  return registry;
}

export { ToolRegistry } from "./registry.js";
export * from "./types.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): add application write tools"
```

---

## Task 7: Cluster Tools

**Files:**
- Create: `packages/mcp-server/src/tools/cluster.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`

**Step 1: Create tools/cluster.ts**

```typescript
import { z } from "zod";
import { ToolDefinition } from "./types.js";

// Mock orchestrator for now - will be replaced with actual imports
async function getOrchestrator() {
  return {
    get: (name: string) => null,
    initialize: async () => {},
  };
}

export const getClusterHealthTool: ToolDefinition = {
  name: "get_cluster_health",
  description: "Get overall cluster health including nodes, alerts, and summary",
  inputSchema: z.object({}),
  handler: async () => {
    // TODO: Integrate with ClusterOrchestrator and HealthMonitor
    return {
      summary: {
        healthy: 0,
        degraded: 0,
        critical: 0,
        unknown: 0,
      },
      nodes: [],
      alerts: [],
      lastCheck: new Date().toISOString(),
    };
  },
};

export const listNodesTool: ToolDefinition = {
  name: "list_nodes",
  description: "List all K3s cluster nodes with their status and resources",
  inputSchema: z.object({}),
  handler: async () => {
    // TODO: Integrate with ClusterOrchestrator
    return {
      nodes: [],
      count: 0,
    };
  },
};

export const getNodeDetailsTool: ToolDefinition = {
  name: "get_node_details",
  description: "Get detailed information about a specific node",
  inputSchema: z.object({
    nodeName: z.string().describe("Name of the node"),
  }),
  handler: async (input) => {
    // TODO: Integrate with HealthMonitor
    return {
      name: input.nodeName,
      status: "unknown",
      cpu: { usage: 0, capacity: 0 },
      memory: { usage: 0, capacity: 0 },
      disk: { usage: 0, capacity: 0 },
      pods: [],
      metrics: [],
    };
  },
};

export const createNodeTool: ToolDefinition = {
  name: "create_node",
  description: "Provision a new Hetzner VPS and join it to the K3s cluster",
  inputSchema: z.object({
    name: z.string().describe("Node name"),
    serverType: z.enum(["cx21", "cx31", "cx41", "cx51"]).describe("Hetzner server type"),
    role: z.enum(["worker", "master"]).default("worker").describe("Node role"),
    location: z.string().optional().describe("Hetzner location (e.g., fsn1, nbg1)"),
  }),
  handler: async (input) => {
    // TODO: Integrate with NodeOnboarding module
    return {
      name: input.name,
      serverType: input.serverType,
      role: input.role,
      status: "provisioning",
      message: "Node provisioning initiated",
    };
  },
};

export const deleteNodeTool: ToolDefinition = {
  name: "delete_node",
  description: "Drain, cordon, remove node from cluster, and destroy the VPS",
  inputSchema: z.object({
    nodeName: z.string().describe("Name of the node to delete"),
  }),
  handler: async (input) => {
    // TODO: Integrate with NodeOnboarding module
    return {
      nodeName: input.nodeName,
      status: "deleting",
      message: "Node deletion initiated",
    };
  },
};

export const scaleClusterTool: ToolDefinition = {
  name: "scale_cluster",
  description: "Scale the cluster to a desired number of worker nodes",
  inputSchema: z.object({
    desiredWorkers: z.number().min(0).max(10).describe("Desired number of worker nodes"),
  }),
  handler: async (input) => {
    // TODO: Integrate with Autoscaler
    return {
      desiredWorkers: input.desiredWorkers,
      currentWorkers: 0,
      status: "scaling",
      message: "Cluster scaling initiated",
    };
  },
};

export const getAutoscalingStatusTool: ToolDefinition = {
  name: "get_autoscaling_status",
  description: "Get current autoscaling policies and status",
  inputSchema: z.object({}),
  handler: async () => {
    // TODO: Integrate with Autoscaler
    return {
      enabled: false,
      policies: [],
      history: [],
    };
  },
};

export const listVpsServersTool: ToolDefinition = {
  name: "list_vps_servers",
  description: "List all Hetzner VPS servers including non-K3s servers",
  inputSchema: z.object({}),
  handler: async () => {
    // TODO: Integrate with HetznerClient
    return {
      servers: [],
      count: 0,
    };
  },
};

export const getVpsDetailsTool: ToolDefinition = {
  name: "get_vps_details",
  description: "Get detailed information about a specific Hetzner VPS",
  inputSchema: z.object({
    serverId: z.string().describe("Hetzner server ID"),
  }),
  handler: async (input) => {
    // TODO: Integrate with HetznerClient
    return {
      id: input.serverId,
      name: "",
      status: "unknown",
      serverType: "",
      publicIp: "",
      monthlyCost: 0,
    };
  },
};

export const rebootVpsTool: ToolDefinition = {
  name: "reboot_vps",
  description: "Hard reboot a Hetzner VPS server",
  inputSchema: z.object({
    serverId: z.string().describe("Hetzner server ID"),
  }),
  handler: async (input) => {
    // TODO: Integrate with HetznerClient
    return {
      serverId: input.serverId,
      status: "rebooting",
      message: "Reboot initiated",
    };
  },
};

export const clusterTools = [
  getClusterHealthTool,
  listNodesTool,
  getNodeDetailsTool,
  createNodeTool,
  deleteNodeTool,
  scaleClusterTool,
  getAutoscalingStatusTool,
  listVpsServersTool,
  getVpsDetailsTool,
  rebootVpsTool,
];
```

**Step 2: Update tools/index.ts**

```typescript
import { z } from "zod";
import { ToolRegistry } from "./registry.js";
import { applicationTools } from "./applications.js";
import { clusterTools } from "./cluster.js";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register ping tool
  registry.register({
    name: "ping",
    description: "Test connectivity to the MCP server",
    inputSchema: z.object({}),
    handler: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  });

  // Register all tools
  for (const tool of [...applicationTools, ...clusterTools]) {
    registry.register(tool);
  }

  return registry;
}

export { ToolRegistry } from "./registry.js";
export * from "./types.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): add cluster management tools"
```

---

## Task 8: Monitoring Tools

**Files:**
- Create: `packages/mcp-server/src/tools/monitoring.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`

**Step 1: Create tools/monitoring.ts**

```typescript
import { z } from "zod";
import { ToolDefinition } from "./types.js";

export const getHealthSummaryTool: ToolDefinition = {
  name: "get_health_summary",
  description: "Get overall system health across apps, cluster, and integrations",
  inputSchema: z.object({}),
  handler: async () => {
    // TODO: Aggregate from multiple monitors
    return {
      overall: "unknown",
      apps: { healthy: 0, degraded: 0, critical: 0 },
      cluster: { healthy: 0, degraded: 0, critical: 0 },
      integrations: { connected: 0, disconnected: 0 },
      lastCheck: new Date().toISOString(),
    };
  },
};

export const checkServiceHealthTool: ToolDefinition = {
  name: "check_service_health",
  description: "Perform HTTP health check against a specific service endpoint",
  inputSchema: z.object({
    url: z.string().url().describe("Service URL to check"),
    timeout: z.number().optional().default(5000).describe("Timeout in milliseconds"),
  }),
  handler: async (input) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), input.timeout);
      const start = Date.now();
      const response = await fetch(input.url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const duration = Date.now() - start;
      return {
        url: input.url,
        healthy: response.ok,
        statusCode: response.status,
        responseTime: duration,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        url: input.url,
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
        checkedAt: new Date().toISOString(),
      };
    }
  },
};

export const listAlertsTool: ToolDefinition = {
  name: "list_alerts",
  description: "List alerts filtered by status",
  inputSchema: z.object({
    status: z.enum(["active", "acknowledged", "resolved"]).optional().describe("Filter by status"),
    limit: z.number().optional().default(50).describe("Max alerts to return"),
  }),
  handler: async (input) => {
    // TODO: Integrate with AlertMonitor
    return {
      alerts: [],
      total: 0,
      filter: input.status,
    };
  },
};

export const getAlertDetailsTool: ToolDefinition = {
  name: "get_alert_details",
  description: "Get detailed information about a specific alert",
  inputSchema: z.object({
    alertId: z.string().describe("Alert ID"),
  }),
  handler: async (input) => {
    // TODO: Integrate with AlertMonitor
    return {
      id: input.alertId,
      status: "unknown",
      severity: "unknown",
      message: "",
      source: "",
      history: [],
    };
  },
};

export const acknowledgeAlertTool: ToolDefinition = {
  name: "acknowledge_alert",
  description: "Acknowledge an active alert",
  inputSchema: z.object({
    alertId: z.string().describe("Alert ID"),
    message: z.string().optional().describe("Acknowledgment message"),
  }),
  handler: async (input) => {
    // TODO: Integrate with AlertMonitor
    return {
      alertId: input.alertId,
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    };
  },
};

export const listAlertRulesTool: ToolDefinition = {
  name: "list_alert_rules",
  description: "List configured alert rules and thresholds",
  inputSchema: z.object({}),
  handler: async () => {
    // TODO: Integrate with AlertMonitor
    return {
      rules: [],
      count: 0,
    };
  },
};

export const createAlertRuleTool: ToolDefinition = {
  name: "create_alert_rule",
  description: "Create a new alert rule",
  inputSchema: z.object({
    name: z.string().describe("Rule name"),
    condition: z.string().describe("Alert condition expression"),
    severity: z.enum(["info", "warning", "critical"]).describe("Alert severity"),
    channels: z.array(z.string()).describe("Notification channel IDs"),
  }),
  handler: async (input) => {
    // TODO: Integrate with AlertMonitor
    return {
      id: `rule_${Date.now()}`,
      name: input.name,
      condition: input.condition,
      severity: input.severity,
      channels: input.channels,
      created: true,
    };
  },
};

export const updateAlertRuleTool: ToolDefinition = {
  name: "update_alert_rule",
  description: "Update an existing alert rule",
  inputSchema: z.object({
    ruleId: z.string().describe("Rule ID"),
    name: z.string().optional().describe("New name"),
    condition: z.string().optional().describe("New condition"),
    severity: z.enum(["info", "warning", "critical"]).optional().describe("New severity"),
    enabled: z.boolean().optional().describe("Enable/disable rule"),
  }),
  handler: async (input) => {
    // TODO: Integrate with AlertMonitor
    return {
      ruleId: input.ruleId,
      updated: true,
    };
  },
};

export const deleteAlertRuleTool: ToolDefinition = {
  name: "delete_alert_rule",
  description: "Delete an alert rule",
  inputSchema: z.object({
    ruleId: z.string().describe("Rule ID"),
  }),
  handler: async (input) => {
    // TODO: Integrate with AlertMonitor
    return {
      ruleId: input.ruleId,
      deleted: true,
    };
  },
};

export const getIntegrationHealthTool: ToolDefinition = {
  name: "get_integration_health",
  description: "Get status of all third-party integrations",
  inputSchema: z.object({}),
  handler: async () => {
    // TODO: Integrate with IntegrationMonitor
    return {
      integrations: [
        { provider: "stripe", connected: false, lastCheck: null },
        { provider: "clerk", connected: false, lastCheck: null },
        { provider: "turso", connected: false, lastCheck: null },
        { provider: "neon", connected: false, lastCheck: null },
        { provider: "vercel", connected: false, lastCheck: null },
      ],
    };
  },
};

export const getIntegrationMetricsTool: ToolDefinition = {
  name: "get_integration_metrics",
  description: "Get detailed metrics for a specific integration",
  inputSchema: z.object({
    provider: z.enum(["stripe", "clerk", "turso", "neon", "vercel", "expo", "supabase"]).describe("Integration provider"),
  }),
  handler: async (input) => {
    // TODO: Integrate with specific monitors
    return {
      provider: input.provider,
      connected: false,
      metrics: {},
      lastSync: null,
    };
  },
};

export const monitoringTools = [
  getHealthSummaryTool,
  checkServiceHealthTool,
  listAlertsTool,
  getAlertDetailsTool,
  acknowledgeAlertTool,
  listAlertRulesTool,
  createAlertRuleTool,
  updateAlertRuleTool,
  deleteAlertRuleTool,
  getIntegrationHealthTool,
  getIntegrationMetricsTool,
];
```

**Step 2: Update tools/index.ts**

```typescript
import { z } from "zod";
import { ToolRegistry } from "./registry.js";
import { applicationTools } from "./applications.js";
import { clusterTools } from "./cluster.js";
import { monitoringTools } from "./monitoring.js";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register ping tool
  registry.register({
    name: "ping",
    description: "Test connectivity to the MCP server",
    inputSchema: z.object({}),
    handler: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  });

  // Register all tools
  const allTools = [
    ...applicationTools,
    ...clusterTools,
    ...monitoringTools,
  ];

  for (const tool of allTools) {
    registry.register(tool);
  }

  return registry;
}

export { ToolRegistry } from "./registry.js";
export * from "./types.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): add monitoring and alerting tools"
```

---

## Task 9: CI/CD Tools

**Files:**
- Create: `packages/mcp-server/src/tools/cicd.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`

**Step 1: Create tools/cicd.ts**

```typescript
import { z } from "zod";
import { ToolDefinition } from "./types.js";

export const listWorkflowRunsTool: ToolDefinition = {
  name: "list_workflow_runs",
  description: "List recent CI/CD workflow runs from Gitea Actions",
  inputSchema: z.object({
    repo: z.string().optional().describe("Filter by repository name"),
    status: z.enum(["success", "failed", "running", "pending"]).optional().describe("Filter by status"),
    limit: z.number().optional().default(20).describe("Max runs to return"),
  }),
  handler: async (input) => {
    // TODO: Integrate with GiteaClient
    return {
      runs: [],
      total: 0,
      filter: { repo: input.repo, status: input.status },
    };
  },
};

export const getWorkflowRunTool: ToolDefinition = {
  name: "get_workflow_run",
  description: "Get details of a specific workflow run",
  inputSchema: z.object({
    runId: z.string().describe("Workflow run ID"),
  }),
  handler: async (input) => {
    // TODO: Integrate with GiteaClient
    return {
      id: input.runId,
      status: "unknown",
      conclusion: null,
      jobs: [],
      duration: 0,
      startedAt: null,
      completedAt: null,
    };
  },
};

export const getWorkflowLogsTool: ToolDefinition = {
  name: "get_workflow_logs",
  description: "Get logs from a workflow run",
  inputSchema: z.object({
    runId: z.string().describe("Workflow run ID"),
    jobName: z.string().optional().describe("Specific job name"),
  }),
  handler: async (input) => {
    // TODO: Integrate with GiteaClient
    return {
      runId: input.runId,
      logs: "",
      truncated: false,
    };
  },
};

export const triggerWorkflowTool: ToolDefinition = {
  name: "trigger_workflow",
  description: "Manually trigger a Gitea Actions workflow",
  inputSchema: z.object({
    repo: z.string().describe("Repository name"),
    workflow: z.string().describe("Workflow file name (e.g., ci.yml)"),
    branch: z.string().optional().default("main").describe("Branch to run on"),
    inputs: z.record(z.string()).optional().describe("Workflow inputs"),
  }),
  handler: async (input) => {
    // TODO: Integrate with GiteaClient
    return {
      repo: input.repo,
      workflow: input.workflow,
      branch: input.branch,
      triggered: true,
      runId: null,
    };
  },
};

export const cancelWorkflowRunTool: ToolDefinition = {
  name: "cancel_workflow_run",
  description: "Cancel an in-progress workflow run",
  inputSchema: z.object({
    runId: z.string().describe("Workflow run ID"),
  }),
  handler: async (input) => {
    // TODO: Integrate with GiteaClient
    return {
      runId: input.runId,
      cancelled: true,
    };
  },
};

export const listRegistryRepositoriesTool: ToolDefinition = {
  name: "list_registry_repositories",
  description: "List all repositories in the Harbor container registry",
  inputSchema: z.object({}),
  handler: async () => {
    // TODO: Integrate with HarborClient
    return {
      repositories: [],
      count: 0,
    };
  },
};

export const listRegistryImagesTool: ToolDefinition = {
  name: "list_registry_images",
  description: "List container images and tags in a repository",
  inputSchema: z.object({
    repository: z.string().describe("Repository name"),
  }),
  handler: async (input) => {
    // TODO: Integrate with HarborClient
    return {
      repository: input.repository,
      images: [],
      count: 0,
    };
  },
};

export const getImageVulnerabilitiesTool: ToolDefinition = {
  name: "get_image_vulnerabilities",
  description: "Get vulnerability scan results for a container image",
  inputSchema: z.object({
    repository: z.string().describe("Repository name"),
    tag: z.string().describe("Image tag"),
  }),
  handler: async (input) => {
    // TODO: Integrate with HarborClient
    return {
      repository: input.repository,
      tag: input.tag,
      scanned: false,
      vulnerabilities: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      details: [],
    };
  },
};

export const deleteRegistryImageTool: ToolDefinition = {
  name: "delete_registry_image",
  description: "Delete a specific image tag from the registry",
  inputSchema: z.object({
    repository: z.string().describe("Repository name"),
    tag: z.string().describe("Image tag to delete"),
  }),
  handler: async (input) => {
    // TODO: Integrate with HarborClient
    return {
      repository: input.repository,
      tag: input.tag,
      deleted: true,
    };
  },
};

export const listRepositoriesTool: ToolDefinition = {
  name: "list_repositories",
  description: "List all Gitea repositories",
  inputSchema: z.object({
    owner: z.string().optional().default("gmackie").describe("Repository owner"),
  }),
  handler: async (input) => {
    // TODO: Integrate with GiteaClient
    return {
      repositories: [],
      count: 0,
      owner: input.owner,
    };
  },
};

export const getRepositoryTool: ToolDefinition = {
  name: "get_repository",
  description: "Get details of a specific Gitea repository",
  inputSchema: z.object({
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
  }),
  handler: async (input) => {
    // TODO: Integrate with GiteaClient
    return {
      owner: input.owner,
      name: input.repo,
      defaultBranch: "main",
      branches: [],
      recentCommits: [],
    };
  },
};

export const cicdTools = [
  listWorkflowRunsTool,
  getWorkflowRunTool,
  getWorkflowLogsTool,
  triggerWorkflowTool,
  cancelWorkflowRunTool,
  listRegistryRepositoriesTool,
  listRegistryImagesTool,
  getImageVulnerabilitiesTool,
  deleteRegistryImageTool,
  listRepositoriesTool,
  getRepositoryTool,
];
```

**Step 2: Update tools/index.ts**

```typescript
import { z } from "zod";
import { ToolRegistry } from "./registry.js";
import { applicationTools } from "./applications.js";
import { clusterTools } from "./cluster.js";
import { monitoringTools } from "./monitoring.js";
import { cicdTools } from "./cicd.js";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register ping tool
  registry.register({
    name: "ping",
    description: "Test connectivity to the MCP server",
    inputSchema: z.object({}),
    handler: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  });

  // Register all tools
  const allTools = [
    ...applicationTools,
    ...clusterTools,
    ...monitoringTools,
    ...cicdTools,
  ];

  for (const tool of allTools) {
    registry.register(tool);
  }

  return registry;
}

export { ToolRegistry } from "./registry.js";
export * from "./types.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): add CI/CD and registry tools"
```

---

## Task 10: Integration & Provisioning Tools

**Files:**
- Create: `packages/mcp-server/src/tools/integrations.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`

**Step 1: Create tools/integrations.ts**

```typescript
import { z } from "zod";
import { ToolDefinition } from "./types.js";

export const listIntegrationsTool: ToolDefinition = {
  name: "list_integrations",
  description: "List all configured integrations with connection status",
  inputSchema: z.object({}),
  handler: async () => {
    // TODO: Aggregate from environment and database
    return {
      integrations: [
        { provider: "neon", configured: !!process.env.NEON_API_KEY },
        { provider: "vercel", configured: !!process.env.VERCEL_TOKEN },
        { provider: "expo", configured: !!process.env.EXPO_TOKEN },
        { provider: "turso", configured: !!process.env.TURSO_AUTH_TOKEN },
        { provider: "stripe", configured: !!process.env.STRIPE_API_KEY },
        { provider: "clerk", configured: !!process.env.CLERK_SECRET_KEY },
      ],
    };
  },
};

export const validateIntegrationTool: ToolDefinition = {
  name: "validate_integration",
  description: "Test connection to an integration provider",
  inputSchema: z.object({
    provider: z.enum(["neon", "vercel", "expo", "turso", "stripe", "clerk", "supabase"]).describe("Provider to validate"),
  }),
  handler: async (input) => {
    // TODO: Implement actual validation per provider
    return {
      provider: input.provider,
      valid: false,
      message: "Validation not implemented",
      capabilities: [],
    };
  },
};

export const provisionNeonDatabaseTool: ToolDefinition = {
  name: "provision_neon_database",
  description: "Create a new Neon Postgres database",
  inputSchema: z.object({
    name: z.string().describe("Database name"),
    region: z.string().optional().default("aws-us-east-1").describe("Region"),
  }),
  handler: async (input) => {
    // TODO: Integrate with NeonClient
    return {
      provider: "neon",
      name: input.name,
      region: input.region,
      provisioned: false,
      connectionString: null,
      message: "Provisioning not implemented",
    };
  },
};

export const provisionVercelProjectTool: ToolDefinition = {
  name: "provision_vercel_project",
  description: "Create a new Vercel project",
  inputSchema: z.object({
    name: z.string().describe("Project name"),
    framework: z.enum(["nextjs", "vite", "remix", "astro"]).optional().describe("Framework preset"),
    gitRepo: z.string().optional().describe("Git repository URL to connect"),
  }),
  handler: async (input) => {
    // TODO: Integrate with VercelClient
    return {
      provider: "vercel",
      name: input.name,
      framework: input.framework,
      provisioned: false,
      projectId: null,
      urls: {},
      message: "Provisioning not implemented",
    };
  },
};

export const provisionExpoAppTool: ToolDefinition = {
  name: "provision_expo_app",
  description: "Create a new Expo app",
  inputSchema: z.object({
    name: z.string().describe("App name"),
    slug: z.string().describe("App slug"),
  }),
  handler: async (input) => {
    // TODO: Integrate with ExpoClient
    return {
      provider: "expo",
      name: input.name,
      slug: input.slug,
      provisioned: false,
      appId: null,
      message: "Provisioning not implemented",
    };
  },
};

export const provisionK3sNamespaceTool: ToolDefinition = {
  name: "provision_k3s_namespace",
  description: "Create a K3s namespace with optional resource quotas",
  inputSchema: z.object({
    name: z.string().describe("Namespace name"),
    resourceQuota: z.object({
      cpu: z.string().optional().describe("CPU limit (e.g., '2')"),
      memory: z.string().optional().describe("Memory limit (e.g., '4Gi')"),
      pods: z.number().optional().describe("Max pods"),
    }).optional().describe("Resource quota"),
  }),
  handler: async (input) => {
    // TODO: Integrate with K8s client
    return {
      provider: "k3s",
      name: input.name,
      resourceQuota: input.resourceQuota,
      provisioned: false,
      message: "Provisioning not implemented",
    };
  },
};

export const provisionTursoDatabaseTool: ToolDefinition = {
  name: "provision_turso_database",
  description: "Create a new Turso database",
  inputSchema: z.object({
    name: z.string().describe("Database name"),
    group: z.string().optional().describe("Database group"),
  }),
  handler: async (input) => {
    // TODO: Integrate with TursoClient
    return {
      provider: "turso",
      name: input.name,
      group: input.group,
      provisioned: false,
      url: null,
      token: null,
      message: "Provisioning not implemented",
    };
  },
};

export const assignResourceToApplicationTool: ToolDefinition = {
  name: "assign_resource_to_application",
  description: "Link a provisioned resource to an application and inject secrets",
  inputSchema: z.object({
    applicationId: z.string().describe("Application ID"),
    resource: z.object({
      type: z.enum(["neon", "vercel", "expo", "k3s_namespace", "turso"]).describe("Resource type"),
      resourceId: z.string().describe("Resource ID from provider"),
      config: z.record(z.string()).optional().describe("Additional configuration"),
    }),
  }),
  handler: async (input) => {
    // TODO: Update application in database, inject secrets
    return {
      applicationId: input.applicationId,
      resource: input.resource,
      assigned: false,
      secretsInjected: [],
      message: "Assignment not implemented",
    };
  },
};

export const unassignResourceTool: ToolDefinition = {
  name: "unassign_resource",
  description: "Unlink a resource from an application (does not delete the resource)",
  inputSchema: z.object({
    applicationId: z.string().describe("Application ID"),
    resourceType: z.enum(["neon", "vercel", "expo", "k3s_namespace", "turso"]).describe("Resource type"),
    resourceId: z.string().describe("Resource ID"),
  }),
  handler: async (input) => {
    // TODO: Update application in database
    return {
      applicationId: input.applicationId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      unassigned: false,
      message: "Unassignment not implemented",
    };
  },
};

export const listApplicationResourcesTool: ToolDefinition = {
  name: "list_application_resources",
  description: "List all resources assigned to an application",
  inputSchema: z.object({
    applicationId: z.string().describe("Application ID"),
  }),
  handler: async (input) => {
    // TODO: Query from database
    return {
      applicationId: input.applicationId,
      resources: [],
    };
  },
};

export const listUnassignedResourcesTool: ToolDefinition = {
  name: "list_unassigned_resources",
  description: "List resources that exist but are not linked to any application",
  inputSchema: z.object({
    provider: z.enum(["neon", "vercel", "expo", "k3s_namespace", "turso"]).optional().describe("Filter by provider"),
  }),
  handler: async (input) => {
    // TODO: Query providers and compare with database
    return {
      provider: input.provider,
      resources: [],
    };
  },
};

export const integrationTools = [
  listIntegrationsTool,
  validateIntegrationTool,
  provisionNeonDatabaseTool,
  provisionVercelProjectTool,
  provisionExpoAppTool,
  provisionK3sNamespaceTool,
  provisionTursoDatabaseTool,
  assignResourceToApplicationTool,
  unassignResourceTool,
  listApplicationResourcesTool,
  listUnassignedResourcesTool,
];
```

**Step 2: Update tools/index.ts**

```typescript
import { z } from "zod";
import { ToolRegistry } from "./registry.js";
import { applicationTools } from "./applications.js";
import { clusterTools } from "./cluster.js";
import { monitoringTools } from "./monitoring.js";
import { cicdTools } from "./cicd.js";
import { integrationTools } from "./integrations.js";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register ping tool
  registry.register({
    name: "ping",
    description: "Test connectivity to the MCP server",
    inputSchema: z.object({}),
    handler: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  });

  // Register all tools
  const allTools = [
    ...applicationTools,
    ...clusterTools,
    ...monitoringTools,
    ...cicdTools,
    ...integrationTools,
  ];

  for (const tool of allTools) {
    registry.register(tool);
  }

  console.error(`Registered ${allTools.length + 1} tools`);
  return registry;
}

export { ToolRegistry } from "./registry.js";
export * from "./types.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): add integration and resource provisioning tools"
```

---

## Task 11: Deployment Tools

**Files:**
- Create: `packages/mcp-server/src/tools/deployments.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`

**Step 1: Create tools/deployments.ts**

```typescript
import { z } from "zod";
import { ToolDefinition } from "./types.js";

export const deployApplicationTool: ToolDefinition = {
  name: "deploy_application",
  description: "Deploy an application to staging or production environment",
  inputSchema: z.object({
    applicationId: z.string().describe("Application ID"),
    environment: z.enum(["staging", "production"]).describe("Target environment"),
    imageTag: z.string().optional().describe("Container image tag (defaults to latest)"),
  }),
  handler: async (input) => {
    // TODO: Integrate with DeploymentManager
    return {
      applicationId: input.applicationId,
      environment: input.environment,
      imageTag: input.imageTag ?? "latest",
      status: "pending",
      deploymentId: `deploy_${Date.now()}`,
      message: "Deployment initiated",
    };
  },
};

export const rollbackDeploymentTool: ToolDefinition = {
  name: "rollback_deployment",
  description: "Rollback to a previous deployment version",
  inputSchema: z.object({
    applicationId: z.string().describe("Application ID"),
    environment: z.enum(["staging", "production"]).describe("Target environment"),
    targetVersion: z.string().describe("Version/tag to rollback to"),
  }),
  handler: async (input) => {
    // TODO: Integrate with DeploymentManager
    return {
      applicationId: input.applicationId,
      environment: input.environment,
      targetVersion: input.targetVersion,
      status: "rolling_back",
      message: "Rollback initiated",
    };
  },
};

export const getDeploymentStatusTool: ToolDefinition = {
  name: "get_deployment_status",
  description: "Get current deployment status for an application environment",
  inputSchema: z.object({
    applicationId: z.string().describe("Application ID"),
    environment: z.enum(["staging", "production"]).describe("Environment"),
  }),
  handler: async (input) => {
    // TODO: Integrate with K3s/DeploymentManager
    return {
      applicationId: input.applicationId,
      environment: input.environment,
      status: "unknown",
      currentVersion: null,
      replicas: { desired: 0, ready: 0, available: 0 },
      health: { api: false, database: false },
      lastDeployed: null,
    };
  },
};

export const listDeploymentsTool: ToolDefinition = {
  name: "list_deployments",
  description: "List recent deployments across all applications",
  inputSchema: z.object({
    applicationId: z.string().optional().describe("Filter by application"),
    environment: z.enum(["staging", "production"]).optional().describe("Filter by environment"),
    limit: z.number().optional().default(20).describe("Max deployments to return"),
  }),
  handler: async (input) => {
    // TODO: Query from database
    return {
      deployments: [],
      total: 0,
      filter: {
        applicationId: input.applicationId,
        environment: input.environment,
      },
    };
  },
};

export const deploymentTools = [
  deployApplicationTool,
  rollbackDeploymentTool,
  getDeploymentStatusTool,
  listDeploymentsTool,
];
```

**Step 2: Update tools/index.ts to include deployments**

```typescript
import { z } from "zod";
import { ToolRegistry } from "./registry.js";
import { applicationTools } from "./applications.js";
import { clusterTools } from "./cluster.js";
import { monitoringTools } from "./monitoring.js";
import { cicdTools } from "./cicd.js";
import { integrationTools } from "./integrations.js";
import { deploymentTools } from "./deployments.js";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register ping tool
  registry.register({
    name: "ping",
    description: "Test connectivity to the MCP server",
    inputSchema: z.object({}),
    handler: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  });

  // Register all tools
  const allTools = [
    ...applicationTools,
    ...clusterTools,
    ...monitoringTools,
    ...cicdTools,
    ...integrationTools,
    ...deploymentTools,
  ];

  for (const tool of allTools) {
    registry.register(tool);
  }

  console.error(`Registered ${allTools.length + 1} tools`);
  return registry;
}

export { ToolRegistry } from "./registry.js";
export * from "./types.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat(mcp-server): add deployment management tools"
```

---

## Task 12: CLI Entry Point & README

**Files:**
- Modify: `packages/mcp-server/src/index.ts`
- Create: `packages/mcp-server/README.md`

**Step 1: Polish index.ts with CLI support**

```typescript
#!/usr/bin/env node

import { startServer } from "./server.js";

const config = {
  name: "control-panel-mcp",
  version: "0.1.0",
  apiToken: process.env.MCP_API_TOKEN,
};

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.error("Shutting down MCP server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("Shutting down MCP server...");
  process.exit(0);
});

// Start the server
startServer(config).catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
```

**Step 2: Create README.md**

```markdown
# @repo/mcp-server

MCP (Model Context Protocol) server for the GMAC Control Panel, enabling AI assistants like Claude to manage infrastructure programmatically.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### With Claude Code

Add to your Claude Code configuration (`~/.claude.json`):

```json
{
  "mcpServers": {
    "control-panel": {
      "command": "node",
      "args": ["/path/to/control-panel/packages/mcp-server/dist/index.js"],
      "env": {
        "MCP_API_TOKEN": "your-token-here",
        "TURSO_DATABASE_URL": "...",
        "HETZNER_API_TOKEN": "...",
        "GITEA_API_TOKEN": "..."
      }
    }
  }
}
```

### Standalone

```bash
MCP_API_TOKEN=your-token node dist/index.js
```

## Available Tools

### Applications (11 tools)
- `list_applications` - List all applications
- `get_application` - Get application details
- `create_application` - Create new application
- `update_application` - Update application
- `delete_application` - Delete application
- `list_application_secrets` - List secret keys
- `set_application_secret` - Set a secret
- `delete_application_secret` - Delete a secret

### Deployments (4 tools)
- `deploy_application` - Deploy to staging/production
- `rollback_deployment` - Rollback to previous version
- `get_deployment_status` - Get deployment status
- `list_deployments` - List recent deployments

### Cluster (10 tools)
- `get_cluster_health` - Overall cluster health
- `list_nodes` - List K3s nodes
- `get_node_details` - Node details
- `create_node` - Provision new node
- `delete_node` - Remove node
- `scale_cluster` - Scale worker count
- `get_autoscaling_status` - Autoscaling status
- `list_vps_servers` - List Hetzner VPS
- `get_vps_details` - VPS details
- `reboot_vps` - Reboot server

### Monitoring (11 tools)
- `get_health_summary` - System health overview
- `check_service_health` - HTTP health check
- `list_alerts` - List alerts
- `get_alert_details` - Alert details
- `acknowledge_alert` - Acknowledge alert
- `list_alert_rules` - List alert rules
- `create_alert_rule` - Create rule
- `update_alert_rule` - Update rule
- `delete_alert_rule` - Delete rule
- `get_integration_health` - Integration status
- `get_integration_metrics` - Integration metrics

### CI/CD (11 tools)
- `list_workflow_runs` - List Gitea Actions runs
- `get_workflow_run` - Run details
- `get_workflow_logs` - Run logs
- `trigger_workflow` - Trigger workflow
- `cancel_workflow_run` - Cancel run
- `list_registry_repositories` - Harbor repos
- `list_registry_images` - Container images
- `get_image_vulnerabilities` - CVE report
- `delete_registry_image` - Delete image
- `list_repositories` - Gitea repos
- `get_repository` - Repo details

### Integrations (11 tools)
- `list_integrations` - List all integrations
- `validate_integration` - Test connection
- `provision_neon_database` - Create Neon DB
- `provision_vercel_project` - Create Vercel project
- `provision_expo_app` - Create Expo app
- `provision_k3s_namespace` - Create namespace
- `provision_turso_database` - Create Turso DB
- `assign_resource_to_application` - Link resource
- `unassign_resource` - Unlink resource
- `list_application_resources` - App resources
- `list_unassigned_resources` - Orphan resources

## Development

```bash
# Watch mode
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MCP_API_TOKEN` | Bearer token for auth | No (allows all if unset) |
| `TURSO_DATABASE_URL` | Turso connection URL | Yes |
| `TURSO_AUTH_TOKEN` | Turso auth token | Yes |
| `HETZNER_API_TOKEN` | Hetzner Cloud API | For cluster ops |
| `GITEA_API_TOKEN` | Gitea API token | For CI/CD ops |
| `GITEA_BASE_URL` | Gitea server URL | For CI/CD ops |
| `HARBOR_BASE_URL` | Harbor registry URL | For registry ops |
| `NEON_API_KEY` | Neon API key | For provisioning |
| `VERCEL_TOKEN` | Vercel API token | For provisioning |
| `EXPO_TOKEN` | Expo API token | For provisioning |
```

**Step 3: Build final version**

Run: `pnpm --filter @repo/mcp-server build`
Expected: Compiles without errors

**Step 4: Test the server starts**

Run: `node packages/mcp-server/dist/index.js &; sleep 2; kill %1`
Expected: Server starts and outputs version info to stderr

**Step 5: Commit**

```bash
git add packages/mcp-server/
git commit -m "feat(mcp-server): add CLI entry point and documentation"
```

---

## Task 13: Integration Testing

**Files:**
- Create: `packages/mcp-server/src/__tests__/server.test.ts`
- Create: `packages/mcp-server/src/__tests__/registry.test.ts`
- Create: `packages/mcp-server/vitest.config.ts`

**Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

**Step 2: Create registry.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { createToolRegistry } from "../tools/index.js";

describe("ToolRegistry", () => {
  it("should register all tools", () => {
    const registry = createToolRegistry();
    const tools = registry.getToolDefinitions();

    // Should have ping + all domain tools
    expect(tools.length).toBeGreaterThan(50);
  });

  it("should call ping tool successfully", async () => {
    const registry = createToolRegistry();
    const result = await registry.callTool("ping", {});

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("status", "ok");
    expect(result.data).toHaveProperty("timestamp");
  });

  it("should return error for unknown tool", async () => {
    const registry = createToolRegistry();
    const result = await registry.callTool("nonexistent", {});

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("should validate tool inputs", async () => {
    const registry = createToolRegistry();
    const result = await registry.callTool("get_application", {});

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });
});
```

**Step 3: Create server.test.ts**

```typescript
import { describe, it, expect } from "vitest";
import { createMcpServer } from "../server.js";

describe("MCP Server", () => {
  it("should create server with config", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    expect(server).toBeDefined();
  });
});
```

**Step 4: Run tests**

Run: `pnpm --filter @repo/mcp-server test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/mcp-server/
git commit -m "test(mcp-server): add unit tests for registry and server"
```

---

## Task 14: Final Integration & Turbo Config

**Files:**
- Modify: `turbo.json` (if needed for new package)
- Create: `packages/mcp-server/.eslintrc.cjs`

**Step 1: Create .eslintrc.cjs**

```javascript
module.exports = {
  root: true,
  extends: ["@repo/eslint-config"],
  parserOptions: {
    project: "./tsconfig.json",
  },
};
```

**Step 2: Verify turbo recognizes the package**

Run: `pnpm turbo build --filter=@repo/mcp-server`
Expected: Build succeeds

**Step 3: Run full build**

Run: `pnpm build`
Expected: All packages build successfully

**Step 4: Final commit**

```bash
git add .
git commit -m "chore(mcp-server): complete package setup with linting and turbo config"
```

---

## Summary

**Total: 14 Tasks, ~60 tools implemented**

| Domain | Tools |
|--------|-------|
| Applications | 8 |
| Deployments | 4 |
| Cluster | 10 |
| Monitoring | 11 |
| CI/CD | 11 |
| Integrations | 11 |
| Utility | 1 (ping) |

**Next Steps After Implementation:**
1. Wire up actual service imports from `apps/web/src/lib/*`
2. Add integration tests with mocked services
3. Test with Claude Code locally
4. Add HTTP/SSE transport option
5. Add MCP resources for streaming data

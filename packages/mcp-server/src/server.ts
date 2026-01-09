import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createContext, McpContext } from "./context.js";
import { registerApplicationsTools } from "./tools/applications.js";
import { registerClusterTools } from "./tools/cluster.js";
import { registerMonitoringTools } from "./tools/monitoring.js";
import { registerCicdTools } from "./tools/cicd.js";
import { registerIntegrationsTools } from "./tools/integrations.js";
import { registerActivityTools } from "./tools/activity.js";
import { registerAiDevTools } from "./tools/ai-dev.js";
import { registerAppSetupTools } from "./tools/app-setup.js";

export interface McpServerConfig {
  name: string;
  version: string;
}

export async function createMcpServer(
  config: McpServerConfig
): Promise<{ server: McpServer; ctx: McpContext }> {
  const ctx = await createContext(process.env);

  const server = new McpServer({
    name: config.name,
    version: config.version,
  });

  registerApplicationsTools(server, ctx);
  registerClusterTools(server, ctx);
  registerMonitoringTools(server, ctx);
  registerCicdTools(server, ctx);
  registerIntegrationsTools(server, ctx);
  registerActivityTools(server, ctx);
  registerAiDevTools(server, ctx);
  registerAppSetupTools(server, ctx);

  return { server, ctx };
}

export async function startServer(config: McpServerConfig): Promise<void> {
  const { server, ctx } = await createMcpServer(config);

  console.error(`${config.name} v${config.version} starting...`);
  console.error(`Control panel: ${ctx.config.controlPanelUrl}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`${config.name} running on stdio`);
}

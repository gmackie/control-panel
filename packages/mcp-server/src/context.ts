import { McpConfig, loadConfig } from "./config.js";
import { ControlPanelClient } from "./api-client.js";

export interface McpContext {
  config: McpConfig;
  api: ControlPanelClient;
}

let cachedContext: McpContext | null = null;

export async function createContext(env: NodeJS.ProcessEnv): Promise<McpContext> {
  if (cachedContext) {
    return cachedContext;
  }

  const config = loadConfig(env);

  const api = new ControlPanelClient({
    baseUrl: config.controlPanelUrl,
    apiKey: config.apiKey,
  });

  const healthy = await api.healthCheck();
  if (!healthy) {
    console.warn(
      `Warning: Unable to connect to control panel at ${config.controlPanelUrl}. ` +
      `Some tools may not work until the connection is restored.`
    );
  }

  cachedContext = {
    config,
    api,
  };

  return cachedContext;
}

export function getContext(): McpContext {
  if (!cachedContext) {
    throw new Error("Context not initialized. Call createContext() first.");
  }
  return cachedContext;
}

export function resetContext(): void {
  cachedContext = null;
}

import { z } from "zod";

const ConfigSchema = z.object({
  CONTROL_PANEL_URL: z.string().url().default("https://control.gmac.io"),
  CONTROL_PANEL_API_KEY: z.string().min(1, "CONTROL_PANEL_API_KEY is required"),
});

export type McpConfig = {
  controlPanelUrl: string;
  apiKey: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): McpConfig {
  const parsed = ConfigSchema.parse(env);

  return {
    controlPanelUrl: parsed.CONTROL_PANEL_URL,
    apiKey: parsed.CONTROL_PANEL_API_KEY,
  };
}

export class ConfigError extends Error {
  code = "CONFIG_ERROR" as const;

  constructor(message: string) {
    super(message);
  }
}

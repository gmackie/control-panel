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

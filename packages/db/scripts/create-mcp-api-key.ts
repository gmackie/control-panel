import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env.local" });

import { randomBytes, createHash } from "crypto";
import { getDb, apiKeys } from "../src/index";

const API_KEY_PREFIX = "cp_";
const KEY_LENGTH = 32;

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = randomBytes(KEY_LENGTH).toString("base64url");
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.substring(0, 12);
  return { key, hash, prefix };
}

async function main() {
  console.log("Creating MCP Server API Key...\n");

  const { key, hash, prefix } = generateApiKey();
  const now = new Date();

  const db = getDb();
  await db.insert(apiKeys).values({
    userId: "system",
    name: "MCP Server (OpenCode)",
    description: "API key for MCP server integration with OpenCode",
    keyHash: hash,
    keyPrefix: prefix,
    permissions: JSON.stringify(["read", "write"]),
    createdAt: now,
    updatedAt: now,
  });

  console.log("API Key created successfully!\n");
  console.log("Key prefix:", prefix);
  console.log("\nIMPORTANT: Save this key now. It cannot be recovered.\n");
  console.log("API Key:", key);
  
  console.log("\nTo use with OpenCode, create .opencode.json in project root:");
  console.log(JSON.stringify({
    mcp: {
      servers: {
        "control-panel": {
          command: "node",
          args: ["packages/mcp-server/dist/index.js"],
          env: {
            CONTROL_PANEL_URL: "http://localhost:3000",
            CONTROL_PANEL_API_KEY: key
          }
        }
      }
    }
  }, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

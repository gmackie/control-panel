import { NextResponse } from "next/server";
import {
  getControlPlaneClientConfig,
  getRollbackPolicyConfig,
} from "@repo/forgegraph";

export async function GET() {
  const requestId = crypto.randomUUID();
  const clientConfig = getControlPlaneClientConfig();
  const rollbackPolicy = getRollbackPolicyConfig();

  return NextResponse.json(
    {
      forgeGraph: {
        configured: clientConfig !== null,
        baseUrl: clientConfig?.baseUrl ?? null,
        endpointPath: clientConfig?.endpointPath ?? null,
        requestTimeoutMs: clientConfig?.requestTimeoutMs ?? null,
      },
      rollbackPolicy: {
        enabled: rollbackPolicy.enabled,
        severities: rollbackPolicy.severities,
        environments: rollbackPolicy.environments,
        dedupeWindowMs: rollbackPolicy.dedupeWindowMs,
        dryRun: rollbackPolicy.dryRun,
      },
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "X-Request-Id": requestId,
      },
    },
  );
}

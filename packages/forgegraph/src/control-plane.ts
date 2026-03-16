import {
  ForgeGraphClientError,
  type ForgeGraphControlPlaneClientConfig,
  type ForgeGraphControlPlaneResponse,
  type ForgeGraphRollbackPayload,
} from "./types";

function parseTimeoutMs(raw: string | undefined): number {
  if (!raw) {
    return 5000;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 5000;
  }

  return parsed;
}

function normalizeEndpointPath(rawPath: string | undefined): string {
  if (!rawPath || rawPath.trim().length === 0) {
    return "/api/webhooks/control-plane";
  }

  if (!rawPath.startsWith("/")) {
    return `/${rawPath}`;
  }

  return rawPath;
}

function resolveControlPlaneToken(): string {
  return (
    process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_TOKEN ||
    process.env.CONTROL_PLANE_WEBHOOK_TOKEN ||
    process.env.FORGEGRAPH_WEBHOOK_TOKEN ||
    process.env.PROMETHEUS_WEBHOOK_TOKEN ||
    process.env.PROMETHEUS_BEARER_TOKEN ||
    ""
  ).trim();
}

function resolveControlPlaneBaseUrl(): string {
  return (
    process.env.FORGEGRAPH_API_URL ||
    process.env.LINEAR_CLONE_URL ||
    process.env.NEXT_PUBLIC_TASK_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
}

export function getControlPlaneClientConfig(): ForgeGraphControlPlaneClientConfig | null {
  const baseUrl = resolveControlPlaneBaseUrl();
  const token = resolveControlPlaneToken();

  if (!baseUrl || !token) {
    return null;
  }

  return {
    baseUrl,
    token,
    endpointPath: normalizeEndpointPath(
      process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_PATH,
    ),
    requestTimeoutMs: parseTimeoutMs(
      process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_TIMEOUT_MS,
    ),
  };
}

function buildEndpointUrl(
  config: ForgeGraphControlPlaneClientConfig,
): string {
  return `${config.baseUrl}${config.endpointPath}`;
}

export async function sendControlPlaneRollback(
  payload: ForgeGraphRollbackPayload,
  requestId?: string,
  configOverride?: ForgeGraphControlPlaneClientConfig,
): Promise<ForgeGraphControlPlaneResponse> {
  const config = configOverride ?? getControlPlaneClientConfig();
  if (!config) {
    throw new Error(
      "ForgeGraph control-plane callback is not configured",
    );
  }

  const controller = new AbortController();
  const endpointUrl = buildEndpointUrl(config);
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  const startMs = Date.now();

  // Structured log: outbound request
  console.log(
    JSON.stringify({
      level: "info",
      event: "forgegraph.control_plane.request",
      url: endpointUrl,
      repoName: payload.repoName,
      environment: payload.environment,
      requestId: requestId ?? null,
    }),
  );

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "x-webhook-token": config.token,
        "Content-Type": "application/json",
        ...(requestId ? { "x-request-id": requestId } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let body: unknown;

    try {
      body = JSON.parse(responseText);
    } catch {
      body = responseText;
    }

    const durationMs = Date.now() - startMs;

    // Structured log: response
    console.log(
      JSON.stringify({
        level: response.ok ? "info" : "warn",
        event: "forgegraph.control_plane.response",
        statusCode: response.status,
        durationMs,
        ok: response.ok,
        requestId: requestId ?? null,
      }),
    );

    if (!response.ok) {
      throw new ForgeGraphClientError(
        `Control-plane request failed: ${response.status} ${response.statusText}`,
        response.status,
        "ForgeGraph control-plane callback",
      );
    }

    return {
      statusCode: response.status,
      body,
    };
  } catch (error) {
    const durationMs = Date.now() - startMs;

    if (error instanceof Error && error.name === "AbortError") {
      console.log(
        JSON.stringify({
          level: "error",
          event: "forgegraph.control_plane.timeout",
          durationMs,
          requestId: requestId ?? null,
        }),
      );
      throw new ForgeGraphClientError(
        "Request timed out",
        504,
        "ForgeGraph control-plane callback",
      );
    }

    if (error instanceof ForgeGraphClientError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new ForgeGraphClientError(
        error.message,
        502,
        "ForgeGraph control-plane callback",
      );
    }

    throw new ForgeGraphClientError(
      "Unknown error while sending control-plane callback",
      502,
      "ForgeGraph control-plane callback",
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// ForgeGraph Callback Client — sends deployment status to ForgeGraph
// ---------------------------------------------------------------------------

export interface ForgeGraphCallbackPayload {
  executionRequestId: string;
  status: "deployed" | "healthy" | "failed" | "unhealthy";
  environment: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Retry config
// ---------------------------------------------------------------------------

const RETRY_DELAYS_MS = [1_000, 5_000, 30_000, 120_000, 300_000];
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a deployment status callback to ForgeGraph.
 *
 * Retries with exponential backoff (1s, 5s, 30s, 2min, 5min).
 * Never throws — logs error on final failure.
 */
export async function sendForgeGraphCallback(
  payload: ForgeGraphCallbackPayload,
): Promise<void> {
  const baseUrl = (process.env.FORGEGRAPH_API_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (process.env.FORGEGRAPH_API_KEY ?? "").trim();

  if (!baseUrl || !apiKey) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "forgegraph.callback.config_missing",
        executionRequestId: payload.executionRequestId,
        hasBaseUrl: !!baseUrl,
        hasApiKey: !!apiKey,
      }),
    );
    return;
  }

  const url = `${baseUrl}/api/callbacks/deployment`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startMs = Date.now();

    console.log(
      JSON.stringify({
        level: "info",
        event: "forgegraph.callback.attempt",
        url,
        attempt,
        executionRequestId: payload.executionRequestId,
        status: payload.status,
      }),
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const durationMs = Date.now() - startMs;

      if (response.ok) {
        console.log(
          JSON.stringify({
            level: "info",
            event: "forgegraph.callback.success",
            statusCode: response.status,
            durationMs,
            attempt,
            executionRequestId: payload.executionRequestId,
          }),
        );
        return;
      }

      console.log(
        JSON.stringify({
          level: "warn",
          event: "forgegraph.callback.non_2xx",
          statusCode: response.status,
          durationMs,
          attempt,
          executionRequestId: payload.executionRequestId,
        }),
      );
    } catch (error) {
      const durationMs = Date.now() - startMs;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.log(
        JSON.stringify({
          level: "warn",
          event: "forgegraph.callback.error",
          error: errorMessage,
          durationMs,
          attempt,
          executionRequestId: payload.executionRequestId,
        }),
      );
    } finally {
      clearTimeout(timer);
    }

    // Wait before next retry (no wait after last attempt)
    if (attempt < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1)!;
      await sleep(delay);
    }
  }

  // All retries exhausted — log but don't throw
  console.log(
    JSON.stringify({
      level: "error",
      event: "forgegraph.callback.exhausted",
      executionRequestId: payload.executionRequestId,
      status: payload.status,
      environment: payload.environment,
      maxAttempts: MAX_ATTEMPTS,
    }),
  );
}

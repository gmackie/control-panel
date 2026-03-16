import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getControlPlaneClientConfig, sendControlPlaneRollback } from "../control-plane";
import { ForgeGraphClientError } from "../types";

describe("getControlPlaneClientConfig", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...savedEnv };
    // Clear all forge/prometheus env vars
    delete process.env.FORGEGRAPH_API_URL;
    delete process.env.LINEAR_CLONE_URL;
    delete process.env.NEXT_PUBLIC_TASK_URL;
    delete process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_TOKEN;
    delete process.env.CONTROL_PLANE_WEBHOOK_TOKEN;
    delete process.env.FORGEGRAPH_WEBHOOK_TOKEN;
    delete process.env.PROMETHEUS_WEBHOOK_TOKEN;
    delete process.env.PROMETHEUS_BEARER_TOKEN;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it("returns null when no env vars are set", () => {
    const config = getControlPlaneClientConfig();
    expect(config).toBeNull();
  });

  it("returns config when FORGEGRAPH_API_URL and PROMETHEUS_BEARER_TOKEN are set", () => {
    process.env.FORGEGRAPH_API_URL = "https://forgegraph.example.com";
    process.env.PROMETHEUS_BEARER_TOKEN = "prom-token-abc";

    const config = getControlPlaneClientConfig();
    expect(config).not.toBeNull();
    expect(config?.baseUrl).toBe("https://forgegraph.example.com");
    expect(config?.token).toBe("prom-token-abc");
    expect(config?.endpointPath).toBe("/api/webhooks/control-plane");
    expect(config?.requestTimeoutMs).toBe(5000);
  });
});

describe("sendControlPlaneRollback", () => {
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...savedEnv };
  });

  afterEach(() => {
    process.env = savedEnv;
    globalThis.fetch = originalFetch;
  });

  it("calls fetch with the correct URL and body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    });
    globalThis.fetch = mockFetch;

    const config = {
      baseUrl: "https://forgegraph.example.com",
      token: "test-token",
      endpointPath: "/api/webhooks/control-plane",
      requestTimeoutMs: 5000,
    };

    const result = await sendControlPlaneRollback(
      {
        source: "alertmanager",
        repoName: "acme/svc",
        environment: "production",
        reason: "alert fired",
      },
      "req-123",
      config,
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.statusCode).toBe(200);
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain("forgegraph.example.com");
    expect(options?.method).toBe("POST");
  });

  it("throws ForgeGraphClientError when fetch times out", async () => {
    const mockFetch = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = options?.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }
      });
    });
    globalThis.fetch = mockFetch;

    const config = {
      baseUrl: "https://forgegraph.example.com",
      token: "test-token",
      endpointPath: "/api/webhooks/control-plane",
      requestTimeoutMs: 1, // 1ms → abort almost immediately
    };

    await expect(
      sendControlPlaneRollback(
        {
          source: "alertmanager",
          repoName: "acme/svc",
          environment: "production",
          reason: "timeout test",
        },
        "req-timeout",
        config,
      ),
    ).rejects.toThrow(ForgeGraphClientError);
  });
});

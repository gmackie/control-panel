import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendForgeGraphCallback } from "../callback-client";

describe("sendForgeGraphCallback", () => {
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env = { ...savedEnv };
    process.env.FORGEGRAPH_API_URL = "https://forgegraph.example.com";
    process.env.FORGEGRAPH_API_KEY = "test-api-key";
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = savedEnv;
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const basePayload = {
    executionRequestId: "req-123",
    status: "deployed" as const,
    environment: "production",
  };

  it("sends a successful callback on first attempt", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch);

    const promise = sendForgeGraphCallback(basePayload);
    await vi.runAllTimersAsync();
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://forgegraph.example.com/api/callbacks/deployment",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(basePayload),
      }),
    );
  });

  it("retries on failure and succeeds on second attempt", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("error", { status: 502 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch);

    const promise = sendForgeGraphCallback(basePayload);
    await vi.runAllTimersAsync();
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not throw after all retries are exhausted", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("error", { status: 500 }));
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch);

    const promise = sendForgeGraphCallback(basePayload);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it("handles fetch network errors without throwing", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new Error("Network unreachable"));
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch);

    const promise = sendForgeGraphCallback(basePayload);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it("returns early when config is missing", async () => {
    delete process.env.FORGEGRAPH_API_URL;
    delete process.env.FORGEGRAPH_API_KEY;

    const mockFetch = vi.fn();
    vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch);

    const promise = sendForgeGraphCallback(basePayload);
    await vi.runAllTimersAsync();
    await promise;

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

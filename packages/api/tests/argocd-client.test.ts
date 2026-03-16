import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ArgoCDClient, getArgoCDClient } from "../src/lib/argocd-client";

describe("ArgoCDClient", () => {
  const savedEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...savedEnv };
  });

  afterEach(() => {
    process.env = savedEnv;
    globalThis.fetch = originalFetch;
  });

  it("getArgoCDClient returns null when ARGOCD_SERVER not set", () => {
    delete process.env.ARGOCD_SERVER;
    delete process.env.ARGOCD_TOKEN;
    expect(getArgoCDClient()).toBeNull();
  });

  it("getArgoCDClient returns client when configured", () => {
    process.env.ARGOCD_SERVER = "https://cd.gmac.io";
    process.env.ARGOCD_TOKEN = "test-token";
    const client = getArgoCDClient();
    expect(client).toBeInstanceOf(ArgoCDClient);
  });

  it("listApplications calls correct endpoint", async () => {
    process.env.ARGOCD_SERVER = "https://cd.gmac.io";
    process.env.ARGOCD_TOKEN = "test-token";

    const mockApps = {
      items: [
        {
          metadata: { name: "control-panel", namespace: "argocd" },
          spec: {
            source: {
              repoURL: "https://git.gmac.io/gmackie/control-panel",
            },
          },
          status: {
            sync: { status: "Synced", revision: "abc123" },
            health: { status: "Healthy" },
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApps,
    });

    const client = new ArgoCDClient("https://cd.gmac.io", "test-token");
    const apps = await client.listApplications();
    expect(apps).toHaveLength(1);
    expect(apps[0]!.metadata.name).toBe("control-panel");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://cd.gmac.io/api/v1/applications",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("getApplication calls correct endpoint with name", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        metadata: { name: "playpath" },
        status: {
          sync: { status: "OutOfSync" },
          health: { status: "Progressing" },
        },
      }),
    });

    const client = new ArgoCDClient("https://cd.gmac.io", "test-token");
    const app = await client.getApplication("playpath");
    expect(app.metadata.name).toBe("playpath");
  });
});

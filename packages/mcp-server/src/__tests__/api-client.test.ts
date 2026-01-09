import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ControlPanelClient, ApiError } from "../api-client.js";
import superjson from "superjson";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createSuccessResponse<T>(data: T) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      result: {
        data: superjson.serialize(data),
      },
    }),
  };
}

function createErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    text: async () => message,
  };
}

function createTrpcErrorResponse(message: string, httpStatus: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      error: {
        message,
        data: { httpStatus },
      },
    }),
  };
}

describe("ControlPanelClient", () => {
  let client: ControlPanelClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new ControlPanelClient({
      baseUrl: "https://control.example.com",
      apiKey: "cp_test_key_123",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("removes trailing slash from base URL", () => {
      const clientWithSlash = new ControlPanelClient({
        baseUrl: "https://example.com/",
        apiKey: "key",
      });
      expect(clientWithSlash).toBeDefined();
    });
  });

  describe("query", () => {
    it("sends GET request with correct headers", async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ id: "1", name: "Test" }));

      await client.query("applications.list");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://control.example.com/api/trpc/applications.list",
        expect.objectContaining({
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer cp_test_key_123",
          },
        })
      );
    });

    it("includes input in query string when provided", async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ id: "1" }));

      await client.query("applications.byId", "app-123");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("applications.byId");
      expect(calledUrl).toContain("input=");
    });

    it("returns deserialized data on success", async () => {
      const mockData = { id: "app-1", name: "My App", createdAt: new Date() };
      mockFetch.mockResolvedValueOnce(createSuccessResponse(mockData));

      const result = await client.query<typeof mockData>("applications.byId", "app-1");

      expect(result.id).toBe("app-1");
      expect(result.name).toBe("My App");
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it("throws ApiError on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(500, "Internal Server Error"));

      await expect(client.query("applications.list")).rejects.toThrow(ApiError);
    });

    it("includes status code in ApiError", async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(500, "Internal Server Error"));

      try {
        await client.query("applications.list");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(500);
      }
    });

    it("throws ApiError on tRPC error response", async () => {
      mockFetch.mockResolvedValueOnce(createTrpcErrorResponse("Not found", 404));

      await expect(client.query("applications.byId", "invalid")).rejects.toThrow(ApiError);
    });
  });

  describe("mutate", () => {
    it("sends POST request with JSON body", async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ id: "new-app" }));

      await client.mutate("applications.create", { name: "New App", slug: "new-app" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://control.example.com/api/trpc/applications.create",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer cp_test_key_123",
          },
          body: expect.any(String),
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.json).toEqual({ name: "New App", slug: "new-app" });
    });
  });

  describe("applications namespace", () => {
    it("list calls correct endpoint", async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse([]));

      await client.applications.list();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("applications.list"),
        expect.any(Object)
      );
    });

    it("byId calls with id parameter", async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ id: "app-1" }));

      await client.applications.byId("app-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("applications.byId"),
        expect.any(Object)
      );
    });

    it("create sends POST request", async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ id: "new-app" }));

      await client.applications.create({ name: "Test", slug: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("applications.create"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("clusters namespace", () => {
    it("list returns cluster summaries", async () => {
      const mockClusters = [
        { id: "c1", name: "prod-cluster", status: "healthy" },
        { id: "c2", name: "dev-cluster", status: "degraded" },
      ];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(mockClusters));

      const result = await client.clusters.list();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("prod-cluster");
    });

    it("scale sends mutation", async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({ success: true, message: "Scaled" })
      );

      await client.clusters.scale({ clusterId: "c1", nodeCount: 5 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("clusters.scale"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("monitoring namespace", () => {
    it("alerts returns alert list", async () => {
      const mockAlerts = [
        { id: "a1", name: "High CPU", severity: "warning", status: "firing" },
      ];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(mockAlerts));

      const result = await client.monitoring.alerts();

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe("warning");
    });

    it("acknowledgeAlert sends mutation", async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse({ success: true }));

      await client.monitoring.acknowledgeAlert({ alertId: "a1", comment: "Acknowledged" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("monitoring.acknowledgeAlert"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("deployments namespace", () => {
    it("trigger sends deployment request", async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          deployment: { id: "d1", status: "pending" },
        })
      );

      const result = await client.deployments.trigger({
        appId: "app-1",
        environment: "production",
        imageTag: "v1.2.3",
      });

      expect(result.success).toBe(true);
      expect(result.deployment.status).toBe("pending");
    });

    it("rollback sends rollback request", async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({
          success: true,
          message: "Rollback initiated",
          rollbackDeploymentId: "d2",
        })
      );

      const result = await client.deployments.rollback({ deploymentId: "d1" });

      expect(result.success).toBe(true);
      expect(result.rollbackDeploymentId).toBe("d2");
    });
  });

  describe("healthCheck", () => {
    it("returns true when API is healthy", async () => {
      mockFetch.mockResolvedValueOnce(
        createSuccessResponse({ status: "healthy", services: {} })
      );

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it("returns false when API is unreachable", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });

    it("returns false on API error", async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(500, "Server error"));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });
});

describe("ApiError", () => {
  it("has correct properties", () => {
    const error = new ApiError("Test error", 404, { resource: "app" });

    expect(error.message).toBe("Test error");
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ resource: "app" });
    expect(error).toBeInstanceOf(Error);
  });

  it("works without details", () => {
    const error = new ApiError("Simple error", 500);

    expect(error.message).toBe("Simple error");
    expect(error.statusCode).toBe(500);
    expect(error.details).toBeUndefined();
  });
});

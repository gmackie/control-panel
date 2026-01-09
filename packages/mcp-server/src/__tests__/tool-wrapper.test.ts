import { describe, it, expect } from "vitest";
import { executeTool, NotFoundError, ValidationError } from "../tool-wrapper.js";
import { ConfigError } from "../config.js";
import { ApiError } from "../api-client.js";

describe("tool-wrapper", () => {
  describe("executeTool", () => {
    it("returns success response with data and metadata", async () => {
      const result = await executeTool("test_tool", async () => {
        return { message: "success" };
      });

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.data.message).toBe("success");
      expect(response.meta.tool).toBe("test_tool");
      expect(response.meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(response.meta.timestamp).toBeDefined();
    });

    it("handles NotFoundError", async () => {
      const result = await executeTool("test_tool", async () => {
        throw new NotFoundError("Resource not found", { id: "123" });
      });

      expect(result.isError).toBe(true);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("NOT_FOUND");
      expect(response.error.message).toBe("Resource not found");
      expect(response.error.details).toEqual({ id: "123" });
    });

    it("handles ConfigError", async () => {
      const result = await executeTool("test_tool", async () => {
        throw new ConfigError("API key not configured");
      });

      expect(result.isError).toBe(true);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("CONFIG_ERROR");
      expect(response.error.message).toBe("API key not configured");
      expect(response.error.retryable).toBe(false);
    });

    it("handles ApiError with 404 status", async () => {
      const result = await executeTool("test_tool", async () => {
        throw new ApiError("Not found", 404, { resource: "app" });
      });

      expect(result.isError).toBe(true);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("NOT_FOUND");
      expect(response.error.statusCode).toBe(404);
    });

    it("handles ApiError with 401 status", async () => {
      const result = await executeTool("test_tool", async () => {
        throw new ApiError("Unauthorized", 401);
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error.code).toBe("UNAUTHORIZED");
      expect(response.error.statusCode).toBe(401);
    });

    it("handles ApiError with 500 status and marks as retryable", async () => {
      const result = await executeTool("test_tool", async () => {
        throw new ApiError("Internal server error", 500);
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error.code).toBe("API_ERROR");
      expect(response.error.retryable).toBe(true);
    });

    it("handles generic errors", async () => {
      const result = await executeTool("test_tool", async () => {
        throw new Error("Something went wrong");
      });

      expect(result.isError).toBe(true);

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe("INTERNAL_ERROR");
      expect(response.error.message).toBe("Something went wrong");
    });

    it("detects network errors and marks as retryable", async () => {
      const result = await executeTool("test_tool", async () => {
        throw new Error("fetch failed: ECONNREFUSED");
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.error.code).toBe("API_ERROR");
      expect(response.error.retryable).toBe(true);
    });
  });

  describe("error classes", () => {
    it("NotFoundError has correct properties", () => {
      const error = new NotFoundError("Not found", { id: "123" });
      expect(error.code).toBe("NOT_FOUND");
      expect(error.details).toEqual({ id: "123" });
    });

    it("ValidationError has correct properties", () => {
      const error = new ValidationError("Invalid input", { field: "name" });
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual({ field: "name" });
    });
  });
});

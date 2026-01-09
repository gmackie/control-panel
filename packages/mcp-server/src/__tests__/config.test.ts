import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "../config.js";

describe("config", () => {
  describe("loadConfig", () => {
    it("loads config from environment variables", () => {
      const env = {
        CONTROL_PANEL_URL: "https://control.example.com",
        CONTROL_PANEL_API_KEY: "test-api-key",
      };

      const config = loadConfig(env);

      expect(config.controlPanelUrl).toBe("https://control.example.com");
      expect(config.apiKey).toBe("test-api-key");
    });

    it("uses default URL when not provided", () => {
      const env = {
        CONTROL_PANEL_API_KEY: "test-api-key",
      };

      const config = loadConfig(env);

      expect(config.controlPanelUrl).toBe("https://control.gmac.io");
      expect(config.apiKey).toBe("test-api-key");
    });

    it("throws error when API key is missing", () => {
      const env = {};

      expect(() => loadConfig(env)).toThrow();
    });

    it("throws error when API key is empty", () => {
      const env = {
        CONTROL_PANEL_API_KEY: "",
      };

      expect(() => loadConfig(env)).toThrow();
    });

    it("validates URL format", () => {
      const env = {
        CONTROL_PANEL_URL: "not-a-url",
        CONTROL_PANEL_API_KEY: "test-api-key",
      };

      expect(() => loadConfig(env)).toThrow();
    });
  });

  describe("ConfigError", () => {
    it("creates error with correct code", () => {
      const error = new ConfigError("Missing API key");

      expect(error.code).toBe("CONFIG_ERROR");
      expect(error.message).toBe("Missing API key");
    });
  });
});

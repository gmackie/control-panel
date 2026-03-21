import { describe, it, expect, beforeEach } from "vitest";
import {
  getActiveDeployment,
  setActiveDeployment,
  clearActiveDeployment,
  isDeployInFlight,
  getLastKnownGood,
  setLastKnownGood,
  markRolledBack,
  _resetDeployState,
} from "../deploy-state";

describe("deploy-state", () => {
  beforeEach(() => {
    _resetDeployState();
  });

  describe("active deployment tracking", () => {
    it("returns null when no deployment is set", () => {
      expect(getActiveDeployment("myapp", "production")).toBeNull();
    });

    it("stores and retrieves an active deployment", () => {
      const state = {
        executionRequestId: "req-1",
        imageRef: "registry.example.com/myapp:v1.2.3",
        imageDigest: "sha256:abc123",
        startedAt: new Date("2026-03-21T10:00:00Z"),
        rolledBack: false,
      };

      setActiveDeployment("myapp", "production", state);

      const result = getActiveDeployment("myapp", "production");
      expect(result).toEqual(state);
    });

    it("isolates deployments by app and environment", () => {
      const stateA = {
        executionRequestId: "req-a",
        imageRef: "registry.example.com/a:v1",
        startedAt: new Date(),
        rolledBack: false,
      };
      const stateB = {
        executionRequestId: "req-b",
        imageRef: "registry.example.com/b:v1",
        startedAt: new Date(),
        rolledBack: false,
      };

      setActiveDeployment("app-a", "staging", stateA);
      setActiveDeployment("app-b", "production", stateB);

      expect(getActiveDeployment("app-a", "staging")?.executionRequestId).toBe("req-a");
      expect(getActiveDeployment("app-b", "production")?.executionRequestId).toBe("req-b");
      expect(getActiveDeployment("app-a", "production")).toBeNull();
    });

    it("clears an active deployment", () => {
      setActiveDeployment("myapp", "staging", {
        executionRequestId: "req-1",
        imageRef: "img:v1",
        startedAt: new Date(),
        rolledBack: false,
      });

      clearActiveDeployment("myapp", "staging");
      expect(getActiveDeployment("myapp", "staging")).toBeNull();
    });
  });

  describe("isDeployInFlight", () => {
    it("returns false when no deployment exists", () => {
      expect(isDeployInFlight("myapp", "production")).toBe(false);
    });

    it("returns true when an active, non-rolled-back deployment exists", () => {
      setActiveDeployment("myapp", "production", {
        executionRequestId: "req-1",
        imageRef: "img:v1",
        startedAt: new Date(),
        rolledBack: false,
      });

      expect(isDeployInFlight("myapp", "production")).toBe(true);
    });

    it("returns false when the deployment has been rolled back", () => {
      setActiveDeployment("myapp", "production", {
        executionRequestId: "req-1",
        imageRef: "img:v1",
        startedAt: new Date(),
        rolledBack: false,
      });

      markRolledBack("myapp", "production");
      expect(isDeployInFlight("myapp", "production")).toBe(false);
    });
  });

  describe("last known good tracking", () => {
    it("returns null when no last known good is set", () => {
      expect(getLastKnownGood("myapp", "production")).toBeNull();
    });

    it("stores and retrieves last known good", () => {
      const good = {
        imageRepository: "registry.example.com/myapp",
        imageTag: "v1.1.0",
        imageDigest: "sha256:def456",
        confirmedAt: new Date("2026-03-20T08:00:00Z"),
      };

      setLastKnownGood("myapp", "production", good);

      const result = getLastKnownGood("myapp", "production");
      expect(result).toEqual(good);
    });

    it("overwrites previous last known good", () => {
      setLastKnownGood("myapp", "production", {
        imageRepository: "registry.example.com/myapp",
        imageTag: "v1.0.0",
        confirmedAt: new Date("2026-03-19T08:00:00Z"),
      });

      setLastKnownGood("myapp", "production", {
        imageRepository: "registry.example.com/myapp",
        imageTag: "v1.1.0",
        confirmedAt: new Date("2026-03-20T08:00:00Z"),
      });

      expect(getLastKnownGood("myapp", "production")?.imageTag).toBe("v1.1.0");
    });
  });

  describe("markRolledBack", () => {
    it("returns true on first call", () => {
      setActiveDeployment("myapp", "production", {
        executionRequestId: "req-1",
        imageRef: "img:v1",
        startedAt: new Date(),
        rolledBack: false,
      });

      expect(markRolledBack("myapp", "production")).toBe(true);
    });

    it("returns false on second call (loop protection)", () => {
      setActiveDeployment("myapp", "production", {
        executionRequestId: "req-1",
        imageRef: "img:v1",
        startedAt: new Date(),
        rolledBack: false,
      });

      expect(markRolledBack("myapp", "production")).toBe(true);
      expect(markRolledBack("myapp", "production")).toBe(false);
    });

    it("returns false when no deployment exists", () => {
      expect(markRolledBack("myapp", "production")).toBe(false);
    });
  });
});

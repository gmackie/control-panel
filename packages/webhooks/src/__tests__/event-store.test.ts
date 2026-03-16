import { describe, it, expect, vi } from "vitest";
import {
  storeWebhookEvent,
  storeAlert,
  createNotification,
  updateAlertStatus,
} from "../event-store";

describe("event-store with db=null", () => {
  it("storeWebhookEvent returns null when db is null", async () => {
    const result = await storeWebhookEvent(null, {
      source: "argocd",
      eventType: "push",
      title: "Test event",
      severity: "info",
    });
    expect(result).toBeNull();
  });

  it("storeAlert returns null when db is null", async () => {
    const result = await storeAlert(null, {
      fingerprint: "fp-1",
      name: "TestAlert",
      severity: "critical",
      status: "firing",
      startsAt: new Date(),
      summary: "Test alert",
    });
    expect(result).toBeNull();
  });

  it("createNotification returns null when db is null", async () => {
    const result = await createNotification(null, {
      source: "prometheus",
      category: "alert",
      severity: "info",
      title: "Test",
      message: "Test notification",
    });
    expect(result).toBeNull();
  });

  it("updateAlertStatus returns false when db is null", async () => {
    const result = await updateAlertStatus(null, "TestAlert", "fp-1", "resolved");
    expect(result).toBe(false);
  });
});

describe("event-store with mock db", () => {
  it("storeWebhookEvent calls db.insert with correct table", async () => {
    const mockReturning = vi.fn().mockResolvedValue([{ id: "event-123" }]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

    const mockDb = { insert: mockInsert, update: vi.fn(), select: vi.fn() } as any;

    const result = await storeWebhookEvent(mockDb, {
      source: "argocd",
      eventType: "app.sync",
      title: "ArgoCD sync",
      severity: "info",
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockValues).toHaveBeenCalledOnce();
    expect(result).toBe("event-123");
  });

  it("storeAlert calls db.insert and returns alert id", async () => {
    const mockReturning = vi.fn().mockResolvedValue([{ id: "alert-456" }]);
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

    const mockDb = { insert: mockInsert, update: vi.fn(), select: vi.fn() } as any;

    const result = await storeAlert(mockDb, {
      fingerprint: "fp-2",
      name: "HighMemory",
      severity: "warning",
      status: "firing",
      startsAt: new Date(),
      summary: "Memory is high",
      labels: { namespace: "production" },
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(result).toBe("alert-456");
  });
});

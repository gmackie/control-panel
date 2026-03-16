import { describe, it, expect } from "vitest";
import { normalizeStatus, isValidTransition, isTerminal } from "../status";

describe("normalizeStatus", () => {
  it('maps "success" to "healthy"', () => {
    expect(normalizeStatus("success")).toBe("healthy");
  });

  it('maps "error" to "failed"', () => {
    expect(normalizeStatus("error")).toBe("failed");
  });

  it('maps "cancelled" to "canceled"', () => {
    expect(normalizeStatus("cancelled")).toBe("canceled");
  });

  it('maps "deploying" to "deploying"', () => {
    expect(normalizeStatus("deploying")).toBe("deploying");
  });

  it('maps unknown values to "failed"', () => {
    expect(normalizeStatus("garbage")).toBe("failed");
  });
});

describe("isValidTransition", () => {
  it('allows transition from "queued" to "building"', () => {
    expect(isValidTransition("queued", "building")).toBe(true);
  });

  it('disallows transition from "healthy" to "building"', () => {
    expect(isValidTransition("healthy", "building")).toBe(false);
  });
});

describe("isTerminal", () => {
  it('returns true for "healthy"', () => {
    expect(isTerminal("healthy")).toBe(true);
  });

  it('returns false for "deploying"', () => {
    expect(isTerminal("deploying")).toBe(false);
  });
});

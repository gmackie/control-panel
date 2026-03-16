import { describe, it, expect } from "vitest";
import { verifyBearerToken } from "../auth";

describe("verifyBearerToken", () => {
  it("returns valid:true for a valid Bearer token", () => {
    const result = verifyBearerToken("Bearer tok123", null, "tok123");
    expect(result).toEqual({ valid: true });
  });

  it("returns valid:true for a valid x-webhook-token", () => {
    const result = verifyBearerToken(null, "tok123", "tok123");
    expect(result).toEqual({ valid: true });
  });

  it("returns valid:false when both auth header and x-webhook-token are missing", () => {
    const result = verifyBearerToken(null, null, "tok123");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns valid:true when expectedToken is empty (passthrough)", () => {
    const result = verifyBearerToken(null, null, "");
    expect(result).toEqual({ valid: true });
  });

  it("returns valid:false when token length does not match expected", () => {
    const result = verifyBearerToken("Bearer short", null, "longtoken123");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid token");
  });
});

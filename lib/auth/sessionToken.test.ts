import { describe, it, expect } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  verifySessionToken,
} from "./sessionToken";

describe("session token utilities", () => {
  it("generates and hashes a token", () => {
    const token = generateSessionToken();
    expect(token).toBeTypeOf("string");
    expect(token).toHaveLength(64); // 32 bytes hex = 64 chars

    const hash = hashSessionToken(token);
    expect(hash).toBeTypeOf("string");
    expect(hash).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it("verifies a valid token hash", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    const isValid = verifySessionToken(hash, token);
    expect(isValid).toBe(true);
  });

  it("rejects an invalid token", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    const isValid = verifySessionToken(hash, "wrongtoken");
    expect(isValid).toBe(false);
  });
});

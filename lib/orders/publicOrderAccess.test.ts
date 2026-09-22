import { describe, expect, it, vi } from "vitest";

// This module imports @/lib/db at the top level (for getOrderByActionToken),
// which throws if DATABASE_URL isn't set — mock it so importing the module
// to test its pure functions doesn't need a real DB connection.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { isOrderPayable, isTopUpPayable, isValidActionTokenFormat } from "./publicOrderAccess";

describe("isValidActionTokenFormat", () => {
  it("accepts a 32-char hex token", () => {
    expect(isValidActionTokenFormat("a".repeat(32))).toBe(true);
    expect(isValidActionTokenFormat("ABCDEF0123456789abcdef0123456789".slice(0, 32))).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidActionTokenFormat(null)).toBe(false);
    expect(isValidActionTokenFormat(undefined)).toBe(false);
    expect(isValidActionTokenFormat("")).toBe(false);
    expect(isValidActionTokenFormat("too-short")).toBe(false);
    expect(isValidActionTokenFormat("g".repeat(32))).toBe(false); // 'g' isn't hex
  });
});

describe("isOrderPayable", () => {
  it("is payable from approved or failed", () => {
    expect(isOrderPayable("approved")).toBe(true);
    expect(isOrderPayable("failed")).toBe(true);
  });

  it("is not payable from processing, confirmed, rejected, or cancelled", () => {
    expect(isOrderPayable("processing")).toBe(false);
    expect(isOrderPayable("confirmed")).toBe(false);
    expect(isOrderPayable("rejected")).toBe(false);
    expect(isOrderPayable("cancelled")).toBe(false);
  });
});

describe("isTopUpPayable", () => {
  it("is payable when confirmed and there's a positive remaining balance", () => {
    expect(isTopUpPayable("confirmed", 500)).toBe(true);
  });

  it("is not payable when confirmed but nothing is owed", () => {
    expect(isTopUpPayable("confirmed", 0)).toBe(false);
  });

  it("is never payable from a non-confirmed status, even with a positive balance", () => {
    expect(isTopUpPayable("approved", 500)).toBe(false);
    expect(isTopUpPayable("processing", 500)).toBe(false);
    expect(isTopUpPayable("cancelled", 500)).toBe(false);
  });
});

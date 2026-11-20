import { describe, expect, it } from "vitest";

import { ALL_MODULES, computeDefaultAppAccess, isAppAccessGrantAllowedForNonOwner, type AppAccessRow } from "./appAccessDefaults";

const rows = (overrides: Partial<Record<AppAccessRow["module"], Omit<AppAccessRow, "module">>> = {}): AppAccessRow[] =>
  ALL_MODULES.map((module) => ({ module, enabled: false, level: "VIEWER", ...overrides[module] }));

describe("Accounting access", () => {
  it("is a module, off by default even for owners", () => {
    expect(ALL_MODULES).toContain("ACCOUNTING");
    expect(computeDefaultAppAccess("OWNER", []).ACCOUNTING.enabled).toBe(false);
    expect(computeDefaultAppAccess("ADMIN", []).ACCOUNTING.enabled).toBe(false);
  });

  it("can only be granted or taken away by an owner", () => {
    expect(isAppAccessGrantAllowedForNonOwner(rows({ ACCOUNTING: { enabled: true, level: "ADMIN" } }))).toBe(false);
    expect(isAppAccessGrantAllowedForNonOwner(rows({ ACCOUNTING: { enabled: true, level: "VIEWER" } }))).toBe(false);
    const granted = rows({ ACCOUNTING: { enabled: true, level: "ADMIN" } });
    expect(isAppAccessGrantAllowedForNonOwner(rows(), granted)).toBe(false);
  });

  it("lets a non-owner save a user whose Accounting access stays as it was", () => {
    const granted = rows({ ACCOUNTING: { enabled: true, level: "ADMIN" } });
    expect(isAppAccessGrantAllowedForNonOwner(granted, granted)).toBe(true);
    expect(isAppAccessGrantAllowedForNonOwner(rows({ ACCOUNTING: { enabled: false, level: "ADMIN" } }))).toBe(true);
  });
});

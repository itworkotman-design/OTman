import { describe, expect, it } from "vitest";

import { ALL_MODULES } from "./appAccessDefaults";
import { buildInitialForm } from "./userModal";

const source = (appAccess: { module: string; enabled: boolean; level: "VIEWER" | "ADMIN" }[]) =>
  ({ initialValueRole: "ADMIN", initialValueActive: true, initialValueAppAccess: appAccess }) as Parameters<typeof buildInitialForm>[0];

describe("buildInitialForm app access", () => {
  it("lists every module, adding ones the user has no saved row for (newer modules, e.g. Accounting) as off", () => {
    const saved = ALL_MODULES.filter((m) => m !== "ACCOUNTING").map((module) => ({ module, enabled: true, level: "ADMIN" as const }));

    const form = buildInitialForm(source(saved));

    expect(form.appAccess.map((r) => r.module)).toEqual(ALL_MODULES);
    expect(form.appAccess.find((r) => r.module === "ACCOUNTING")).toEqual({ module: "ACCOUNTING", enabled: false, level: "ADMIN" });
    expect(form.appAccess.filter((r) => r.module !== "ACCOUNTING").every((r) => r.enabled)).toBe(true);
  });

  it("keeps a saved Accounting grant", () => {
    const form = buildInitialForm(source([{ module: "ACCOUNTING", enabled: true, level: "ADMIN" }]));
    expect(form.appAccess.find((r) => r.module === "ACCOUNTING")?.enabled).toBe(true);
    expect(form.appAccess).toHaveLength(ALL_MODULES.length);
  });
});

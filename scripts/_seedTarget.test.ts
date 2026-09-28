import { describe, expect, it } from "vitest";
import { assertLocalTarget, assertProductionTarget, describeDatabaseUrl } from "./_seedTarget";

const LOCAL = "postgresql://user:secret@localhost:5432/otman_local?schema=public";
const NEON = "postgresql://user:secret@ep-cold-pond-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require";

describe("describeDatabaseUrl", () => {
  it("extracts host and database name, and never exposes credentials", () => {
    const target = describeDatabaseUrl(NEON);

    expect(target).toEqual({
      host: "ep-cold-pond-pooler.c-5.eu-central-1.aws.neon.tech",
      database: "neondb",
      isLocal: false,
    });
    expect(JSON.stringify(target)).not.toContain("secret");
  });

  it("treats localhost, 127.0.0.1 and ::1 as local", () => {
    expect(describeDatabaseUrl(LOCAL).isLocal).toBe(true);
    expect(describeDatabaseUrl("postgresql://u:p@127.0.0.1:5432/x").isLocal).toBe(true);
    expect(describeDatabaseUrl("postgresql://u:p@[::1]:5432/x").isLocal).toBe(true);
  });

  it("is not fooled by a hostname that merely contains 'localhost'", () => {
    expect(describeDatabaseUrl("postgresql://u:p@localhost.evil.example.com/x").isLocal).toBe(false);
    expect(describeDatabaseUrl("postgresql://u:p@notlocalhost/x").isLocal).toBe(false);
  });

  it("throws a clear error for a missing or unparseable URL", () => {
    expect(() => describeDatabaseUrl(undefined)).toThrow(/DATABASE_URL/);
    expect(() => describeDatabaseUrl("")).toThrow(/DATABASE_URL/);
    expect(() => describeDatabaseUrl("not a url")).toThrow(/DATABASE_URL/);
  });
});

describe("assertLocalTarget", () => {
  it("allows a local database", () => {
    expect(() => assertLocalTarget(describeDatabaseUrl(LOCAL), "seed-furniture-catalog")).not.toThrow();
  });

  it("refuses a remote database and points at the production script", () => {
    expect(() => assertLocalTarget(describeDatabaseUrl(NEON), "seed-furniture-catalog")).toThrow(/local/i);
    expect(() => assertLocalTarget(describeDatabaseUrl(NEON), "seed-furniture-catalog")).toThrow(/:prod/);
  });

  it("never echoes the credentials in its message", () => {
    try {
      assertLocalTarget(describeDatabaseUrl(NEON), "seed-furniture-catalog");
    } catch (error) {
      expect(String(error)).not.toContain("secret");
    }
  });
});

describe("assertProductionTarget", () => {
  it("allows a remote database", () => {
    expect(() => assertProductionTarget(describeDatabaseUrl(NEON))).not.toThrow();
  });

  it("refuses a local database — a production script pointed at localhost is a mistake, not a production seed", () => {
    expect(() => assertProductionTarget(describeDatabaseUrl(LOCAL))).toThrow(/production/i);
  });
});

import { describe, expect, it } from "vitest";
import { pgConnectionString, pgPoolOptions } from "./dbConnectionString";

describe("pgConnectionString — the database URL as the pg pool gets it", () => {
  it("spells out verify-full where the URL asks for require / prefer / verify-ca (what pg does today, without its warning)", () => {
    for (const mode of ["require", "prefer", "verify-ca"]) {
      expect(pgConnectionString(`postgresql://u:p@ep-x-pooler.neon.tech/neondb?sslmode=${mode}&channel_binding=require`)).toBe(
        "postgresql://u:p@ep-x-pooler.neon.tech/neondb?sslmode=verify-full&channel_binding=require",
      );
    }
  });

  it("leaves every other URL alone", () => {
    for (const url of [
      "postgresql://u:p@localhost:5432/otman",
      "postgresql://u:p@host/db?sslmode=disable",
      "postgresql://u:p@host/db?sslmode=verify-full",
      "postgresql://u:p@host/db?uselibpqcompat=true&sslmode=require",
    ]) {
      expect(pgConnectionString(url)).toBe(url);
    }
  });

  it("passes a missing URL through", () => {
    expect(pgConnectionString(undefined)).toBeUndefined();
  });
});

describe("pgPoolOptions — the pg pool both Prisma clients use", () => {
  it("gives up on a connection or query that hangs instead of waiting forever (a socket Neon already closed)", () => {
    const options = pgPoolOptions("postgresql://u:p@host/db?sslmode=require");
    expect(options.connectionString).toBe("postgresql://u:p@host/db?sslmode=verify-full");
    expect(options.connectionTimeoutMillis).toBe(10_000);
    expect(options.query_timeout).toBe(25_000);
  });

  it("drops idle connections before Neon does, and keeps the live ones alive", () => {
    const options = pgPoolOptions("postgresql://u:p@host/db");
    expect(options.idleTimeoutMillis).toBe(30_000);
    expect(options.keepAlive).toBe(true);
    expect(options.ssl).toEqual({ rejectUnauthorized: false });
  });
});

import { describe, expect, it } from "vitest";
import { addDaysIso, compareIsoDate, getOsloDateKey, parseIsoDate, toIsoDate } from "./isoDate";

describe("parseIsoDate", () => {
  it("parses a valid date", () => {
    const date = parseIsoDate("2026-07-06");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(6);
    expect(date?.getDate()).toBe(6);
  });

  it("rejects malformed input", () => {
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("not-a-date")).toBeNull();
    expect(parseIsoDate("2026-13-01")).toBeNull();
    expect(parseIsoDate("2026-02-30")).toBeNull();
  });
});

describe("toIsoDate / round-trip", () => {
  it("round-trips through parseIsoDate", () => {
    const iso = "2026-01-31";
    const date = parseIsoDate(iso);
    expect(date).not.toBeNull();
    expect(toIsoDate(date as Date)).toBe(iso);
  });
});

describe("addDaysIso", () => {
  it("adds days within a month", () => {
    expect(addDaysIso("2026-07-06", 3)).toBe("2026-07-09");
  });

  it("rolls over month boundaries", () => {
    expect(addDaysIso("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("rolls over year boundaries", () => {
    expect(addDaysIso("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("supports negative offsets", () => {
    expect(addDaysIso("2026-07-06", -6)).toBe("2026-06-30");
  });
});

describe("compareIsoDate", () => {
  it("orders dates lexically", () => {
    expect(compareIsoDate("2026-07-06", "2026-07-07")).toBeLessThan(0);
    expect(compareIsoDate("2026-07-07", "2026-07-06")).toBeGreaterThan(0);
    expect(compareIsoDate("2026-07-06", "2026-07-06")).toBe(0);
  });
});

describe("getOsloDateKey", () => {
  it("returns the Oslo calendar date even when the instant is in a different UTC day", () => {
    // 23:30 UTC on 2026-01-14 is 00:30 in Oslo (UTC+1 in January) on 2026-01-15.
    const instant = new Date("2026-01-14T23:30:00.000Z");
    expect(getOsloDateKey(instant)).toBe("2026-01-15");
  });

  it("returns a YYYY-MM-DD shaped string", () => {
    expect(getOsloDateKey(new Date("2026-07-06T12:00:00.000Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

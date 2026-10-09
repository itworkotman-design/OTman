import { describe, expect, it } from "vitest";
import { formatOrderDate } from "./formatOrderDate";

describe("formatOrderDate", () => {
  it("writes an ISO calendar date out in full", () => {
    expect(formatOrderDate("2026-10-15", "no")).toBe("15. oktober 2026");
    expect(formatOrderDate("2026-10-15", "en")).toBe("15 October 2026");
  });

  it("returns anything that isn't a plain ISO date unchanged", () => {
    expect(formatOrderDate("15.10.2026", "no")).toBe("15.10.2026");
  });
});

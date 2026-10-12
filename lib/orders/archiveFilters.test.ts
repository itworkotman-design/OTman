import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAfterTomorrowRange } from "@/lib/orders/archiveFilters";

describe("archive date quick filters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 12, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the day-after-tomorrow range", () => {
    expect(getAfterTomorrowRange()).toEqual({ fromDate: "2026-10-14", toDate: "2026-10-14" });
  });
});

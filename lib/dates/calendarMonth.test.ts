import { describe, expect, it } from "vitest";
import { addMonths, buildCalendarDays, getWeekendDay, isCalendarDayDisabled, startOfMonth } from "./calendarMonth";

describe("calendarMonth", () => {
  it("startOfMonth / addMonths move to the first of the month", () => {
    expect(startOfMonth(new Date(2026, 9, 28))).toEqual(new Date(2026, 9, 1));
    expect(addMonths(new Date(2026, 11, 15), 1)).toEqual(new Date(2027, 0, 1));
    expect(addMonths(new Date(2026, 0, 15), -1)).toEqual(new Date(2025, 11, 1));
  });

  it("builds a Monday-first 6-week grid", () => {
    // October 2026 starts on a Thursday.
    const days = buildCalendarDays(new Date(2026, 9, 1));
    expect(days).toHaveLength(42);
    expect(days[0]).toEqual({ iso: "2026-09-28", dayOfMonth: 28, inCurrentMonth: false });
    expect(days[3]).toEqual({ iso: "2026-10-01", dayOfMonth: 1, inCurrentMonth: true });
    expect(days[41]).toEqual({ iso: "2026-11-08", dayOfMonth: 8, inCurrentMonth: false });
  });

  it("disables days before min", () => {
    expect(isCalendarDayDisabled("2026-10-27", { min: "2026-10-28" })).toBe(true);
    expect(isCalendarDayDisabled("2026-10-28", { min: "2026-10-28" })).toBe(false);
    expect(isCalendarDayDisabled("2026-10-27", {})).toBe(false);
  });

  it("disables listed weekdays (0 = Sunday)", () => {
    expect(isCalendarDayDisabled("2026-11-01", { disabledWeekdays: [0] })).toBe(true); // Sunday
    expect(isCalendarDayDisabled("2026-10-31", { disabledWeekdays: [0] })).toBe(false); // Saturday
  });

  it("flags Saturday and Sunday as weekend", () => {
    expect(getWeekendDay("2026-10-31")).toBe("saturday");
    expect(getWeekendDay("2026-11-01")).toBe("sunday");
    expect(getWeekendDay("2026-11-02")).toBeNull();
  });
});

import { toIsoDate } from "./isoDate";

export type CalendarDay = {
  iso: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
};

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

// Builds a 6-week (42 day) Monday-first grid for the given month, including
// the leading/trailing days from the adjacent months needed to fill it.
export function buildCalendarDays(month: Date): CalendarDay[] {
  const firstDay = startOfMonth(month);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth(),
    1 - firstWeekday,
  );

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + index,
    );

    return {
      iso: toIsoDate(current),
      dayOfMonth: current.getDate(),
      inCurrentMonth: current.getMonth() === month.getMonth(),
    };
  });
}

// Whether the given month has at least one in-month day for which
// isDaySelectable returns true (used to skip a picker past a month that's
// entirely blocked out, e.g. by a minDate cutoff or blocked weekdays).
export function monthHasSelectableDay(
  month: Date,
  isDaySelectable: (iso: string) => boolean,
): boolean {
  return buildCalendarDays(month).some((day) => day.inCurrentMonth && isDaySelectable(day.iso));
}

// Starting from startMonth, scans forward for the first month with a
// selectable day. Falls back to the last month scanned if none is found
// within maxMonthsToScan, so a pathological predicate (e.g. one that blocks
// every day) can't loop forever.
export function resolveVisibleMonth(
  startMonth: Date,
  isDaySelectable: (iso: string) => boolean,
  maxMonthsToScan = 36,
): Date {
  let month = startOfMonth(startMonth);

  for (let i = 0; i < maxMonthsToScan; i++) {
    if (monthHasSelectableDay(month, isDaySelectable)) {
      return month;
    }
    if (i < maxMonthsToScan - 1) {
      month = addMonths(month, 1);
    }
  }

  return month;
}

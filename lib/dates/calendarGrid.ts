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

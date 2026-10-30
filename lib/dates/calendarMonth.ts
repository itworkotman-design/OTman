import { parseIsoDate, toIsoDate } from "@/lib/dates/isoDate";

// Month-grid helpers shared by the custom calendar pickers (archive date-range
// filter, order delivery date).

export type CalendarDay = {
  iso: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
};

export type CalendarLocale = "en" | "nb";

export const WEEKDAY_LABELS: Record<CalendarLocale, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  nb: ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"],
};

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

// 6 Monday-first weeks covering `month`, padded with the neighbouring months.
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

export function getMonthLabel(month: Date, locale: CalendarLocale): string {
  return month.toLocaleDateString(locale === "nb" ? "nb-NO" : "en-GB", {
    month: "long",
    year: "numeric",
  });
}

// `disabledWeekdays` uses Date.getDay() numbering (0 = Sunday).
export function isCalendarDayDisabled(
  iso: string,
  { min, disabledWeekdays }: { min?: string; disabledWeekdays?: number[] },
): boolean {
  if (min && iso < min) return true;
  if (disabledWeekdays?.length) {
    const date = parseIsoDate(iso);
    if (date && disabledWeekdays.includes(date.getDay())) return true;
  }
  return false;
}

export function getWeekendDay(iso: string): "saturday" | "sunday" | null {
  const day = parseIsoDate(iso)?.getDay();
  if (day === 6) return "saturday";
  if (day === 0) return "sunday";
  return null;
}

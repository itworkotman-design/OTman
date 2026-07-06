import type { RecurrenceType } from "@prisma/client";
import { addDaysIso, compareIsoDate, parseIsoDate } from "@/lib/dates/isoDate";

export type WeeklyRecurrenceConfig = { weekdays: number[] };
export type MonthlyRecurrenceConfig = { dayOfMonth: number };
export type CustomDatesRecurrenceConfig = { dates: string[] };
export type RecurrenceConfig =
  | WeeklyRecurrenceConfig
  | MonthlyRecurrenceConfig
  | CustomDatesRecurrenceConfig;

function getLastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function isRecurrenceConfigValid(type: RecurrenceType, config: unknown): boolean {
  if (!config || typeof config !== "object") return false;

  if (type === "WEEKLY") {
    const weekdays = (config as Partial<WeeklyRecurrenceConfig>).weekdays;
    return (
      Array.isArray(weekdays) &&
      weekdays.length > 0 &&
      weekdays.every((d) => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6)
    );
  }

  if (type === "MONTHLY") {
    const dayOfMonth = (config as Partial<MonthlyRecurrenceConfig>).dayOfMonth;
    return typeof dayOfMonth === "number" && Number.isInteger(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31;
  }

  if (type === "CUSTOM_DATES") {
    const dates = (config as Partial<CustomDatesRecurrenceConfig>).dates;
    return Array.isArray(dates) && dates.length > 0 && dates.every((d) => typeof d === "string" && parseIsoDate(d) !== null);
  }

  return false;
}

export function matchesRecurrence(dateKey: string, type: RecurrenceType, config: unknown): boolean {
  const date = parseIsoDate(dateKey);
  if (!date || !isRecurrenceConfigValid(type, config)) return false;

  if (type === "WEEKLY") {
    const { weekdays } = config as WeeklyRecurrenceConfig;
    return weekdays.includes(date.getDay());
  }

  if (type === "MONTHLY") {
    const { dayOfMonth } = config as MonthlyRecurrenceConfig;
    const lastDay = getLastDayOfMonth(date.getFullYear(), date.getMonth());
    const effectiveDay = Math.min(dayOfMonth, lastDay);
    return date.getDate() === effectiveDay;
  }

  if (type === "CUSTOM_DATES") {
    const { dates } = config as CustomDatesRecurrenceConfig;
    return dates.includes(dateKey);
  }

  return false;
}

export type OccurrenceTemplateLike = {
  recurrenceType: RecurrenceType;
  recurrenceConfig: unknown;
  startDate: string;
  endDate: string | null;
};

// Safety cap so a malformed or never-matching rule can't scan forever.
const MAX_DAYS_SCANNED = 3660;

export function computeUpcomingOccurrenceDates(
  template: OccurrenceTemplateLike,
  opts: { from: string; count: number },
): string[] {
  const results: string[] = [];
  let cursor = compareIsoDate(opts.from, template.startDate) >= 0 ? opts.from : template.startDate;

  for (let i = 0; i < MAX_DAYS_SCANNED && results.length < opts.count; i++) {
    if (template.endDate && compareIsoDate(cursor, template.endDate) > 0) {
      break;
    }

    if (matchesRecurrence(cursor, template.recurrenceType, template.recurrenceConfig)) {
      results.push(cursor);
    }

    cursor = addDaysIso(cursor, 1);
  }

  return results;
}

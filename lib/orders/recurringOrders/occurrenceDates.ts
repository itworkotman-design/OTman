import type { RecurrenceType } from "@prisma/client";
import { addDaysIso, compareIsoDate, parseIsoDate } from "@/lib/dates/isoDate";

export type WeeklyRecurrenceConfig = { weekdays: number[] };
// `dayOfMonth` accepts either a single day (the only shape Scheduler Orders'
// RecurrencePicker ever produces) or an array of up to a few days (Archive
// reminders' ReminderRecurrencePicker, which allows picking several days in
// one month) — every reader below normalizes to an array first so both
// shapes, including data already stored under the old single-number-only
// shape, keep matching identically.
export type MonthlyRecurrenceConfig = { dayOfMonth: number | number[] };
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
    const days = Array.isArray(dayOfMonth) ? dayOfMonth : [dayOfMonth];
    return (
      days.length > 0 &&
      days.every((d) => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 31)
    );
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
    const days = Array.isArray(dayOfMonth) ? dayOfMonth : [dayOfMonth];
    const lastDay = getLastDayOfMonth(date.getFullYear(), date.getMonth());
    return days.some((d) => date.getDate() === Math.min(d, lastDay));
  }

  if (type === "CUSTOM_DATES") {
    const { dates } = config as CustomDatesRecurrenceConfig;
    return dates.includes(dateKey);
  }

  return false;
}

// Scans forward from (and including) `fromIsoInclusive` for the first date
// the recurrence rule matches — used by Archive reminders to derive the due
// date directly from the weekly/monthly/custom-dates pattern the user
// picked, instead of asking for a separate manually-entered due date.
// Returns null both for an invalid/empty config and for a technically-valid
// one whose only matches (e.g. CUSTOM_DATES entirely in the past) fall
// outside the scan window.
export function findNextRecurrenceDate(type: RecurrenceType, config: unknown, fromIsoInclusive: string): string | null {
  if (!isRecurrenceConfigValid(type, config)) return null;

  let cursor = fromIsoInclusive;
  for (let i = 0; i < MAX_DAYS_SCANNED; i++) {
    if (matchesRecurrence(cursor, type, config)) return cursor;
    cursor = addDaysIso(cursor, 1);
  }
  return null;
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

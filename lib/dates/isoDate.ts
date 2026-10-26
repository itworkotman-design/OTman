const COMPANY_TIME_ZONE = "Europe/Oslo";

export function parseIsoDate(value: string): Date | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysIso(value: string, days: number): string {
  const date = parseIsoDate(value);
  if (!date) return value;

  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return toIsoDate(next);
}

export function compareIsoDate(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

// Server processes (e.g. Render) are not guaranteed to run in the company's
// local timezone, so "today" for cron/generation purposes must be derived
// from the Europe/Oslo wall-clock date, not the process's own timezone.
export function getOsloDateKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

// Oslo's UTC offset (ms) at a given instant.
function getOsloOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: COMPANY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// The UTC instant of an Oslo wall-clock time ("YYYY-MM-DD" + "HH:MM[:SS]"),
// using the offset in effect on that date (CET +01:00 / CEST +02:00).
export function osloWallClockToDate(isoDate: string, time: string): Date {
  const wallAsUtc = new Date(`${isoDate}T${time}Z`).getTime();
  const candidate = new Date(wallAsUtc - getOsloOffsetMs(new Date(wallAsUtc)));
  return new Date(wallAsUtc - getOsloOffsetMs(candidate));
}

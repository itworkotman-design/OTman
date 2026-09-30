import { toIsoDate } from "./isoDate";

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher) for the date of
// Easter Sunday — every other moveable Norwegian public holiday is defined
// as a fixed offset from it.
function calculateEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monthDayNumber = h + l - 7 * m + 114;
  const month = Math.floor(monthDayNumber / 31); // 3 = March, 4 = April
  const day = (monthDayNumber % 31) + 1;

  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Norway's public holidays ("røde dager") for a given year — stores and
// warehouses are closed on all of these, so deliveries can't be scheduled
// on them either.
function computeNorwegianPublicHolidays(year: number): Set<string> {
  const easterSunday = calculateEasterSunday(year);

  const dates = [
    new Date(year, 0, 1), // New Year's Day
    addDays(easterSunday, -3), // Maundy Thursday
    addDays(easterSunday, -2), // Good Friday
    easterSunday, // Easter Sunday
    addDays(easterSunday, 1), // Easter Monday
    new Date(year, 4, 1), // Labour Day
    addDays(easterSunday, 39), // Ascension Day
    new Date(year, 4, 17), // Constitution Day
    addDays(easterSunday, 49), // Whit Sunday
    addDays(easterSunday, 50), // Whit Monday
    new Date(year, 11, 25), // Christmas Day
    new Date(year, 11, 26), // 2nd day of Christmas
  ];

  return new Set(dates.map(toIsoDate));
}

const holidayCacheByYear = new Map<number, Set<string>>();

export function isNorwegianPublicHoliday(iso: string): boolean {
  const year = Number(iso.slice(0, 4));
  if (!Number.isInteger(year)) return false;

  let holidays = holidayCacheByYear.get(year);
  if (!holidays) {
    holidays = computeNorwegianPublicHolidays(year);
    holidayCacheByYear.set(year, holidays);
  }

  return holidays.has(iso);
}

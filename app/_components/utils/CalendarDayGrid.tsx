"use client";

import { toIsoDate } from "@/lib/dates/isoDate";
import { WEEKDAY_LABELS, buildCalendarDays, getWeekendDay, isCalendarDayDisabled, type CalendarLocale } from "@/lib/dates/calendarMonth";

// One month of days (Monday-first, 6 weeks) as used by DatePicker and
// PeriodPicker: today ringed, the selected day filled, Saturdays orange and
// Sundays red, days before `min` / on `disabledWeekdays` struck through.

const WEEKEND_TEXT_CLASS = {
  saturday: { enabled: "text-orange-600", disabled: "text-orange-300" },
  sunday: { enabled: "text-red-600", disabled: "text-red-300" },
} as const;

export default function CalendarDayGrid({
  month,
  value,
  onSelect,
  min,
  disabledWeekdays,
  locale,
}: {
  // Any date in the month shown.
  month: Date;
  // "YYYY-MM-DD" or "".
  value: string;
  onSelect: (iso: string) => void;
  min?: string;
  disabledWeekdays?: number[];
  locale: CalendarLocale;
}) {
  const today = toIsoDate(new Date());

  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500">
        {WEEKDAY_LABELS[locale].map((label, index) => (
          <div
            key={label}
            className={`py-1 ${index === 5 ? WEEKEND_TEXT_CLASS.saturday.enabled : index === 6 ? WEEKEND_TEXT_CLASS.sunday.enabled : ""}`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {buildCalendarDays(month).map((day) => {
          const disabled = isCalendarDayDisabled(day.iso, { min, disabledWeekdays });
          const selected = day.iso === value;
          const weekend = getWeekendDay(day.iso);
          const dimmed = disabled || !day.inCurrentMonth;
          const weekendClass = weekend ? WEEKEND_TEXT_CLASS[weekend][dimmed ? "disabled" : "enabled"] : "";

          return (
            <button
              key={day.iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(day.iso)}
              className={`h-10 rounded-md text-sm transition ${
                selected
                  ? "bg-logoblue! text-white font-bold"
                  : disabled
                    ? `cursor-not-allowed line-through ${weekendClass || "text-neutral-300"}`
                    : day.inCurrentMonth
                      ? `hover:bg-black/5 ${weekendClass}`
                      : `hover:bg-black/5 ${weekendClass || "text-neutral-300"}`
              } ${day.iso === today && !selected ? "ring-1 ring-logoblue" : ""}`}
            >
              {day.dayOfMonth}
            </button>
          );
        })}
      </div>
    </>
  );
}

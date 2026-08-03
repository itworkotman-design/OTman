"use client";

import { useMemo, useState } from "react";
import type { RecurrenceType } from "@prisma/client";
import { toIsoDate, getOsloDateKey } from "@/lib/dates/isoDate";

export type ReminderRecurrenceConfigDraft = {
  weekdays: number[];
  dayOfMonth: number;
  dates: string[];
};

type Props = {
  dueAt: string;
  onDueAtChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  recurrenceType: RecurrenceType | null;
  onRecurrenceTypeChange: (type: RecurrenceType | null) => void;
  recurrenceConfig: ReminderRecurrenceConfigDraft;
  onRecurrenceConfigChange: (config: ReminderRecurrenceConfigDraft) => void;
  locale: string;
  disabled?: boolean;
};

const WEEKDAY_LABELS: Record<string, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  nb: ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"],
};

// UI displays Mon-first (index 0..6); JS Date#getDay() is Sun-first (0..6).
const ISO_TO_JS_DAY = [1, 2, 3, 4, 5, 6, 0];

const YEAR_RANGE_BACK = 1;
const YEAR_RANGE_FORWARD = 5;

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildCalendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      iso: toIsoDate(current),
      dayOfMonth: current.getDate(),
      inCurrentMonth: current.getMonth() === month.getMonth(),
    };
  });
}

// Same weekly/monthly/custom-dates recurrence model as the Scheduler Orders
// RecurrencePicker (app/_components/Dahsboard/automaticOrders/RecurrencePicker.tsx),
// minus the order-specific leadTimeDays/startDate/endDate fields (a reminder
// anchors off the folder/item's own dueAt, not a separate template window),
// plus an "Once" option (a reminder is allowed to fire a single time on its
// due date without repeating — a scheduler order template never has that
// choice) and a year selector on the custom-dates calendar so dates further
// out than a few months away can be reached without repeated
// month-by-month clicking.
//
// Due date and the reminder description live inside this same container
// (not as separate fields above it in the parent) per explicit user
// request — "Once"/Weekly/Monthly/Custom dates are all just different
// answers to "when does this due date fire", so the due date itself
// belongs with the picker that controls its behavior, not floating outside
// it.
export function ReminderRecurrencePicker({
  dueAt,
  onDueAtChange,
  description,
  onDescriptionChange,
  recurrenceType,
  onRecurrenceTypeChange,
  recurrenceConfig,
  onRecurrenceConfigChange,
  locale,
  disabled = false,
}: Props) {
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const weekdayLabels = WEEKDAY_LABELS[locale] ?? WEEKDAY_LABELS.en;

  const currentYear = Number(getOsloDateKey().slice(0, 4));
  const yearOptions = Array.from(
    { length: YEAR_RANGE_BACK + YEAR_RANGE_FORWARD + 1 },
    (_, i) => currentYear - YEAR_RANGE_BACK + i,
  );

  function setCalendarYear(year: number) {
    setCalendarMonth((m) => new Date(year, m.getMonth(), 1));
  }

  function setCalendarMonthIndex(monthIndex: number) {
    setCalendarMonth((m) => new Date(m.getFullYear(), monthIndex, 1));
  }

  function toggleWeekday(isoIndex: number) {
    const jsDay = ISO_TO_JS_DAY[isoIndex];
    const nextWeekdays = recurrenceConfig.weekdays.includes(jsDay)
      ? recurrenceConfig.weekdays.filter((d) => d !== jsDay)
      : [...recurrenceConfig.weekdays, jsDay];

    onRecurrenceConfigChange({ ...recurrenceConfig, weekdays: nextWeekdays });
  }

  function toggleCustomDate(iso: string) {
    const nextDates = recurrenceConfig.dates.includes(iso)
      ? recurrenceConfig.dates.filter((d) => d !== iso)
      : [...recurrenceConfig.dates, iso].sort();

    onRecurrenceConfigChange({ ...recurrenceConfig, dates: nextDates });
  }

  const monthLabels = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(locale === "nb" ? "nb-NO" : "en-GB", { month: "long" }),
  );

  return (
    <div className="rounded-xl border border-lineSecondary p-4">
      <h3 className="mb-3 text-lg font-semibold text-logoblue">
        {locale === "nb" ? "Gjentakelse" : "Recurrence"}
      </h3>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onRecurrenceTypeChange(null)}
          className={`customButtonDefault ${recurrenceType === null ? "customButtonEnabled" : ""}`}
          disabled={disabled}
        >
          {locale === "nb" ? "Engangs" : "Once"}
        </button>
        {(["WEEKLY", "MONTHLY", "CUSTOM_DATES"] as RecurrenceType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onRecurrenceTypeChange(type)}
            className={`customButtonDefault ${recurrenceType === type ? "customButtonEnabled" : ""}`}
            disabled={disabled}
          >
            {type === "WEEKLY"
              ? locale === "nb" ? "Ukentlig" : "Weekly"
              : type === "MONTHLY"
                ? locale === "nb" ? "Månedlig" : "Monthly"
                : locale === "nb" ? "Egendefinert" : "Custom dates"}
          </button>
        ))}
      </div>

      <div className="mb-4 min-w-[160]">
        <label className="block pb-2 text-sm text-textColorThird">{locale === "nb" ? "Forfallsdato" : "Due date"}</label>
        <input
          type="date"
          className="customInput w-full max-w-[240]"
          value={dueAt}
          onChange={(e) => onDueAtChange(e.target.value)}
          disabled={disabled}
        />
      </div>

      {recurrenceType === "WEEKLY" && (
        <div className="mb-2 flex flex-wrap gap-2">
          {weekdayLabels.map((label, isoIndex) => {
            const jsDay = ISO_TO_JS_DAY[isoIndex];
            const selected = recurrenceConfig.weekdays.includes(jsDay);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleWeekday(isoIndex)}
                className={`customButtonDefault ${selected ? "customButtonEnabled" : ""}`}
                disabled={disabled}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {recurrenceType === "MONTHLY" && (
        <div className="mb-2">
          <label className="mb-1 block text-sm font-medium">
            {locale === "nb" ? "Dag i måneden" : "Day of month"}
          </label>
          <input
            type="number"
            min={1}
            max={31}
            className="customInput w-24"
            value={recurrenceConfig.dayOfMonth}
            onChange={(e) =>
              onRecurrenceConfigChange({
                ...recurrenceConfig,
                dayOfMonth: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
              })
            }
            disabled={disabled}
          />
          <p className="mt-1 text-xs text-textColorThird">
            {locale === "nb"
              ? "Hvis måneden er kortere, brukes siste dag i måneden."
              : "If a month is shorter, the last day of the month is used."}
          </p>
        </div>
      )}

      {recurrenceType === "CUSTOM_DATES" && (
        <div className="mb-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select
              className="customInput"
              value={calendarMonth.getMonth()}
              onChange={(e) => setCalendarMonthIndex(Number(e.target.value))}
              disabled={disabled}
            >
              {monthLabels.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="customInput"
              value={calendarMonth.getFullYear()}
              onChange={(e) => setCalendarYear(Number(e.target.value))}
              disabled={disabled}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {weekdayLabels.map((label) => (
              <div key={label} className="py-1 text-textColorThird">
                {label}
              </div>
            ))}
            {calendarDays.map((day) => {
              const selected = recurrenceConfig.dates.includes(day.iso);
              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => toggleCustomDate(day.iso)}
                  className={`rounded-lg py-1.5 ${
                    selected
                      ? "bg-logoblue text-white"
                      : day.inCurrentMonth
                        ? "hover:bg-linePrimary"
                        : "text-textColorThird/50 hover:bg-linePrimary"
                  }`}
                  disabled={disabled}
                >
                  {day.dayOfMonth}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-textColorThird">
            {recurrenceConfig.dates.length} {locale === "nb" ? "datoer valgt" : "dates selected"}
          </p>
        </div>
      )}

      <div className="mt-4">
        <label className="block pb-2 text-sm text-textColorThird">
          {locale === "nb" ? "Påminnelsesbeskrivelse" : "Reminder description"}
        </label>
        <textarea
          className="customInput w-full"
          rows={2}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          placeholder={
            locale === "nb"
              ? "Vises i påminnelseslisten i stedet for den vanlige beskrivelsen"
              : "Shown in the reminders list instead of the regular description"
          }
        />
      </div>
    </div>
  );
}

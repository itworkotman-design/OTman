"use client";

import { useMemo, useState } from "react";
import type { RecurrenceType } from "@prisma/client";
import { parseIsoDate, toIsoDate } from "@/lib/dates/isoDate";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

export type RecurrenceConfigDraft = {
  weekdays: number[];
  dayOfMonth: number;
  dates: string[];
};

type Props = {
  recurrenceType: RecurrenceType;
  onRecurrenceTypeChange: (type: RecurrenceType) => void;
  recurrenceConfig: RecurrenceConfigDraft;
  onRecurrenceConfigChange: (config: RecurrenceConfigDraft) => void;
  leadTimeDays: number;
  onLeadTimeDaysChange: (days: number) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string | null;
  onEndDateChange: (date: string | null) => void;
  locale?: BookingUiLocale;
};

const WEEKDAY_LABELS: Record<BookingUiLocale, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  nb: ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"],
};

// UI displays Mon-first (index 0..6); JS Date#getDay() is Sun-first (0..6).
const ISO_TO_JS_DAY = [1, 2, 3, 4, 5, 6, 0];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
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

export default function RecurrencePicker({
  recurrenceType,
  onRecurrenceTypeChange,
  recurrenceConfig,
  onRecurrenceConfigChange,
  leadTimeDays,
  onLeadTimeDaysChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  locale = "en",
}: Props) {
  const t = (text: string) => bookingText(locale, text);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const parsed = parseIsoDate(startDate);
    return startOfMonth(parsed ?? new Date());
  });

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

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

  return (
    <div className="rounded-xl border border-lineSecondary p-4">
      <h3 className="mb-3 text-lg font-semibold text-logoblue">
        {locale === "nb" ? "Gjentakelse" : "Recurrence"}
      </h3>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["WEEKLY", "MONTHLY", "CUSTOM_DATES"] as RecurrenceType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onRecurrenceTypeChange(type)}
            className={`customButtonDefault ${recurrenceType === type ? "customButtonEnabled" : ""}`}
          >
            {type === "WEEKLY"
              ? locale === "nb" ? "Ukentlig" : "Weekly"
              : type === "MONTHLY"
                ? locale === "nb" ? "Månedlig" : "Monthly"
                : locale === "nb" ? "Egendefinert" : "Custom dates"}
          </button>
        ))}
      </div>

      {recurrenceType === "WEEKLY" && (
        <div className="mb-4 flex flex-wrap gap-2">
          {WEEKDAY_LABELS[locale].map((label, isoIndex) => {
            const jsDay = ISO_TO_JS_DAY[isoIndex];
            const selected = recurrenceConfig.weekdays.includes(jsDay);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleWeekday(isoIndex)}
                className={`customButtonDefault ${selected ? "customButtonEnabled" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {recurrenceType === "MONTHLY" && (
        <div className="mb-4">
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
          />
          <p className="mt-1 text-xs text-textColorThird">
            {locale === "nb"
              ? "Hvis måneden er kortere, brukes siste dag i måneden."
              : "If a month is shorter, the last day of the month is used."}
          </p>
        </div>
      )}

      {recurrenceType === "CUSTOM_DATES" && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="customButtonDefault"
              onClick={() => setCalendarMonth((m) => addMonths(m, -1))}
            >
              ‹
            </button>
            <span className="font-medium">
              {calendarMonth.toLocaleDateString(locale === "nb" ? "nb-NO" : "en-GB", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              className="customButtonDefault"
              onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEKDAY_LABELS[locale].map((label) => (
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

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">{t("Delivery date")}: {locale === "nb" ? "start" : "start"}</label>
          <input
            type="date"
            className="customInput"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={endDate !== null}
              onChange={(e) => onEndDateChange(e.target.checked ? startDate : null)}
            />
            {locale === "nb" ? "Sluttdato" : "End date"}
          </label>
          {endDate !== null && (
            <input
              type="date"
              className="customInput"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            {locale === "nb" ? "Antall dager i forkant" : "Lead time (days)"}
          </label>
          <input
            type="number"
            min={0}
            className="customInput w-24"
            value={leadTimeDays}
            onChange={(e) => onLeadTimeDaysChange(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
      </div>
    </div>
  );
}

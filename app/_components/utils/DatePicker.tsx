"use client";

import { useEffect, useRef, useState } from "react";
import { addMonths, buildCalendarDays, resolveVisibleMonth, startOfMonth } from "@/lib/dates/calendarGrid";
import { compareIsoDate, parseIsoDate } from "@/lib/dates/isoDate";

type DatePickerLocale = "en" | "no";

type Props = {
  // ISO yyyy-mm-dd, or "" for no selection.
  value: string;
  onChange: (value: string) => void;
  locale?: DatePickerLocale;
  placeholder?: string;
  // Styling for the trigger button — pass the same class the app uses for
  // its text inputs (e.g. `inputClass`) to match surrounding fields.
  className?: string;
  disabled?: boolean;
  // ISO yyyy-mm-dd — days before this are shown greyed-out and unselectable.
  minDate?: string;
  // Date.getDay() values (0 = Sunday … 6 = Saturday) that are always
  // greyed-out and unselectable — e.g. [0] to turn off Sunday delivery.
  blockedWeekdays?: number[];
  // Extra per-date predicate for greying out/blocking individual days on
  // top of minDate/blockedWeekdays — e.g. public holidays.
  isDateBlocked?: (iso: string) => boolean;
};

const WEEKDAY_LABELS: Record<DatePickerLocale, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  no: ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"],
};

function formatDisplayDate(value: string, locale: DatePickerLocale): string {
  const date = parseIsoDate(value);
  if (!date) return "";

  return date.toLocaleDateString(locale === "no" ? "nb-NO" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getMonthLabel(month: Date, locale: DatePickerLocale): string {
  return month.toLocaleDateString(locale === "no" ? "nb-NO" : "en-GB", {
    month: "long",
    year: "numeric",
  });
}

export default function DatePicker({
  value,
  onChange,
  locale = "en",
  placeholder,
  className = "h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-sm text-black/85 outline-none transition",
  disabled = false,
  minDate,
  blockedWeekdays = [],
  isDateBlocked,
}: Props) {
  const isDaySelectable = (iso: string): boolean => {
    if (minDate && compareIsoDate(iso, minDate) < 0) return false;
    if (blockedWeekdays.length > 0) {
      const date = parseIsoDate(iso);
      if (date && blockedWeekdays.includes(date.getDay())) return false;
    }
    if (isDateBlocked?.(iso)) return false;
    return true;
  };

  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    return resolveVisibleMonth(parseIsoDate(value) ?? new Date(), isDaySelectable);
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open) {
      setVisibleMonth(resolveVisibleMonth(parseIsoDate(value) ?? new Date(), isDaySelectable));
    }
    setOpen((current) => !current);
  };

  const handleDaySelect = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const displayValue = formatDisplayDate(value, locale);
  const minMonth = minDate ? startOfMonth(parseIsoDate(minDate) ?? new Date()) : null;
  const canGoToPreviousMonth = !minMonth || startOfMonth(addMonths(visibleMonth, -1)) >= minMonth;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`text-left disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span className={displayValue ? "" : "text-black/35"}>
          {displayValue || placeholder || ""}
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-72 rounded-xl border border-black/10 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
              disabled={!canGoToPreviousMonth}
              className="grid h-8 w-8 place-items-center rounded-md text-black/50 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label={locale === "no" ? "Forrige måned" : "Previous month"}
            >
              ‹
            </button>
            <div className="text-sm font-semibold capitalize text-logoblue">
              {getMonthLabel(visibleMonth, locale)}
            </div>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              className="grid h-8 w-8 place-items-center rounded-md text-black/50 hover:bg-black/5"
              aria-label={locale === "no" ? "Neste måned" : "Next month"}
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500">
            {WEEKDAY_LABELS[locale].map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {buildCalendarDays(visibleMonth).map((day) => {
              const isSelected = day.iso === value;
              const isHoliday = Boolean(isDateBlocked?.(day.iso));
              const isDisabled = !isDaySelectable(day.iso);

              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => handleDaySelect(day.iso)}
                  disabled={isDisabled}
                  title={isHoliday ? (locale === "no" ? "Rød dag" : "Public holiday") : undefined}
                  className={`h-9 rounded-md text-sm transition disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                    isSelected
                      ? "bg-logoblue! font-bold text-white"
                      : isHoliday
                        ? "bg-red-50 text-red-300 disabled:bg-red-50"
                        : day.inCurrentMonth
                          ? isDisabled
                            ? "text-neutral-200 hover:bg-black/5"
                            : "hover:bg-black/5"
                          : "text-neutral-300 hover:bg-black/5"
                  }`}
                >
                  {day.dayOfMonth}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

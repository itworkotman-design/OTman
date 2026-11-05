"use client";

import { useEffect, useRef, useState } from "react";
import { parseIsoDate } from "@/lib/dates/isoDate";
import { addMonths, getMonthLabel, startOfMonth } from "@/lib/dates/calendarMonth";
import CalendarDayGrid from "./CalendarDayGrid";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

type Props = {
  id?: string;
  // "YYYY-MM-DD" or "".
  value: string;
  onChange: (value: string) => void;
  min?: string;
  // Date.getDay() numbering (0 = Sunday).
  disabledWeekdays?: number[];
  locale?: BookingUiLocale;
  placeholder?: string;
  className?: string;
};

function formatDisplayDate(value: string, locale: BookingUiLocale): string {
  const date = parseIsoDate(value);
  if (!date) return value;

  return date.toLocaleDateString(locale === "nb" ? "nb-NO" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Single-date version of the archive filter's custom calendar popover; a
// replacement for <input type="date">.

export default function DatePicker({
  id,
  value,
  onChange,
  min,
  disabledWeekdays,
  locale = "en",
  placeholder,
  className = "",
}: Props) {
  const t = (text: string) => bookingText(locale, text);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseIsoDate(value) ?? new Date()));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const toggleOpen = () => {
    if (!open) setVisibleMonth(startOfMonth(parseIsoDate(value) ?? new Date()));
    setOpen((current) => !current);
  };

  const handleSelect = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={toggleOpen}
        className={`customInput flex w-full items-center justify-between text-left ${className}`}
      >
        <span className={value ? "text-black" : "text-neutral-500"}>
          {value ? formatDisplayDate(value, locale) : (placeholder ?? (locale === "nb" ? "Velg dato" : "Select date"))}
        </span>
        <span className="text-xs text-neutral-500">{open ? t("Close") : t("Select")}</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-full min-w-80 max-w-sm rounded-xl border border-black/10 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
              className="customButtonDefault h-9 px-3"
            >
              {t("Previous")}
            </button>
            <div className="text-center text-sm font-semibold capitalize text-logoblue">
              {getMonthLabel(visibleMonth, locale)}
            </div>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              className="customButtonDefault h-9 px-3"
            >
              {t("Next")}
            </button>
          </div>

          <CalendarDayGrid month={visibleMonth} value={value} onSelect={handleSelect} min={min} disabledWeekdays={disabledWeekdays} locale={locale} />
        </div>
      ) : null}
    </div>
  );
}

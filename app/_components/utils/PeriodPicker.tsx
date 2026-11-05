"use client";

import { useEffect, useRef, useState } from "react";
import { parseIsoDate } from "@/lib/dates/isoDate";
import { addMonths, buildYearMonths, getMonthLabel, startOfMonth } from "@/lib/dates/calendarMonth";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import CalendarDayGrid from "./CalendarDayGrid";

// Picks a whole month or a single day, in the same style as DatePicker. Opens
// on the month view (a year's twelve months); "Day" switches to the day
// calendar. Used for the web-sales report (WebSalesReportSection).

export type PeriodValue = { kind: "month"; month: string } | { kind: "day"; date: string };

type View = PeriodValue["kind"];

const monthDate = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return new Date(year, monthNumber - 1, 1);
};

export function formatPeriod(value: PeriodValue, locale: BookingUiLocale): string {
  if (value.kind === "month") {
    const label = getMonthLabel(monthDate(value.month), locale);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  const date = parseIsoDate(value.date);
  return date
    ? date.toLocaleDateString(locale === "nb" ? "nb-NO" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
    : value.date;
}

const TEXT = {
  nb: { month: "Måned", day: "Dag" },
  en: { month: "Month", day: "Day" },
} as const;

export default function PeriodPicker({
  value,
  onChange,
  locale = "en",
  className = "",
}: {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  locale?: BookingUiLocale;
  className?: string;
}) {
  const t = (text: string) => bookingText(locale, text);
  const text = locale === "nb" ? TEXT.nb : TEXT.en;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>(value.kind);
  // The month the popover shows: its year in the month view, the month itself in the day view.
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
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
    if (!open) {
      setView(value.kind);
      setVisibleMonth(startOfMonth(value.kind === "month" ? monthDate(value.month) : (parseIsoDate(value.date) ?? new Date())));
    }
    setOpen((current) => !current);
  };

  const select = (next: PeriodValue) => {
    onChange(next);
    setOpen(false);
  };

  const year = visibleMonth.getFullYear();
  const viewButton = (target: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(target)}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        view === target ? "bg-logoblue text-white" : "text-slate-600 hover:bg-black/5"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={toggleOpen} className={`customInput flex w-full items-center justify-between gap-3 text-left ${className}`}>
        <span className="text-black">{formatPeriod(value, locale)}</span>
        <span className="text-xs text-neutral-500">{open ? t("Close") : t("Select")}</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-black/10 bg-white p-3 shadow-xl">
          <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
            {viewButton("month", text.month)}
            {viewButton("day", text.day)}
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonths(current, view === "month" ? -12 : -1))}
              className="customButtonDefault h-9 px-3"
            >
              {t("Previous")}
            </button>
            <div className="text-center text-sm font-semibold capitalize text-logoblue">
              {view === "month" ? year : getMonthLabel(visibleMonth, locale)}
            </div>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonths(current, view === "month" ? 12 : 1))}
              className="customButtonDefault h-9 px-3"
            >
              {t("Next")}
            </button>
          </div>

          {view === "month" ? (
            <div className="grid grid-cols-3 gap-2">
              {buildYearMonths(year, locale).map((month) => {
                const selected = value.kind === "month" && value.month === month.key;
                return (
                  <button
                    key={month.key}
                    type="button"
                    onClick={() => select({ kind: "month", month: month.key })}
                    className={`h-11 rounded-md text-sm transition ${selected ? "bg-logoblue! font-bold text-white" : "hover:bg-black/5"}`}
                  >
                    {month.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <CalendarDayGrid
              month={visibleMonth}
              value={value.kind === "day" ? value.date : ""}
              onSelect={(date) => select({ kind: "day", date })}
              locale={locale}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

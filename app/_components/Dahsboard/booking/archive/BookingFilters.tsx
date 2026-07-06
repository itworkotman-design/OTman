"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { BookingArchiveFilters, BookingArchiveOption } from "./types";
import {
  DEFAULT_BOOKING_ARCHIVE_FILTERS,
  getLastMonthRange,
  getThisMonthRange,
  getThisWeekRange,
  getTodayRange,
  getTomorrowRange,
} from "@/lib/orders/archiveFilters";
import {
  bookingStatusText,
  bookingText,
  type BookingUiLocale,
} from "@/lib/booking/bookingUiText";
import { parseIsoDate, toIsoDate } from "@/lib/dates/isoDate";

type Props = {
  initialApplied: BookingArchiveFilters;
  access: {
    canFilterCreatedBy: boolean;
    canFilterSubcontractor: boolean;
    lockedCreatedById?: string;
    lockedSubcontractorId?: string;
  };
  subcontractors: BookingArchiveOption[];
  creators: BookingArchiveOption[];
  onApply: (filters: BookingArchiveFilters) => void;
  onReset: () => void;
  onRefresh?: () => void;
  onDownloadSelectedTable?: () => void;
  downloadSelectedTableDisabled?: boolean;
  downloadSelectedTableLabel?: string;
  displayedOrderCount?: number;
  locale?: BookingUiLocale;
};

type CalendarDay = {
  iso: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
};

const MAX_ARCHIVE_ROWS_PER_PAGE = 10000;

const WEEKDAY_LABELS: Record<BookingUiLocale, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  nb: ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"],
};

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function buildCalendarDays(month: Date): CalendarDay[] {
  const firstDay = startOfMonth(month);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth(),
    1 - firstWeekday,
  );

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + index,
    );

    return {
      iso: toIsoDate(current),
      dayOfMonth: current.getDate(),
      inCurrentMonth: current.getMonth() === month.getMonth(),
    };
  });
}

function formatDisplayDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatRangeLabel(
  fromDate: string,
  toDate: string,
  locale: BookingUiLocale,
): string {
  if (fromDate && toDate) {
    return `${formatDisplayDate(fromDate)} - ${formatDisplayDate(toDate)}`;
  }

  if (fromDate) {
    return `${formatDisplayDate(fromDate)} - ${bookingText(locale, "Select")}`;
  }

  return locale === "nb" ? "Velg datoperiode" : "Select date range";
}

function getMonthLabel(month: Date, locale: BookingUiLocale): string {
  return month.toLocaleDateString(locale === "nb" ? "nb-NO" : "en-GB", {
    month: "long",
    year: "numeric",
  });
}

function isIsoWithinRange(value: string, fromDate: string, toDate: string): boolean {
  if (!fromDate || !toDate) return false;
  return value >= fromDate && value <= toDate;
}

function isRangeBoundary(value: string, fromDate: string, toDate: string): boolean {
  return value === fromDate || value === toDate;
}

export default function BookingFilters({
  initialApplied,
  access,
  subcontractors,
  creators,
  onApply,
  onReset,
  onDownloadSelectedTable,
  downloadSelectedTableDisabled = false,
  downloadSelectedTableLabel,
  displayedOrderCount,
  locale = "en",
}: Props) {
  const t = (text: string) => bookingText(locale, text);
  const onApplyRef = useRef(onApply);
  useEffect(() => {
    onApplyRef.current = onApply;
  }, [onApply]);

  const [status, setStatus] = useState(initialApplied.status);
  const [createdById, setCreatedById] = useState(
    access.lockedCreatedById ?? initialApplied.createdById,
  );
  const [subcontractorId, setSubcontractorId] = useState(
    access.lockedSubcontractorId ?? initialApplied.subcontractorId,
  );
  const [fromDate, setFromDate] = useState(initialApplied.fromDate);
  const [toDate, setToDate] = useState(initialApplied.toDate);
  const [search, setSearch] = useState(initialApplied.search);
  const [rowsPerPage, setRowsPerPage] = useState<number>(
    initialApplied.rowsPerPage,
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const skipAutoApplyRef = useRef(true);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialMonth =
      parseIsoDate(initialApplied.fromDate) ??
      parseIsoDate(initialApplied.toDate) ??
      new Date();
    return startOfMonth(initialMonth);
  });

  const rangeLabel = useMemo(
    () => formatRangeLabel(fromDate, toDate, locale),
    [fromDate, locale, toDate],
  );

  const calendars = useMemo(
    () => [visibleMonth, addMonths(visibleMonth, 1)],
    [visibleMonth],
  );
  const showDisplayedCountPlaceholder =
    rowsPerPage === MAX_ARCHIVE_ROWS_PER_PAGE &&
    Boolean(fromDate || toDate) &&
    typeof displayedOrderCount === "number";
  const rowsPerPageInputValue = showDisplayedCountPlaceholder
    ? ""
    : String(rowsPerPage);
  const rowsPerPagePlaceholder = showDisplayedCountPlaceholder
    ? `${locale === "nb" ? "Viser" : "Showing"} ${displayedOrderCount}`
    : t("Type any number");

  useEffect(() => {
    if (skipAutoApplyRef.current) {
      skipAutoApplyRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      onApplyRef.current({
        status,
        createdById: access.lockedCreatedById ?? createdById,
        subcontractorId: access.lockedSubcontractorId ?? subcontractorId,
        fromDate,
        toDate,
        search,
        rowsPerPage,
        page: 1,
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    access.lockedCreatedById,
    access.lockedSubcontractorId,
    createdById,
    fromDate,
    rowsPerPage,
    search,
    status,
    subcontractorId,
    toDate,
  ]);

  const handleReset = () => {
    skipAutoApplyRef.current = true;
    setStatus(DEFAULT_BOOKING_ARCHIVE_FILTERS.status);
    setCreatedById(
      access.lockedCreatedById ?? DEFAULT_BOOKING_ARCHIVE_FILTERS.createdById,
    );
    setSubcontractorId(
      access.lockedSubcontractorId ??
        DEFAULT_BOOKING_ARCHIVE_FILTERS.subcontractorId,
    );
    setFromDate(DEFAULT_BOOKING_ARCHIVE_FILTERS.fromDate);
    setToDate(DEFAULT_BOOKING_ARCHIVE_FILTERS.toDate);
    setSearch(DEFAULT_BOOKING_ARCHIVE_FILTERS.search);
    setRowsPerPage(DEFAULT_BOOKING_ARCHIVE_FILTERS.rowsPerPage);
    setVisibleMonth(startOfMonth(new Date()));
    setDatePickerOpen(false);

    onReset();
  };

  const applyRange = (nextFromDate: string, nextToDate: string) => {
    setFromDate(nextFromDate);
    setToDate(nextToDate);

    const anchorDate = parseIsoDate(nextFromDate) ?? new Date();
    setVisibleMonth(startOfMonth(anchorDate));
  };

  const setToday = () => {
    const range = getTodayRange();
    setRowsPerPage(MAX_ARCHIVE_ROWS_PER_PAGE);
    applyRange(range.fromDate, range.toDate);
  };

  const setTomorrow = () => {
    const range = getTomorrowRange();
    setRowsPerPage(MAX_ARCHIVE_ROWS_PER_PAGE);
    applyRange(range.fromDate, range.toDate);
  };

  const setThisWeek = () => {
    const range = getThisWeekRange();
    setRowsPerPage(MAX_ARCHIVE_ROWS_PER_PAGE);
    applyRange(range.fromDate, range.toDate);
  };

  const setThisMonth = () => {
    const range = getThisMonthRange();
    setRowsPerPage(MAX_ARCHIVE_ROWS_PER_PAGE);
    applyRange(range.fromDate, range.toDate);
  };

  const setLastMonth = () => {
    const range = getLastMonthRange();
    setRowsPerPage(MAX_ARCHIVE_ROWS_PER_PAGE);
    applyRange(range.fromDate, range.toDate);
  };

  const clearDateRange = () => {
    setFromDate("");
    setToDate("");
  };

  const handleDaySelect = (selectedDate: string) => {
    if (!fromDate || toDate) {
      setFromDate(selectedDate);
      setToDate("");
      return;
    }

    if (selectedDate < fromDate) {
      setRowsPerPage(MAX_ARCHIVE_ROWS_PER_PAGE);
      setFromDate(selectedDate);
      setToDate(fromDate);
    } else {
      setRowsPerPage(MAX_ARCHIVE_ROWS_PER_PAGE);
      setToDate(selectedDate);
    }

    setDatePickerOpen(false);
  };

  return (
    <section className="customContainer w-full max-w-[1000] padding-weird-landscape [@media_(orientation:landscape)_and_(max-height:800px)_and_(min-width:900px)]:max-w-[700] [@media_(orientation:landscape)_and_(max-height:800px)_and_(min-width:900px)]:shadow-none!">
      <div>
        <div className={`grid grid-cols-1 gap-3 ${access.canFilterSubcontractor ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <Field label={t("Status")}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="customInput padding-weird-landscape text-weird-landscape w-full">
              <option value="">{t("All statuses")}</option>
              <option value="processing">{bookingStatusText(locale, "processing")}</option>
              <option value="confirmed">{bookingStatusText(locale, "confirmed")}</option>
              <option value="active">{bookingStatusText(locale, "active")}</option>
              <option value="cancelled">{bookingStatusText(locale, "cancelled")}</option>
              <option value="failed">{bookingStatusText(locale, "failed")}</option>
              <option value="completed">{bookingStatusText(locale, "completed")}</option>
              <option value="invoiced">{bookingStatusText(locale, "invoiced")}</option>
              <option value="paid">{bookingStatusText(locale, "paid")}</option>
            </select>
          </Field>

          {access.canFilterCreatedBy && (
            <Field label={t("Store")}>
              <select
                value={createdById}
                onChange={(e) => setCreatedById(e.target.value)}
                className="customInput padding-weird-landscape text-weird-landscape w-full"
              >
                <option value="">{t("All stores")}</option>
                {creators.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {access.canFilterSubcontractor && (
            <Field label={t("Subcontractor")}>
              <select
                value={subcontractorId}
                onChange={(e) => setSubcontractorId(e.target.value)}
                className="customInput padding-weird-landscape text-weird-landscape w-full"
              >
                <option value="">{t("All subcontractors")}</option>
                {subcontractors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field label={t("Dates")} className="min-w-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setDatePickerOpen((current) => !current)}
                className="customInput padding-weird-landscape text-weird-landscape flex w-full items-center justify-between text-left"
              >
                <span className={fromDate ? "text-black" : "text-neutral-500"}>{rangeLabel}</span>
                <span className="text-xs text-neutral-500 text-weird-landscape">{datePickerOpen ? t("Close") : t("Select")}</span>
              </button>

              {datePickerOpen ? (
                <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-full rounded-xl border border-black/10 bg-white p-3 shadow-xl padding-weird-landscape">
                  <div className="mb-3 flex items-center justify-between gap-2 margin-weird-landscape text-weird-landscape">
                    <button
                      type="button"
                      onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                      className="customButtonDefault h-9 px-3 padding-weird-landscape height-weird-landscape"
                    >
                      {t("Previous")}
                    </button>
                    <button type="button" onClick={clearDateRange} className="customButtonDefault h-9 px-3 padding-weird-landscape height-weird-landscape">
                      {t("Clear dates")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                      className="customButtonDefault h-9 px-3 padding-weird-landscape height-weird-landscape"
                    >
                      {t("Next")}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {calendars.map((month) => (
                      <div key={toIsoDate(month)} className="rounded-lg border border-black/5 p-2">
                        <div className="mb-2 text-center text-sm font-semibold capitalize text-logoblue text-weird-landscape">
                          {getMonthLabel(month, locale)}
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500 text-weird-landscape">
                          {WEEKDAY_LABELS[locale].map((label) => (
                            <div key={label} className="py-1">
                              {label}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {buildCalendarDays(month).map((day) => {
                            const inRange = isIsoWithinRange(day.iso, fromDate, toDate);
                            const isBoundary = isRangeBoundary(day.iso, fromDate, toDate);
                            const isPendingStart = fromDate === day.iso && !toDate;

                            return (
                              <button
                                key={day.iso}
                                type="button"
                                onClick={() => handleDaySelect(day.iso)}
                                className={`h-10 rounded-md text-sm transition height-weird-landscape text-weird-landscape ${
                                  isBoundary || isPendingStart
                                    ? "bg-logoblue! text-white font-bold "
                                    : inRange
                                      ? "bg-logoblue/10 text-logoblue"
                                      : day.inCurrentMonth
                                        ? "hover:bg-black/5"
                                        : "text-neutral-300 hover:bg-black/5"
                                }`}
                              >
                                {day.dayOfMonth}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Field>

          <div className="flex items-end gap-2 md:flex-nowrap">
            <button type="button" onClick={setToday} className="customButtonDefault h-10 whitespace-nowrap px-3 text-weird-landscape padding-weird-landscape">
              {t("Today")}
            </button>
            <button
              type="button"
              onClick={setTomorrow}
              className="customButtonDefault h-10 whitespace-nowrap px-3 text-weird-landscape padding-weird-landscape"
            >
              {t("Tomorrow")}
            </button>
            <button
              type="button"
              onClick={setThisWeek}
              className="customButtonDefault h-10 whitespace-nowrap px-3 text-weird-landscape padding-weird-landscape"
            >
              {t("This week")}
            </button>
            <button
              type="button"
              onClick={setThisMonth}
              className="customButtonDefault h-10 whitespace-nowrap px-3 text-weird-landscape padding-weird-landscape"
            >
              {t("This month")}
            </button>
            <button
              type="button"
              onClick={setLastMonth}
              className="customButtonDefault h-10 whitespace-nowrap px-3 text-weird-landscape padding-weird-landscape"
            >
              {locale === "nb" ? "Forrige måned" : "Last month"}
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 [@media_(orientation:landscape)_and_(max-height:800px)_and_(min-width:900px)]:gap-1">
          <Field label={t("Search")}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search ID, name, phone, order no...")}
              className="customInput w-full padding-weird-landscape text-weird-landscape"
            />
          </Field>

          <Field label={t("Orders per page")}>
            <div className="space-y-2">
              <input
                type="text"
                inputMode="numeric"
                value={rowsPerPageInputValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return;
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  setRowsPerPage(Math.max(1, Math.min(MAX_ARCHIVE_ROWS_PER_PAGE, Math.floor(n))));
                }}
                onBlur={(e) => {
                  if (e.target.value === "") {
                    setRowsPerPage(DEFAULT_BOOKING_ARCHIVE_FILTERS.rowsPerPage);
                  }
                }}
                className="customInput w-full text-weird-landscape padding-weird-landscape"
                placeholder={rowsPerPagePlaceholder}
              />
              <div className="flex flex-wrap gap-2 [@media_(orientation:landscape)_and_(max-height:800px)_and_(min-width:900px)]:gap-1">
                {[10, 25, 50, 100, 250].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                      setRowsPerPage(n);
                    }}
                    className="customButtonDefault mx-auto h-8 px-2 text-xs text-weird-landscape padding-weird-landscape height-weird-landscape"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <div className="flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="customButtonEnabled h-10 text-weird-landscape padding-weird-landscape height-weird-landscape"
            >
              {t("Reset Filters")}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 margin-weird-landscape">
        {onDownloadSelectedTable ? (
          <button
            type="button"
            onClick={onDownloadSelectedTable}
            disabled={downloadSelectedTableDisabled}
            className="customButtonDefault h-10 disabled:opacity-50! disabled:cursor-auto!"
          >
            {downloadSelectedTableLabel ?? "Last ned valgte"}
          </button>
        ) : null}
      </div>
    </section>
  );
  
}


function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-medium text-neutral-600 text-weird-landscape">
        {label}
      </span>
      {children}
    </label>
  );
}

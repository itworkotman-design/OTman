"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { BookingArchiveFilters, BookingArchiveOption } from "./types";
import {
  DEFAULT_BOOKING_ARCHIVE_FILTERS,
  getThisMonthRange,
  getThisWeekRange,
  getTodayRange,
  getTomorrowRange,
} from "@/lib/orders/archiveFilters";

type Props = {
  initialApplied: BookingArchiveFilters;
  access: {
    canFilterCustomer: boolean;
    canFilterSubcontractor: boolean;
    lockedCustomerMembershipId?: string;
    lockedSubcontractorId?: string;
  };
  subcontractors: BookingArchiveOption[];
  creators: BookingArchiveOption[];
  onApply: (filters: BookingArchiveFilters) => void;
  onReset: () => void;
  onRefresh?: () => void;
};

type CalendarDay = {
  iso: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseIsoDate(value: string): Date | null {
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

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function formatRangeLabel(fromDate: string, toDate: string): string {
  if (fromDate && toDate) {
    return `${formatDisplayDate(fromDate)} - ${formatDisplayDate(toDate)}`;
  }

  if (fromDate) {
    return `${formatDisplayDate(fromDate)} - Select end date`;
  }

  return "Select date range";
}

function getMonthLabel(month: Date): string {
  return month.toLocaleDateString("en-GB", {
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
}: Props) {
  const [status, setStatus] = useState(initialApplied.status);
  const [customerMembershipId, setCustomerMembershipId] = useState(
    access.lockedCustomerMembershipId ?? initialApplied.customerMembershipId,
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
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialMonth =
      parseIsoDate(initialApplied.fromDate) ??
      parseIsoDate(initialApplied.toDate) ??
      new Date();
    return startOfMonth(initialMonth);
  });

  const rangeLabel = useMemo(
    () => formatRangeLabel(fromDate, toDate),
    [fromDate, toDate],
  );

  const calendars = useMemo(
    () => [visibleMonth, addMonths(visibleMonth, 1)],
    [visibleMonth],
  );

  const handleApply = () => {
    onApply({
      status,
      customerMembershipId:
        access.lockedCustomerMembershipId ?? customerMembershipId,
      subcontractorId: access.lockedSubcontractorId ?? subcontractorId,
      fromDate,
      toDate,
      search,
      rowsPerPage,
      page: 1,
    });
  };

  const handleReset = () => {
    setStatus(DEFAULT_BOOKING_ARCHIVE_FILTERS.status);
    setCustomerMembershipId(
      access.lockedCustomerMembershipId ??
        DEFAULT_BOOKING_ARCHIVE_FILTERS.customerMembershipId,
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
    applyRange(range.fromDate, range.toDate);
  };

  const setTomorrow = () => {
    const range = getTomorrowRange();
    applyRange(range.fromDate, range.toDate);
  };

  const setThisWeek = () => {
    const range = getThisWeekRange();
    applyRange(range.fromDate, range.toDate);
  };

  const setThisMonth = () => {
    const range = getThisMonthRange();
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
      setFromDate(selectedDate);
      setToDate(fromDate);
    } else {
      setToDate(selectedDate);
    }

    setDatePickerOpen(false);
  };

  return (
    <section className="w-full">
      <div className="customContainer w-full max-w-[1000]">
        <div
          className={`grid grid-cols-1 gap-3 ${
            access.canFilterSubcontractor ? "md:grid-cols-3" : "md:grid-cols-2"
          }`}
        >
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="customInput w-full"
            >
              <option value="">All statuses</option>
              <option value="Processing">Processing</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Fail</option>
              <option value="completed">Completed</option>
              <option value="invoiced">Invoiced</option>
              <option value="paid">Paid</option>
            </select>
          </Field>

          {access.canFilterCustomer && (
            <Field label="Customer">
              <select
                value={customerMembershipId}
                onChange={(e) => setCustomerMembershipId(e.target.value)}
                className="customInput w-full"
              >
                <option value="">All customers</option>
                {creators.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {access.canFilterSubcontractor && (
            <Field label="Subcontractor">
              <select
                value={subcontractorId}
                onChange={(e) => setSubcontractorId(e.target.value)}
                className="customInput w-full"
              >
                <option value="">All subcontractors</option>
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
          <Field label="Dates" className="min-w-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setDatePickerOpen((current) => !current)}
                className="customInput flex w-full items-center justify-between text-left"
              >
                <span className={fromDate ? "text-black" : "text-neutral-500"}>
                  {rangeLabel}
                </span>
                <span className="text-xs text-neutral-500">
                  {datePickerOpen ? "Close" : "Select"}
                </span>
              </button>

              {datePickerOpen ? (
                <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-full rounded-xl border border-black/10 bg-white p-3 shadow-xl">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleMonth((current) => addMonths(current, -1))
                      }
                      className="customButtonDefault h-9 px-3!"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={clearDateRange}
                      className="customButtonDefault h-9 px-3!"
                    >
                      Clear dates
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleMonth((current) => addMonths(current, 1))
                      }
                      className="customButtonDefault h-9 px-3!"
                    >
                      Next
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {calendars.map((month) => (
                      <div
                        key={toIsoDate(month)}
                        className="rounded-lg border border-black/5 p-2"
                      >
                        <div className="mb-2 text-center text-sm font-semibold capitalize text-logoblue">
                          {getMonthLabel(month)}
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500">
                          {WEEKDAY_LABELS.map((label) => (
                            <div key={label} className="py-1">
                              {label}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {buildCalendarDays(month).map((day) => {
                            const inRange = isIsoWithinRange(
                              day.iso,
                              fromDate,
                              toDate,
                            );
                            const isBoundary = isRangeBoundary(
                              day.iso,
                              fromDate,
                              toDate,
                            );
                            const isPendingStart =
                              fromDate === day.iso && !toDate;

                            return (
                              <button
                                key={day.iso}
                                type="button"
                                onClick={() => handleDaySelect(day.iso)}
                                className={`h-10 rounded-md text-sm transition ${
                                  isBoundary || isPendingStart
                                    ? "bg-logoblue text-white"
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
            <button
              type="button"
              onClick={setToday}
              className="customButtonDefault h-10 whitespace-nowrap px-3!"
            >
              Today
            </button>
            <button
              type="button"
              onClick={setTomorrow}
              className="customButtonDefault h-10 whitespace-nowrap px-3!"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={setThisWeek}
              className="customButtonDefault h-10 whitespace-nowrap px-3!"
            >
              This week
            </button>
            <button
              type="button"
              onClick={setThisMonth}
              className="customButtonDefault h-10 whitespace-nowrap px-3!"
            >
              This month
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, name, phone, order no..."
              className="customInput w-full"
            />
          </Field>

          <Field label="Orders per page">
            <div className="space-y-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={10000}
                value={Number.isFinite(rowsPerPage) ? rowsPerPage : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return;
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  setRowsPerPage(Math.max(1, Math.min(10000, Math.floor(n))));
                }}
                onBlur={(e) => {
                  if (e.target.value === "") {
                    setRowsPerPage(DEFAULT_BOOKING_ARCHIVE_FILTERS.rowsPerPage);
                  }
                }}
                className="customInput w-full"
                placeholder="Type any number"
              />
              <div className="flex flex-wrap gap-2">
                {[10, 25, 50, 100, 250, 500].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRowsPerPage(n)}
                    className="customButtonDefault mx-auto h-8 px-2! text-xs"
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
              className="customButtonDefault h-10"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="customButtonEnabled h-10"
            >
              Apply filters
            </button>
          </div>
        </div>
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
      <span className="mb-1 block text-xs font-medium text-neutral-600">
        {label}
      </span>
      {children}
    </label>
  );
}

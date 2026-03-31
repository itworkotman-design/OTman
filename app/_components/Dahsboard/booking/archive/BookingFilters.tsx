"use client";

import { Combobox } from "@headlessui/react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { BookingArchiveFilters, BookingArchiveOption } from "./types";
import {
  DEFAULT_BOOKING_ARCHIVE_FILTERS,
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

  const [customerQuery, setCustomerQuery] = useState("");
  const [subQuery, setSubQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    return creators.filter((item) =>
      item.label.toLowerCase().includes(customerQuery.toLowerCase()),
    );
  }, [creators, customerQuery]);

  const filteredSubs = useMemo(() => {
    return subcontractors.filter((item) =>
      item.label.toLowerCase().includes(subQuery.toLowerCase()),
    );
  }, [subcontractors, subQuery]);

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
    setCustomerQuery("");
    setSubQuery("");

    onReset();
  };

  const setToday = () => {
    const range = getTodayRange();
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  };

  const setTomorrow = () => {
    const range = getTomorrowRange();
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  };

  const setThisWeek = () => {
    const range = getThisWeekRange();
    setFromDate(range.fromDate);
    setToDate(range.toDate);
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
              <option value="">Alle statuser</option>
              <option value="behandles">Behandles</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="fail">Fail</option>
              <option value="completed">Completed</option>
              <option value="invoiced">Invoiced</option>
              <option value="betalt">Paid</option>
            </select>
          </Field>

          {access.canFilterCustomer && (
            <ComboField
              label="Kunde"
              value={customerMembershipId}
              onChange={(val) => setCustomerMembershipId(val ?? "")}
              query={customerQuery}
              setQuery={setCustomerQuery}
              items={filteredCustomers}
              placeholder="Alle kunder"
            />
          )}

          {access.canFilterSubcontractor && (
            <ComboField
              label="Subcontractor"
              value={subcontractorId}
              onChange={(val) => setSubcontractorId(val ?? "")}
              query={subQuery}
              setQuery={setSubQuery}
              items={filteredSubs}
              placeholder="All subcontractors"
            />
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2">
            <Field label="Fra dato" className="min-w-0">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="customInput block min-w-0 text-sm lg:w-full"
              />
            </Field>

            <Field label="Til dato" className="min-w-0">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="customInput block min-w-0 text-sm lg:w-full"
              />
            </Field>
          </div>

          <div className="flex items-end gap-2 justify-evenly">
            <button
              type="button"
              onClick={setToday}
              className="customButtonDefault h-10"
            >
              I dag
            </button>
            <button
              type="button"
              onClick={setTomorrow}
              className="customButtonDefault h-10"
            >
              I morgen
            </button>
            <button
              type="button"
              onClick={setThisWeek}
              className="customButtonDefault h-10"
            >
              Denne uken
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Søk">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk ID, navn, telefon, ordrenr..."
              className="customInput w-full"
            />
          </Field>

          <Field label="Antall bestillinger per side">
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
              Nullstill
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="customButtonEnabled h-10"
            >
              Filter
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Helpers ---------- */

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

function ComboField({
  label,
  value,
  onChange,
  query,
  setQuery,
  items,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string | null) => void;
  query: string;
  setQuery: (value: string) => void;
  items: BookingArchiveOption[];
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <Combobox<string> value={value ?? ""} onChange={onChange}>
        <div className="relative">
          <Combobox.Input
            className="customInput w-full"
            onChange={(e) => setQuery(e.target.value)}
            displayValue={(selectedId: string) =>
              items.find((item) => item.id === selectedId)?.label ?? ""
            }
            placeholder={placeholder}
          />

          <Combobox.Options className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white text-sm shadow-sm">
            {items.map((item) => (
              <Combobox.Option
                key={item.id}
                value={item.id}
                className="cursor-pointer px-3 py-2 hover:bg-neutral-100"
              >
                {item.label}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        </div>
      </Combobox>
    </Field>
  );
}

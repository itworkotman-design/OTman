"use client";

import { Combobox } from "@headlessui/react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

/* DATA FOR CLIENTS AND CONTRACTORS */
const CLIENTS = ["Power Rud", "Power Ski", "Power Skullerud"];
const SUBCONTRACTORS = ["Sub A", "Sub B", "Sub C"];

type TopFiltersFieldProps = {
  initialApplied: AppliedFilters;
  onApply: (filters: AppliedFilters) => void;
  onReset: () => void;
  userView?: "admin" | "subcontractor";
  lockedSubcontractor?: string;
};

export type AppliedFilters = {
  status: string;
  customer: string;
  subcontractor: string;
  fromDate: string;
  toDate: string;
  search: string;
  rowsPerPage: number;
  page: number;
};

const DEFAULT_FILTERS: AppliedFilters = {
  status: "",
  customer: "",
  subcontractor: "",
  fromDate: "",
  toDate: "",
  search: "",
  rowsPerPage: 10,
  page: 1,
};

export default function TopFilters({
  initialApplied,
  onApply,
  onReset,
  userView = "admin",
  lockedSubcontractor,
}: TopFiltersFieldProps) {
  const [status, setStatus] = useState(initialApplied.status);
  const [customer, setCustomer] = useState(initialApplied.customer);
  const [subcontractor, setSubcontractor] = useState(initialApplied.subcontractor);
  const [fromDate, setFromDate] = useState(initialApplied.fromDate);
  const [toDate, setToDate] = useState(initialApplied.toDate);
  const [search, setSearch] = useState(initialApplied.search);
  const [rowsPerPage, setRowsPerPage] = useState<number>(initialApplied.rowsPerPage);

  const [clientQuery, setClientQuery] = useState("");
  const [subQuery, setSubQuery] = useState("");

  const filteredClients = useMemo(
    () => CLIENTS.filter((c) => c.toLowerCase().includes(clientQuery.toLowerCase())),
    [clientQuery]
  );

  const filteredSubs = useMemo(
    () => SUBCONTRACTORS.filter((s) => s.toLowerCase().includes(subQuery.toLowerCase())),
    [subQuery]
  );

  const handleApply = () => {
    onApply({
      status,
      customer,
      subcontractor: userView === "subcontractor" ? lockedSubcontractor ?? subcontractor : subcontractor,
      fromDate,
      toDate,
      search,
      rowsPerPage,
      page: 1,
    });
  };

  const handleReset = () => {
    setStatus(DEFAULT_FILTERS.status);
    setCustomer(DEFAULT_FILTERS.customer);
    setSubcontractor(userView === "subcontractor" ? lockedSubcontractor ?? "" : DEFAULT_FILTERS.subcontractor);
    setFromDate(DEFAULT_FILTERS.fromDate);
    setToDate(DEFAULT_FILTERS.toDate);
    setSearch(DEFAULT_FILTERS.search);
    setRowsPerPage(DEFAULT_FILTERS.rowsPerPage);
    setClientQuery("");
    setSubQuery("");

    onReset();
  };

  const setToday = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    setFromDate(iso);
    setToDate(iso);
  };

  const setTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    setFromDate(iso);
    setToDate(iso);
  };

  const setThisWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (x: Date) => {
      const yyyy = x.getFullYear();
      const mm = String(x.getMonth() + 1).padStart(2, "0");
      const dd = String(x.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    setFromDate(fmt(monday));
    setToDate(fmt(sunday));
  };

  return (
    <section className="w-full">
      <div className="customContainer w-full max-w-[1000]">
        <div
          className={`grid grid-cols-1 gap-3 ${
            userView === "subcontractor" ? "md:grid-cols-2" : "md:grid-cols-3"
          }`}
        >
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="customInput w-full"
            >
              <option value="">All statuses</option>
              <option value="processing">Processing</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Fail</option>
              <option value="completed">Completed</option>
              <option value="invoiced">Invoiced</option>
              <option value="paid">Paid</option>
            </select>
          </Field>

          <ComboField
            label="Customer"
            value={customer}
            onChange={(val) => setCustomer(val ?? "")}
            query={clientQuery}
            setQuery={setClientQuery}
            items={filteredClients}
            placeholder="Select client"
          />

          {userView !== "subcontractor" && (
            <ComboField
              label="Subcontractor"
              value={subcontractor}
              onChange={(val) => setSubcontractor(val || "")}
              query={subQuery}
              setQuery={setSubQuery}
              items={filteredSubs}
              placeholder="Select subcontractor"
            />
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:col-span-2 min-w-0">
            <Field label="From date" className="min-w-0">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="customInput block lg:w-full w-[calc(100%-26px)] min-w-0 text-sm"
              />
            </Field>

            <Field label="To date" className="min-w-0">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="customInput block lg:w-full w-[calc(100%-26px)] min-w-0 text-sm"
              />
            </Field>
          </div>

          <div className="flex items-end gap-2 justify-evenly">
            <button
              type="button"
              onClick={setToday}
              className="customButtonDefault h-[40]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={setTomorrow}
              className="customButtonDefault h-[40]"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={setThisWeek}
              className="customButtonDefault h-[40]"
            >
              This week
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, name, phone, order no…"
              className="customInput w-full"
            />
          </Field>

          <Field label="Rows per page">
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
                  if (e.target.value === "") setRowsPerPage(25);
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
                    className={`customButtonDefault h-8 px-2! text-xs mx-auto ${
                      rowsPerPage === n ? "customButtonDefault px-2!" : ""
                    }`}
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
      <span className="block mb-1 text-xs font-medium text-neutral-600">{label}</span>
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
  items: string[];
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <Combobox<string> value={value ?? ""} onChange={onChange}>
        <div className="relative">
          <Combobox.Input
            className="customInput w-full"
            onChange={(e) => setQuery(e.target.value)}
            displayValue={(v: string) => v}
            placeholder={placeholder}
          />

          <Combobox.Options className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white text-sm shadow-sm">
            {items.map((item) => (
              <Combobox.Option
                key={item}
                value={item}
                className="cursor-pointer px-3 py-2 hover:bg-neutral-100"
              >
                {item}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        </div>
      </Combobox>
    </Field>
  );
}
"use client";

import { Combobox } from "@headlessui/react";
import { useMemo, useState } from "react";

/* DATA FOR CLIENTS AND CONTRACTORS GOES HERE */
const CLIENTS = ["Power Rud", "Power Ski", "Power Skullerud"];
const SUBCONTRACTORS = ["Sub A", "Sub B", "Sub C"];

export default function TopFilters() {
  const [status, setStatus] = useState("");
  const [client, setClient] = useState("");
  const [clientQuery, setClientQuery] = useState("");

  const [subcontractor, setSubcontractor] = useState("");
  const [subQuery, setSubQuery] = useState("");

  // NEW: editable rows per page
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);

  const filteredClients = useMemo(
    () => CLIENTS.filter((c) => c.toLowerCase().includes(clientQuery.toLowerCase())),
    [clientQuery]
  );

  const filteredSubs = useMemo(
    () => SUBCONTRACTORS.filter((s) => s.toLowerCase().includes(subQuery.toLowerCase())),
    [subQuery]
  );

  return (
    <section className="rounded-xl border bg-white p-4 max-w-250">
      {/*Status field*/}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-full rounded-md border px-3 text-sm">
            <option value="">All statuses</option>
            <option value="inProgress">In progress</option>
            <option value="confirmed">Confirmed</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="fail">Fail</option>
            <option value="completed">Completed</option>
            <option value="invoiced">Invoiced</option>
            <option value="betalt">Paid</option>
          </select>
        </Field>

        {/*Client field*/}
        <ComboField
          label="Client"
          value={client}
          onChange={(val) => setClient(val || "")}
          query={clientQuery}
          setQuery={setClientQuery}
          items={filteredClients}
          placeholder="Select client"
        />

        {/*Subcontractor field*/}
        <ComboField
          label="Subcontractor"
          value={subcontractor}
          onChange={(val) => setSubcontractor(val || "")}
          query={subQuery}
          setQuery={setSubQuery}
          items={filteredSubs}
          placeholder="Select subcontractor"
        />
      </div>

      {/*Dates field*/}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <Field label="From date">
            <input type="date" className="h-10 w-full rounded-md border px-3 text-sm" />
          </Field>

          <Field label="To date">
            <input type="date" className="h-10 w-full rounded-md border px-3 text-sm" />
          </Field>
        </div>

        <div className="flex items-end gap-2">
          <QuickButton>Today</QuickButton>
          <QuickButton>Tomorrow</QuickButton>
          <QuickButton>This week</QuickButton>
        </div>
      </div>

      {/*Search by ID input field */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Search">
          <input
            placeholder="Search ID, name, phone, order no…"
            className="h-10 w-full rounded-md border px-3 text-sm"
          />
        </Field>

      {/*Number per page input field */}
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
              className="h-10 w-full rounded-md border px-3 text-sm"
              placeholder="Type any number"
            />
            <div className="flex flex-wrap gap-2">
              {[10, 25, 50, 100, 250, 500].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRowsPerPage(n)}
                  className={`h-8 rounded-md border px-3 text-xs mx-auto ${
                    rowsPerPage === n
                      ? "bg-logoblue text-white font-bold"
                      : "hover:bg-neutral-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <div className="flex items-end justify-end gap-2">
          <button className="h-10 rounded-md border px-4 text-sm">Reset</button>
          <button className="h-10 rounded-md bg-logoblue px-4 text-sm font-semibold text-white">
            Apply filters
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- Helpers ---------- */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-neutral-600">{label}</div>
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
      <Combobox<string> value={value} onChange={onChange}>
        <div className="relative">
          <Combobox.Input
            className="h-10 w-full rounded-md border px-3 text-sm"
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

function QuickButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="h-10 rounded-md border px-3 text-sm hover:bg-neutral-50">
      {children}
    </button>
  );
}

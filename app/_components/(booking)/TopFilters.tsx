"use client";

import { Combobox } from "@headlessui/react";
import { useState } from "react";

/* demo data – replace later */
const CLIENTS = ["Power Rud", "Power Ski", "Power Skullerud"];
const SUBCONTRACTORS = ["Sub A", "Sub B", "Sub C"];

export default function TopFilters() {
  const [status, setStatus] = useState("");
  const [client, setClient] = useState("");
  const [clientQuery, setClientQuery] = useState("");

  const [subcontractor, setSubcontractor] = useState("");
  const [subQuery, setSubQuery] = useState("");

  const filteredClients = CLIENTS.filter((c) =>
    c.toLowerCase().includes(clientQuery.toLowerCase())
  );

  const filteredSubs = SUBCONTRACTORS.filter((s) =>
    s.toLowerCase().includes(subQuery.toLowerCase())
  );

  return (
    <section className="rounded-xl border bg-white p-4">
      {/* Row 1 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 w-full rounded-md border px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>

        <ComboField
          label="Client"
          value={client}
          onChange={(val) => setClient(val || "")}
          query={clientQuery}
          setQuery={setClientQuery}
          items={filteredClients}
          placeholder="Select client"
        />

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

      {/* Row 2 */}
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

      {/* Row 3 */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Search">
          <input
            placeholder="Search ID, name, phone, order no…"
            className="h-10 w-full rounded-md border px-3 text-sm"
          />
        </Field>

        <Field label="Rows per page">
          <select className="h-10 w-full rounded-md border px-3 text-sm">
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
        </Field>

        <div className="flex items-end justify-end gap-2">
          <button className="h-10 rounded-md border px-4 text-sm">
            Reset
          </button>
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

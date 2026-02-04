"use client";

import { useMemo, useState } from "react";

type BookingFieldEditor = {
  // what you currently have selected in the table
  selectedCount: number;

  // options
  statusOptions: { value: string; label: string }[];
  subcontractorOptions: { value: string; label: string }[];

  // actions (call your API / state updates from parent)
  onUpdateStatus: (status: string) => void | Promise<void>;
  onUpdateSubcontractor: (subcontractorId: string) => void | Promise<void>;
  onUpdateDriverText: (text: string) => void | Promise<void>;
};

export function BookingFieldEditor({
  selectedCount,
  statusOptions,
  subcontractorOptions,
  onUpdateStatus,
  onUpdateSubcontractor,
  onUpdateDriverText,
}: BookingFieldEditor) {
  const disabled = selectedCount <= 0;

  const [status, setStatus] = useState("");
  const [subcontractor, setSubcontractor] = useState("");
  const [driverText, setDriverText] = useState("");

  const canUpdateStatus = !disabled && status !== "";
  const canUpdateSub = !disabled && subcontractor !== "";
  const canUpdateDriver = !disabled && driverText.trim().length > 0;

  const helperText = useMemo(() => {
    if (selectedCount > 0) return `Editing ${selectedCount} selected booking(s).`;
    return "Select at least 1 booking to edit.";
  }, [selectedCount]);

  return (
    <section className="mt-4 rounded-xl border bg-white p-4 max-w-250">
      <div className="mb-3 text-xs text-neutral-600">{helperText}</div>

      <div className="grid grid-cols-1 gap-3">
        {/* Row 1: Status */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px] items-center">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={disabled}
            className="h-10 w-full rounded-md border px-3 text-sm disabled:bg-neutral-100"
          >
            <option value="">Change status for selected:</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!canUpdateStatus}
            onClick={() => onUpdateStatus(status)}
            className="h-10 w-full rounded-md bg-logoblue px-4 text-sm font-semibold text-white disabled:bg-logoblue/60"
          >
            Update status
          </button>
        </div>

        {/* Row 2: Subcontractor */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px] items-center">
          <select
            value={subcontractor}
            onChange={(e) => setSubcontractor(e.target.value)}
            disabled={disabled}
            className="h-10 w-full rounded-md border px-3 text-sm disabled:bg-neutral-100"
          >
            <option value="">Change subcontractor for selected:</option>
            {subcontractorOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!canUpdateSub}
            onClick={() => onUpdateSubcontractor(subcontractor)}
            className="h-10 w-full rounded-md bg-logoblue px-4 text-sm font-semibold text-white disabled:bg-logoblue/60"
          >
            Update subcontractor
          </button>
        </div>

        {/* Row 3: Free text driver */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px] items-center">
          <input
            value={driverText}
            onChange={(e) => setDriverText(e.target.value)}
            disabled={disabled}
            placeholder="Write driver name…"
            className="h-10 w-full rounded-md border px-3 text-sm disabled:bg-neutral-100"
          />

          <button
            type="button"
            disabled={!canUpdateDriver}
            onClick={() => onUpdateDriverText(driverText.trim())}
            className="h-10 w-full rounded-md bg-logoblue px-4 text-sm font-semibold text-white disabled:bg-logoblue/60"
          >
            Update driver (free text)
          </button>
        </div>
      </div>
    </section>
  );
}

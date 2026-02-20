"use client";

import { useMemo, useState } from "react";

type BookingFieldEditorProps = {
  selectedCount: number;

  statusOptions: readonly { value: string; label: string }[];
  subcontractorOptions: readonly { value: string; label: string }[];

  onUpdateStatus: (status: string) => void | Promise<void>;
  onUpdateSubcontractor: (subcontractorId: string) => void | Promise<void>;
  onUpdateDriverText: (text: string) => void | Promise<void>;
};

type ActionKind = "status" | "subcontractor" | "driver" | null;

export function BookingFieldEditor({
  selectedCount,
  statusOptions,
  subcontractorOptions,
  onUpdateStatus,
  onUpdateSubcontractor,
  onUpdateDriverText,
}: BookingFieldEditorProps) {
  const disabled = selectedCount <= 0;

  // draft inputs
  const [status, setStatus] = useState("");
  const [subcontractor, setSubcontractor] = useState("");
  const [driverText, setDriverText] = useState("");

  // UX state: submitting + feedback
  const [busy, setBusy] = useState<ActionKind>(null);
  const [, setError] = useState<string>("");
  const [, setSuccess] = useState<string>("");

  const canUpdateStatus = !disabled && status !== "" && busy === null;
  const canUpdateSub = !disabled && subcontractor !== "" && busy === null;
  const canUpdateDriver = !disabled && driverText.trim().length > 0 && busy === null;

  const helperText = useMemo(() => {
    if (disabled) return "Select at least 1 booking to edit.";
    return `Editing ${selectedCount} selected booking(s).`;
  }, [disabled, selectedCount]);

  // Shared runner: handles async + feedback + disables other actions while running
  const run = async (kind: Exclude<ActionKind, null>, fn: () => void | Promise<void>) => {
    setError("");
    setSuccess("");
    setBusy(kind);
    try {
      await fn();
      setSuccess("Saved.");
      // clear only the field that was applied (keeps other drafts intact)
      if (kind === "status") setStatus("");
      if (kind === "subcontractor") setSubcontractor("");
      if (kind === "driver") setDriverText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-4 rounded-xl border bg-white p-4 max-w-250">
      <div className={`mb-2 text-xs ${disabled ? "text-neutral-600/50" : "text-neutral-600"}`}>
        {helperText}
      </div>


      <div className="grid grid-cols-1 gap-3">
        {/* Row 1: Status */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px] items-center">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={disabled || busy !== null}
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
            onClick={() => run("status", () => onUpdateStatus(status))}
            className="h-10 w-full rounded-md bg-logoblue px-4 text-sm font-semibold text-white disabled:bg-logoblue/60"
          >
            {busy === "status" ? "Updating…" : "Update status"}
          </button>
        </div>

        {/* Row 2: Subcontractor */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px] items-center">
          <select
            value={subcontractor}
            onChange={(e) => setSubcontractor(e.target.value)}
            disabled={disabled || busy !== null}
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
            onClick={() => run("subcontractor", () => onUpdateSubcontractor(subcontractor))}
            className="h-10 w-full rounded-md bg-logoblue px-4 text-sm font-semibold text-white disabled:bg-logoblue/60"
          >
            {busy === "subcontractor" ? "Updating…" : "Update subcontractor"}
          </button>
        </div>

        {/* Row 3: Free text driver */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px] items-center">
          <input
            value={driverText}
            onChange={(e) => setDriverText(e.target.value)}
            disabled={disabled || busy !== null}
            placeholder="Write driver name…"
            className="h-10 w-full rounded-md border px-3 text-sm disabled:bg-neutral-100"
          />

          <button
            type="button"
            disabled={!canUpdateDriver}
            onClick={() => run("driver", () => onUpdateDriverText(driverText.trim()))}
            className="h-10 w-full rounded-md bg-logoblue px-4 text-sm font-semibold text-white disabled:bg-logoblue/60"
          >
            {busy === "driver" ? "Updating…" : "Update driver"}
          </button>
        </div>
      </div>
    </section>
  );
}
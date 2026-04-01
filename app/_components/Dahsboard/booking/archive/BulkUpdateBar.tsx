"use client";

import { useEffect, useState } from "react";
import type { BookingArchiveOption } from "./types";

type Props = {
  selectedCount: number;
  subcontractors: BookingArchiveOption[];
  onApply: (payload: {
    status?: string;
    subcontractorId?: string;
  }) => void | Promise<boolean>;
  onClear: () => void;
  loading?: boolean;
  error?: string;
};

export default function BulkUpdateBar({
  selectedCount,
  subcontractors,
  onApply,
  onClear,
  loading = false,
  error = "",
}: Props) {
  const [status, setStatus] = useState("");
  const [subcontractorId, setSubcontractorId] = useState("");
  const [successFlash, setSuccessFlash] = useState(false);

  const disabled = selectedCount === 0 || loading;
  const canApply = !!status || !!subcontractorId;

  useEffect(() => {
    if (!successFlash) return;

    const t = window.setTimeout(() => {
      setSuccessFlash(false);
    }, 1000);

    return () => window.clearTimeout(t);
  }, [successFlash]);

  async function handleApplyClick() {
    if (disabled || !canApply) return;
    if (!confirm(`Update ${selectedCount} orders?`)) return;

    const ok = await onApply({
      status: status || undefined,
      subcontractorId: subcontractorId || undefined,
    });

    if (!ok) return;

    setSuccessFlash(true);
    setStatus("");
    setSubcontractorId("");
  }

  return (
    <section className="customContainer mt-3">
      <div className="grid items-end gap-3 md:grid-cols-[auto_1fr_1fr_auto_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-textColorThird">
            Selected
          </label>
          <div className="customInput flex h-10 w-[60px] items-center justify-center text-center">{selectedCount}</div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-textColorThird">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="customInput w-full"
            disabled={loading}
          >
            <option value="">No status change</option>
            <option value="behandles">Behandles</option>
            <option value="confirmed">Confirmed</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="fail">Fail</option>
            <option value="completed">Completed</option>
            <option value="invoiced">Invoiced</option>
            <option value="betalt">Paid</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-textColorThird">
            Subcontractor
          </label>
          <select
            value={subcontractorId}
            onChange={(e) => setSubcontractorId(e.target.value)}
            className="customInput w-full"
            disabled={loading}
          >
            <option value="">No subcontractor change</option>
            {subcontractors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={disabled || !canApply}
          onClick={handleApplyClick}
          className={`h-10 disabled:opacity-50! disabled:cursor-auto! ${
            successFlash
              ? "customButtonEnabled bg-green-600!"
              : "customButtonEnabled"
          }`}
        >
          {loading
            ? "Applying..."
            : successFlash
              ? "Updated"
              : "Apply bulk update"}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          className="customButtonDefault h-10 disabled:opacity-50! disabled:cursor-auto!"
        >
          Clear selection
        </button>
      </div>

      {error ? (
        <div className="mt-3 text-sm font-medium text-red-600">{error}</div>
      ) : null}
    </section>
  );
}

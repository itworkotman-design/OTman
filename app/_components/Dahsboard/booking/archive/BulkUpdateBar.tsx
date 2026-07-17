"use client";

import { useEffect, useState } from "react";
import { bookingText, bookingStatusText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
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
  locale?: BookingUiLocale;
};

const STATUS_OPTIONS = [
  "processing",
  "confirmed",
  "active",
  "cancelled",
  "failed",
  "completed",
  "invoiced",
  "paid",
] as const;

export default function BulkUpdateBar({
  selectedCount,
  subcontractors,
  onApply,
  onClear,
  loading = false,
  error = "",
  locale = "en",
}: Props) {
  const t = (text: string) => bookingText(locale, text);
  const [status, setStatus] = useState("");
  const [subcontractorId, setSubcontractorId] = useState("");
  const [successFlash, setSuccessFlash] = useState(false);

  const disabled = selectedCount === 0 || loading;
  const canApply = !!status || !!subcontractorId;

  useEffect(() => {
    if (!successFlash) return;

    const timer = window.setTimeout(() => {
      setSuccessFlash(false);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [successFlash]);

  async function handleApplyClick() {
    if (disabled || !canApply) return;
    const confirmMsg =
      locale === "nb"
        ? `Oppdater ${selectedCount} bestillinger?`
        : `Update ${selectedCount} orders?`;
    if (!confirm(confirmMsg)) return;

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
    <section className="customContainer mt-4 margin-weird-landscape padding-weird-landscape [@media_(orientation:landscape)_and_(max-height:800px)_and_(min-width:900px)]:max-w-[700] [@media_(orientation:landscape)_and_(max-height:800px)_and_(min-width:900px)]:shadow-none!">
      <div className="grid items-end gap-3 md:grid-cols-[auto_1fr_1fr_auto_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-textColorThird text-weird-landscape">{t("Selected")}</label>
          <div className="customInput flex h-10 w-[60] items-center justify-center text-center text-weird-landscape height-weird-landscape">
            {selectedCount}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-textColorThird text-weird-landscape">{t("Status")}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="customInput w-full text-weird-landscape padding-weird-landscape height-weird-landscape"
            disabled={loading}
          >
            <option value="">{t("No status change")}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {bookingStatusText(locale, s)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-textColorThird text-weird-landscape">{t("Partner")}</label>
          <select
            value={subcontractorId}
            onChange={(e) => setSubcontractorId(e.target.value)}
            className="customInput w-full text-weird-landscape padding-weird-landscape height-weird-landscape"
            disabled={loading}
          >
            <option value="">{t("No partner change")}</option>
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
          className={`h-10 disabled:opacity-50! disabled:cursor-auto! text-weird-landscape padding-weird-landscape height-weird-landscape ${successFlash ? "customButtonEnabled bg-green-600!" : "customButtonEnabled"}`}
        >
          {loading ? t("Applying...") : successFlash ? t("Updated") : t("Apply bulk update")}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          className="customButtonDefault h-10 disabled:opacity-50! disabled:cursor-auto! text-weird-landscape padding-weird-landscape height-weird-landscape"
        >
          {t("Clear selection")}
        </button>
      </div>

      {error ? <div className="mt-3 text-sm font-medium text-red-600">{error}</div> : null}
    </section>
  );
}

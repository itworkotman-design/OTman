"use client";

import { useState } from "react";
import PeriodPicker, { type PeriodValue } from "@/app/_components/utils/PeriodPicker";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";

// Downloads the web-sales report (receipts and credit notes in the W-series,
// with Stripe payouts) for the accountant, as Excel or PDF —
// /api/orders/web-sales-report, lib/invoices/webSalesReport.ts. A Dashboard
// Home card. Picks a month (default: last month, the one usually being
// closed) or a single day.

type Format = "xlsx" | "pdf";

// Last month in Oslo, "YYYY-MM".
function previousMonth(now = new Date()): string {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit" })
    .format(now)
    .split("-")
    .map(Number) as [number, number];
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

const TEXT = {
  nb: {
    title: "Rapport for regnskap",
    hint: "Kvitteringer og kreditnotaer (W-serien) med Stripe-utbetalinger, for en måned eller en dag.",
    xlsx: "Last ned Excel",
    pdf: "Last ned PDF",
    loading: "Lager rapport…",
    failed: "Kunne ikke lage rapporten.",
  },
  en: {
    title: "Report for accounting",
    hint: "Receipts and credit notes (W-series) with Stripe payouts, for a month or a single day.",
    xlsx: "Download Excel",
    pdf: "Download PDF",
    loading: "Making report…",
    failed: "Could not make the report.",
  },
} as const;

export default function WebSalesReportSection({ locale }: { locale: BookingUiLocale }) {
  const text = locale === "nb" ? TEXT.nb : TEXT.en;
  const [period, setPeriod] = useState<PeriodValue>(() => ({ kind: "month", month: previousMonth() }));
  const [loading, setLoading] = useState<Format | null>(null);
  const [error, setError] = useState("");

  async function download(format: Format) {
    setLoading(format);
    setError("");
    const label = period.kind === "month" ? period.month : period.date;
    const query = new URLSearchParams(period.kind === "month" ? { month: period.month } : { date: period.date });
    if (format === "pdf") query.set("format", "pdf");
    try {
      const res = await fetch(`/api/orders/web-sales-report?${query.toString()}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setError(text.failed);
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `Nettsalg W-serie ${label}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(text.failed);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-logoblue">{text.title}</h2>
      </div>
      <div className="p-6">
        <p className="text-sm text-textColorThird">{text.hint}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="w-60">
            <PeriodPicker value={period} onChange={setPeriod} locale={locale} />
          </div>
          {(["xlsx", "pdf"] as const).map((format) => (
            <button
              key={format}
              type="button"
              className="customButtonDefault"
              onClick={() => void download(format)}
              disabled={loading !== null}
            >
              {loading === format ? text.loading : text[format]}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}

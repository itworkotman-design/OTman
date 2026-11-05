"use client";

import { useState } from "react";

// Downloads the monthly web-sales report (receipts and credit notes in the
// W-series, with Stripe payouts) as Excel for the accountant —
// /api/orders/web-sales-report, lib/invoices/webSalesReport.ts. Defaults to
// last month, the one usually being closed.

function previousMonth(now = new Date()): string {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit" })
    .format(now)
    .split("-")
    .map(Number) as [number, number];
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

const TEXT = {
  nb: {
    title: "Månedsrapport for regnskap",
    hint: "Kvitteringer og kreditnotaer (W-serien) med Stripe-utbetalinger, som Excel.",
    download: "Last ned",
    loading: "Lager rapport…",
    failed: "Kunne ikke lage rapporten.",
  },
  en: {
    title: "Monthly report for accounting",
    hint: "Receipts and credit notes (W-series) with Stripe payouts, as Excel.",
    download: "Download",
    loading: "Making report…",
    failed: "Could not make the report.",
  },
} as const;

export default function WebSalesReportDownload({ locale }: { locale: string }) {
  const text = locale === "nb" ? TEXT.nb : TEXT.en;
  const [month, setMonth] = useState(previousMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/web-sales-report?month=${encodeURIComponent(month)}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setError(text.failed);
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `Nettsalg W-serie ${month}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(text.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-sm font-semibold text-logoblue">{text.title}</div>
      <p className="mt-0.5 text-xs text-textColorThird">{text.hint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="rounded-lg border border-black/15 px-2 py-1 text-sm"
        />
        <button type="button" className="customButtonDefault" onClick={() => void download()} disabled={loading || !month}>
          {loading ? text.loading : text.download}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

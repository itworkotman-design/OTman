"use client";

import { useEffect, useState } from "react";
import { formatKr } from "@/lib/orders/orderChangeText";
import type { OrderInvoiceOverview, OrderInvoiceView } from "@/lib/invoices/orderInvoices";
import { getPaymentStatusPresentation } from "@/lib/orders/statusPresentation";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const pdfUrl = (orderId: string, invoice: OrderInvoiceView, download = false) =>
  `/api/orders/${orderId}/invoices/${invoice.id}/pdf${download ? "?download=1" : ""}`;

async function loadOverview(orderId: string): Promise<{ overview: OrderInvoiceOverview } | { error: string }> {
  try {
    const res = await fetch(`/api/orders/${orderId}/invoices`, { credentials: "include" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return { error: res.status === 403 ? "Only admins can see the payments." : "Could not load the payments." };
    return { overview: { invoices: data.invoices, ledger: data.ledger, paymentStatus: data.paymentStatus } };
  } catch {
    return { error: "Could not load the payments." };
  }
}

// The Alert Center's Payment tab for a homepage order (manual fakturas,
// lib/invoices/): every faktura and kreditnota, newest first, with who sent
// it, when it was paid and by whom — each one viewable exactly as the
// customer got it (the stored PDF, BETALT stamps as they were then).
export default function OrderPaymentPanel({ orderId }: { orderId: string }) {
  const [overview, setOverview] = useState<OrderInvoiceOverview | null>(null);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<OrderInvoiceView | null>(null);
  // Bumped by "Try again".
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadOverview(orderId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
      } else {
        setError("");
        setOverview(result.overview);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, attempt]);

  if (error) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-red-700">
        {error}{" "}
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold underline">
          Try again
        </button>
      </div>
    );
  }
  if (!overview) return <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-textColorThird">Loading…</div>;

  const badge = getPaymentStatusPresentation(overview.paymentStatus, "en");
  const { ledger } = overview;
  const newestFirst = [...overview.invoices].reverse();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-base font-semibold text-logoblue">Payment</div>
          {badge ? (
            <span className="rounded px-2 py-0.5 text-xs font-semibold" style={badge.style}>
              {badge.label}
            </span>
          ) : (
            <span className="text-xs text-textColorThird">No faktura sent yet</span>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-textColorThird">Invoiced</dt>
            <dd className="font-semibold tabular-nums">{formatKr(ledger.invoicedIncVatNok)}</dd>
          </div>
          <div>
            <dt className="text-textColorThird">Paid</dt>
            <dd className="font-semibold tabular-nums">{formatKr(ledger.paidIncVatNok)}</dd>
          </div>
          <div>
            <dt className="text-textColorThird">Order total now</dt>
            <dd className="font-semibold tabular-nums">{formatKr(ledger.currentIncVatNok)}</dd>
          </div>
          <div>
            <dt className="text-textColorThird">Difference</dt>
            <dd className={`font-semibold tabular-nums ${ledger.differenceIncVatNok > 0 ? "text-amber-800" : ledger.differenceIncVatNok < 0 ? "text-red-700" : ""}`}>
              {formatKr(ledger.differenceIncVatNok, { signed: true })}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-textColorThird">Amounts incl. VAT. Send fakturas and mark them paid from the order&apos;s Payment card.</p>
      </div>

      {newestFirst.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-textColorThird">No fakturas yet.</div>
      ) : (
        <div className="space-y-3">
          {newestFirst.map((invoice) => (
            <div key={invoice.id} className="rounded-2xl border border-black/10 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-logoblue">
                      {invoice.kind === "refund" ? "Kreditnota" : "Faktura"} {invoice.number}
                    </span>
                    {invoice.kind === "invoice" ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${invoice.paidAt ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}
                      >
                        {invoice.paidAt ? "Paid" : "Pending"}
                      </span>
                    ) : (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800">Owed back</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-textColorThird">
                    {invoice.kind === "refund" ? "Recorded" : "Sent"} {formatDateTime(invoice.createdAt)} by {invoice.sentBy ?? "the website (automatic)"}
                    {invoice.kind === "invoice" ? ` · due ${formatDate(invoice.dueDate)}` : ""}
                  </div>
                  {invoice.kind === "invoice" && invoice.paidAt ? (
                    <div className="text-xs text-green-800">
                      Marked paid {formatDateTime(invoice.paidAt)}
                      {invoice.paidBy ? ` by ${invoice.paidBy}` : ""}
                    </div>
                  ) : null}
                  <div className="mt-1 text-xs text-textColorThird">Order total after this: {formatKr(invoice.totalAfterIncVatNok)}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-base font-semibold tabular-nums">
                    {formatKr(invoice.kind === "refund" ? -invoice.amountIncVatNok : invoice.amountIncVatNok)}
                  </span>
                  {invoice.hasPdf ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setViewing((current) => (current?.id === invoice.id ? null : invoice))}
                        className="rounded-full border border-logoblue px-3 py-1 text-xs font-semibold text-logoblue transition hover:bg-logoblue hover:text-white"
                      >
                        {viewing?.id === invoice.id ? "Hide" : "View"}
                      </button>
                      <a
                        href={pdfUrl(orderId, invoice, true)}
                        className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold text-black/70 transition hover:bg-black/5"
                      >
                        Download
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs text-textColorThird">No stored file</span>
                  )}
                </div>
              </div>
              {viewing?.id === invoice.id ? (
                <iframe
                  title={`${invoice.kind === "refund" ? "Kreditnota" : "Faktura"} ${invoice.number}`}
                  src={pdfUrl(orderId, invoice)}
                  className="mt-3 h-[70vh] w-full rounded-xl border border-black/10"
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

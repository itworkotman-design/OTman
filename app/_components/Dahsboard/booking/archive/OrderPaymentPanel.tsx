"use client";

import { useEffect, useState } from "react";
import { formatKr } from "@/lib/orders/orderChangeText";
import type { OrderInvoiceOverview, OrderInvoiceView } from "@/lib/invoices/orderInvoices";
import { getPaymentStatusPresentation } from "@/lib/orders/statusPresentation";
import type { StripePaymentOverview } from "@/lib/orders/stripePaymentOverview";

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

// The Alert Center's Payment tab for a homepage order: the Stripe payments
// when the customer pays with Stripe (HOMEPAGE_PAYMENT_MODE=stripe), the
// fakturas when payments are manual.
export default function OrderPaymentPanel({ orderId }: { orderId: string }) {
  const [state, setState] = useState<StripePaymentsState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadStripePayments(orderId).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, attempt]);

  if (!state) return <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-textColorThird">Loading…</div>;
  if ("error" in state) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-red-700">
        {state.error}{" "}
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold underline">
          Try again
        </button>
      </div>
    );
  }
  if (state.paymentMode === "manual") return <InvoicePaymentPanel orderId={orderId} />;
  return <StripePaymentPanel orderId={orderId} overview={state.overview} onChanged={() => setAttempt((n) => n + 1)} />;
}

type StripePaymentsState =
  | { paymentMode: "manual" }
  | { paymentMode: "stripe"; overview: StripePaymentOverview }
  | { error: string };

async function loadStripePayments(orderId: string): Promise<StripePaymentsState> {
  try {
    const res = await fetch(`/api/orders/${orderId}/payments`, { credentials: "include" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return { error: res.status === 403 ? "Only admins can see the payments." : "Could not load the payments." };
    if (data.paymentMode !== "stripe") return { paymentMode: "manual" };
    return { paymentMode: "stripe", overview: { payments: data.payments, comparison: data.comparison } };
  } catch {
    return { error: "Could not load the payments." };
  }
}

const STRIPE_OUTCOME_TEXT: Record<StripePaymentOverview["comparison"]["outcome"], string> = {
  unpaid: "Nothing paid yet.",
  settled: "The customer has paid for the order as it is now.",
  due: "The order now costs more than the customer has paid.",
  refund: "The customer has paid more than the order now costs.",
  closed: "The order is cancelled — nothing is due.",
};

// Every Stripe charge and refund, newest first, and paid so far vs. the order
// now (lib/orders/stripePaymentOverview.ts).
function StripePaymentPanel({
  orderId,
  overview,
  onChanged,
}: {
  orderId: string;
  overview: StripePaymentOverview;
  onChanged: () => void;
}) {
  const { comparison, payments } = overview;
  // What's paid now covers the order: paid; more than covers it: refund
  // pending; otherwise still due. A cancelled order has no badge.
  const badge = getPaymentStatusPresentation(
    comparison.outcome === "unpaid" || comparison.outcome === "due"
      ? "pending"
      : comparison.outcome === "refund"
        ? "refund_pending"
        : comparison.outcome === "settled"
          ? "paid"
          : null,
    "en",
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-base font-semibold text-logoblue">Payment (Stripe)</div>
          {badge ? (
            <span className="rounded px-2 py-0.5 text-xs font-semibold" style={badge.style}>
              {badge.label}
            </span>
          ) : null}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-textColorThird">Paid</dt>
            <dd className="font-semibold tabular-nums">{formatKr(comparison.totalPaidIncVatNok)}</dd>
          </div>
          <div>
            <dt className="text-textColorThird">Order total now</dt>
            <dd className="font-semibold tabular-nums">{formatKr(comparison.currentTotalIncVatNok)}</dd>
          </div>
          <div>
            <dt className="text-textColorThird">Difference</dt>
            <dd
              className={`font-semibold tabular-nums ${comparison.differenceIncVatNok > 0 ? "text-amber-800" : comparison.differenceIncVatNok < 0 ? "text-red-700" : ""}`}
            >
              {formatKr(comparison.differenceIncVatNok, { signed: true })}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-textColorThird">Amounts incl. VAT, refunds deducted. {STRIPE_OUTCOME_TEXT[comparison.outcome]}</p>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-textColorThird">No Stripe payments yet.</div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-black/10 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-logoblue">
                    {payment.kind === "booking" ? "Paid at booking" : "Additional payment"}
                  </div>
                  <div className="mt-0.5 text-xs text-textColorThird">
                    {formatDateTime(payment.createdAt)}
                    {payment.stripePaymentIntentId ? ` · ${payment.stripePaymentIntentId}` : ""}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{formatKr(payment.amountCents / 100)}</div>
              </div>
              <PaymentReceiptRow orderId={orderId} payment={payment} onSent={onChanged} />
              {payment.refunds.map((refund) => (
                <div key={refund.id} className="mt-2 flex flex-wrap items-start justify-between gap-3 border-t border-black/5 pt-2 text-sm">
                  <div>
                    <div className="font-medium text-red-700">Refunded</div>
                    <div className="text-xs text-textColorThird">
                      {formatDateTime(refund.createdAt)}
                      {refund.reason ? ` · ${refund.reason}` : ""}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums text-red-700">−{formatKr(refund.amountCents / 100)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The payment's receipt (lib/invoices/paymentReceipts.ts): open or download
// it, and email it to the customer (again).
function PaymentReceiptRow({
  orderId,
  payment,
  onSent,
}: {
  orderId: string;
  payment: StripePaymentOverview["payments"][number];
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const url = (download = false) => `/api/orders/${orderId}/payments/${payment.id}/receipt${download ? "?download=1" : ""}`;
  const { receipt } = payment;

  async function send() {
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(url(), { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setMessage({ ok: true, text: `Receipt ${data.number} emailed to the customer.` });
        onSent();
      } else {
        const reason = data?.reason;
        setMessage({
          ok: false,
          text:
            reason === "MISSING_CUSTOMER_EMAIL"
              ? "The order has no customer email."
              : reason === "SETTINGS_MISSING"
                ? "The seller name or org number is not set (INVOICE_SELLER_NAME / INVOICE_ORG_NUMBER)."
                : "Could not send the receipt.",
        });
      }
    } catch {
      setMessage({ ok: false, text: "Could not send the receipt." });
    } finally {
      setSending(false);
    }
  }

  const linkClass = "font-semibold text-logoblue underline-offset-2 hover:underline";
  return (
    <div className="mt-2 border-t border-black/5 pt-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {receipt ? (
          <>
            <span className="text-textColorThird">
              Receipt {receipt.number}
              {receipt.sentAt ? ` · emailed ${formatDateTime(receipt.sentAt)}` : " · not emailed"}
            </span>
            <a href={url()} target="_blank" rel="noreferrer" className={linkClass}>
              View
            </a>
            <a href={url(true)} className={linkClass}>
              Download
            </a>
          </>
        ) : (
          <span className="text-textColorThird">No receipt yet</span>
        )}
        <button type="button" onClick={send} disabled={sending} className={`${linkClass} disabled:opacity-50`}>
          {sending ? "Sending…" : receipt?.sentAt ? "Send again" : "Send receipt"}
        </button>
      </div>
      {message && <div className={`mt-1 ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</div>}
    </div>
  );
}

// Manual payments (lib/invoices/): every faktura and kreditnota, newest first,
// with who sent it, when it was paid and by whom — each one viewable exactly
// as the customer got it (the stored PDF, BETALT stamps as they were then).
function InvoicePaymentPanel({ orderId }: { orderId: string }) {
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

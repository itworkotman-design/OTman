"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import { formatKr } from "@/lib/orders/orderChangeText";
import { paymentCardState } from "@/lib/invoices/paymentCard";
import type { OrderInvoiceOverview } from "@/lib/invoices/orderInvoices";
import { getPaymentStatusPresentation } from "@/lib/orders/statusPresentation";

type Props = {
  orderId: string;
  locale: BookingUiLocale;
  // The calculator's unsaved total incl. VAT (null = no unsaved change).
  previewTotalIncVat: number | null;
  // Changes when the order was saved, so the card reloads.
  refreshKey: string;
  onChanged: () => void;
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });

// The Payment card of a homepage order while payments are manual (fakturas,
// lib/invoices/): a mini history of every faktura/kreditnota sent and whether
// it's paid, then how the order stands against them — following the
// calculator live — with the one thing to do: send a faktura for what was
// added, record a kreditnota for what's owed back, or mark the sent fakturas
// paid (the only way the order becomes paid). The full history is the
// Alert Center's Payment tab.
export default function WebsiteOrderInvoiceSummary({ orderId, locale, previewTotalIncVat, refreshKey, onChanged }: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const [overview, setOverview] = useState<OrderInvoiceOverview | null>(null);
  const [loadError, setLoadError] = useState<"" | "forbidden" | "failed">("");
  const [busy, setBusy] = useState<"" | "invoice" | "refund" | "paid">("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/invoices`, { credentials: "include" });
      if (res.status === 403) return setLoadError("forbidden");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return setLoadError("failed");
      setLoadError("");
      setOverview({ invoices: data.invoices, ledger: data.ledger, paymentStatus: data.paymentStatus });
    } catch {
      setLoadError("failed");
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const reasonText = (reason: string | undefined) => {
    switch (reason) {
      case "AMOUNT_CHANGED":
        return t("The order changed — check the amount and try again.", "Ordren er endret — sjekk beløpet og prøv igjen.");
      case "MISSING_CUSTOMER_EMAIL":
        return t("The customer has no email address.", "Kunden har ingen e-postadresse.");
      case "INVOICE_SETTINGS_MISSING":
        return t("Faktura details (bank account) aren't set up.", "Fakturaoppsett (kontonummer) mangler.");
      case "INVOICE_SEND_FAILED":
        return t("The faktura could not be sent. Nothing was recorded.", "Fakturaen kunne ikke sendes. Ingenting ble lagret.");
      default:
        return t("Something went wrong.", "Noe gikk galt.");
    }
  };

  async function act(kind: "invoice" | "refund" | "paid", amountCents?: number) {
    if (busy) return;
    const question =
      kind === "invoice"
        ? t(`Send a faktura for ${formatKr((amountCents ?? 0) / 100)} to the customer?`, `Sende faktura på ${formatKr((amountCents ?? 0) / 100)} til kunden?`)
        : kind === "refund"
          ? t(
              `Record a kreditnota of ${formatKr((amountCents ?? 0) / 100)} owed back, and email it to the customer?`,
              `Registrere kreditnota på ${formatKr((amountCents ?? 0) / 100)} til gode, og sende den til kunden?`,
            )
          : t("Mark every sent faktura as paid?", "Markere alle sendte fakturaer som betalt?");
    if (!window.confirm(question)) return;

    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(kind === "paid" ? `/api/orders/${orderId}/invoices/mark-paid` : `/api/orders/${orderId}/invoices`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: kind === "paid" ? undefined : JSON.stringify({ kind, amountCents }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setMessage({ tone: "error", text: reasonText(data?.reason) });
      } else {
        setMessage({
          tone: "ok",
          text:
            kind === "paid"
              ? t("Marked as paid.", "Markert som betalt.")
              : kind === "refund"
                ? t(`Kreditnota ${data.invoice.invoiceNumber} recorded.`, `Kreditnota ${data.invoice.invoiceNumber} registrert.`)
                : t(`Faktura ${data.invoice.invoiceNumber} sent.`, `Faktura ${data.invoice.invoiceNumber} sendt.`),
        });
        onChanged();
      }
      await load();
    } catch {
      setMessage({ tone: "error", text: reasonText(undefined) });
    } finally {
      setBusy("");
    }
  }

  if (loadError === "forbidden") {
    return <p className="text-sm text-black/50">{t("Only admins can see the payments.", "Kun administratorer kan se betalingene.")}</p>;
  }
  if (!overview) {
    return loadError ? (
      <button type="button" onClick={() => void load()} className="text-sm font-medium text-red-700 underline">
        {t("Couldn't load the payments — try again", "Kunne ikke laste betalingene — prøv igjen")}
      </button>
    ) : (
      <p className="text-sm text-black/50">{t("Loading…", "Laster…")}</p>
    );
  }

  const state = paymentCardState(overview, previewTotalIncVat);
  const badge = getPaymentStatusPresentation(overview.paymentStatus, locale);
  const sentOrPaid = state.allPaid
    ? t(`Customer paid ${formatKr(state.paidIncVatNok)}.`, `Kunden har betalt ${formatKr(state.paidIncVatNok)}.`)
    : t(`Customer was sent ${formatKr(state.invoicedIncVatNok)}.`, `Kunden er fakturert ${formatKr(state.invoicedIncVatNok)}.`);
  const now = state.afterChange ? t("After this change the order is", "Etter denne endringen er ordren") : t("The order is now", "Ordren er nå");

  const outcome =
    state.headline === "not_priced"
      ? { className: "bg-black/5 text-black/70", text: t("Not priced yet — nothing to invoice.", "Ikke priset ennå — ingenting å fakturere.") }
      : state.headline === "not_invoiced"
        ? {
            className: "bg-black/5 text-black/75",
            text: t(`No faktura sent yet — the order is ${formatKr(state.totalIncVatNok)}.`, `Ingen faktura sendt ennå — ordren er ${formatKr(state.totalIncVatNok)}.`),
          }
        : state.headline === "pending"
          ? {
              className: "bg-amber-100 text-amber-900",
              text: t(`Faktura sent – ${formatKr(state.invoicedIncVatNok)}. Waiting for payment.`, `Faktura sendt – ${formatKr(state.invoicedIncVatNok)}. Venter på betaling.`),
            }
          : state.headline === "paid"
            ? { className: "bg-green-100 text-green-800", text: t(`Paid – ${formatKr(state.paidIncVatNok)}. Nothing to collect.`, `Betalt – ${formatKr(state.paidIncVatNok)}. Ingenting å kreve inn.`) }
            : state.headline === "due_more"
              ? {
                  className: "bg-amber-100 text-amber-900",
                  text: `${sentOrPaid} ${now} ${formatKr(state.totalIncVatNok)}: ${formatKr(state.differenceIncVatNok, { signed: true })} ${t("to invoice.", "å fakturere.")}`,
                }
              : {
                  className: "bg-red-100 text-red-800",
                  text: `${sentOrPaid} ${now} ${formatKr(state.totalIncVatNok)}: ${formatKr(-Math.abs(state.differenceIncVatNok))} ${t("owed to the customer.", "til gode for kunden.")}`,
                };

  const button = "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 text-sm">
      {badge && (
        <span className="self-start rounded px-2 py-0.5 text-xs font-semibold" style={badge.style}>
          {badge.label}
        </span>
      )}

      {overview.invoices.length > 0 && (
        <ul className="flex flex-col divide-y divide-black/5 rounded-xl border border-black/10">
          {overview.invoices.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex flex-col">
                <span className="font-medium text-black/85">
                  {entry.kind === "refund" ? t("Kreditnota", "Kreditnota") : t("Faktura", "Faktura")} {entry.number}
                </span>
                <span className="text-xs text-black/50">
                  {entry.kind === "refund" ? t("Recorded", "Registrert") : t("Sent", "Sendt")} {formatDate(entry.createdAt)}
                  {entry.kind === "invoice" && entry.paidAt ? ` · ${t("paid", "betalt")} ${formatDate(entry.paidAt)}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-black/85">
                  {formatKr(entry.kind === "refund" ? -entry.amountIncVatNok : entry.amountIncVatNok)}
                </span>
                {entry.kind === "invoice" && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${entry.paidAt ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}
                  >
                    {entry.paidAt ? t("Paid", "Betalt") : t("Pending", "Venter")}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className={`rounded-xl px-4 py-3 text-base font-semibold ${outcome.className}`}>{outcome.text}</p>

      {state.afterChange && state.differenceIncVatNok !== 0 && (
        <p className="text-xs text-black/55">{t("Save the order to invoice the difference.", "Lagre ordren for å fakturere differansen.")}</p>
      )}

      {(state.actions.sendInvoiceCents || state.actions.recordRefundCents || state.actions.markPaid) && (
        <div className="flex flex-wrap gap-2">
          {state.actions.sendInvoiceCents !== null && (
            <button type="button" disabled={!!busy} onClick={() => void act("invoice", state.actions.sendInvoiceCents!)} className={`${button} bg-logoblue text-white`}>
              {busy === "invoice"
                ? t("Sending…", "Sender…")
                : overview.invoices.length === 0
                  ? t(`Send faktura – ${formatKr(state.actions.sendInvoiceCents / 100)}`, `Send faktura – ${formatKr(state.actions.sendInvoiceCents / 100)}`)
                  : t(`Send faktura for ${formatKr(state.actions.sendInvoiceCents / 100)}`, `Send faktura på ${formatKr(state.actions.sendInvoiceCents / 100)}`)}
            </button>
          )}
          {state.actions.recordRefundCents !== null && (
            <button type="button" disabled={!!busy} onClick={() => void act("refund", state.actions.recordRefundCents!)} className={`${button} bg-red-600 text-white`}>
              {busy === "refund"
                ? t("Recording…", "Registrerer…")
                : t(`Record refund ${formatKr(state.actions.recordRefundCents / 100)}`, `Registrer tilbakebetaling ${formatKr(state.actions.recordRefundCents / 100)}`)}
            </button>
          )}
          {state.actions.markPaid && (
            <button type="button" disabled={!!busy} onClick={() => void act("paid")} className={`${button} border border-green-700 text-green-800`}>
              {busy === "paid" ? t("Saving…", "Lagrer…") : t("Mark as paid", "Marker som betalt")}
            </button>
          )}
        </div>
      )}

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.tone === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}
    </div>
  );
}

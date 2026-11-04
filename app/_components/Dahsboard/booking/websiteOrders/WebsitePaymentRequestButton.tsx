"use client";

import { useState } from "react";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import { formatKr } from "@/lib/orders/orderChangeText";

type Props = {
  orderId: string;
  // What the saved order says is still owed (positive kroner, incl. VAT).
  dueIncVatNok: number;
  locale: BookingUiLocale;
  onSent: () => void;
};

// Under the payment summary when the customer owes more (the price went up
// after they paid by Stripe): emails them a link to pay exactly that —
// POST /api/orders/[orderId]/request-payment. Sends the amount shown, so a
// change made meanwhile is caught instead of asking for something unseen.
export default function WebsitePaymentRequestButton({ orderId, dueIncVatNok, locale, onSent }: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const amount = formatKr(dueIncVatNok);

  const reasonText: Record<string, string> = {
    NOTHING_DUE: t("Nothing more is owed any more.", "Det er ikke noe mer å betale lenger."),
    AMOUNT_CHANGED: t(
      "The order changed meanwhile — reopen it to see the new amount.",
      "Bestillingen er endret i mellomtiden — åpne den på nytt for å se det nye beløpet.",
    ),
    MISSING_CUSTOMER_EMAIL: t("The order has no customer email.", "Bestillingen har ingen e-post til kunden."),
    EMAIL_FAILED: t("The email couldn't be sent — try again.", "E-posten kunne ikke sendes — prøv igjen."),
    FORBIDDEN: t("Only admins can send payment requests.", "Kun administratorer kan sende betalingsforespørsler."),
  };

  async function send() {
    setMessage(null);
    if (
      !confirm(
        t(
          `Email the customer a link to pay ${amount}? The email lists what changed and the new total.`,
          `Sende kunden en lenke for å betale ${amount}? E-posten viser hva som er endret og ny totalpris.`,
        ),
      )
    ) {
      return;
    }
    try {
      setBusy(true);
      const res = await fetch(`/api/orders/${orderId}/request-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amountCents: Math.round(dueIncVatNok * 100) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const reason = data?.reason as string | undefined;
        setMessage({
          tone: "error",
          text: (reason && reasonText[reason]) || t("Couldn't send the payment request.", "Kunne ikke sende betalingsforespørselen."),
        });
        return;
      }
      setMessage({ tone: "ok", text: t(`Payment request for ${amount} sent.`, `Betalingsforespørsel på ${amount} sendt.`) });
      onSent();
    } catch {
      setMessage({ tone: "error", text: t("Couldn't send the payment request.", "Kunne ikke sende betalingsforespørselen.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="inline-flex h-11 items-center justify-center rounded-full bg-amber-100 px-5 text-sm font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
      >
        {busy ? t("Sending…", "Sender…") : t(`Send payment request (${amount})`, `Send betalingsforespørsel (${amount})`)}
      </button>
      {message && (
        <p className={`text-center text-sm font-medium ${message.tone === "ok" ? "text-green-700" : "text-red-600"}`}>{message.text}</p>
      )}
    </div>
  );
}

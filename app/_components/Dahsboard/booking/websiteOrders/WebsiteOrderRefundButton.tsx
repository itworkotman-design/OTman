"use client";

import { useState } from "react";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import { formatKr } from "@/lib/orders/orderChangeText";

type Props = {
  orderId: string;
  // What the saved order says is overpaid (positive kroner, incl. VAT).
  overpaidIncVatNok: number;
  locale: BookingUiLocale;
  onRefunded: () => void;
};

// Under the payment summary when the customer has overpaid (the price went
// down after they paid): refunds exactly that through Stripe —
// POST /api/orders/[orderId]/refund-difference. Sends the amount shown, so a
// change made meanwhile is caught instead of refunding something unseen.
export default function WebsiteOrderRefundButton({ orderId, overpaidIncVatNok, locale, onRefunded }: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const amount = formatKr(overpaidIncVatNok);

  const reasonText: Record<string, string> = {
    NOTHING_TO_REFUND: t("Nothing is overpaid any more.", "Ingenting er betalt for mye lenger."),
    AMOUNT_CHANGED: t(
      "The order changed meanwhile — reopen it to see the new amount.",
      "Bestillingen er endret i mellomtiden — åpne den på nytt for å se det nye beløpet.",
    ),
    REFUND_FAILED: t(
      "Stripe couldn't refund the payment — try again, or check Stripe.",
      "Stripe kunne ikke tilbakebetale — prøv igjen, eller sjekk Stripe.",
    ),
    REFUND_NOT_POSSIBLE: t(
      "A payment on this order can't be refunded automatically. Refund it in Stripe.",
      "En betaling på denne bestillingen kan ikke tilbakebetales automatisk. Gjør det i Stripe.",
    ),
    FORBIDDEN: t("Only admins can refund.", "Kun administratorer kan tilbakebetale."),
  };

  async function refund() {
    setMessage(null);
    if (
      !confirm(
        t(
          `Refund ${amount} to the customer's card? They get an email with the amount and the new total.`,
          `Tilbakebetale ${amount} til kundens kort? Kunden får en e-post med beløpet og ny totalpris.`,
        ),
      )
    ) {
      return;
    }
    try {
      setBusy(true);
      const res = await fetch(`/api/orders/${orderId}/refund-difference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amountCents: Math.round(overpaidIncVatNok * 100) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const reason = data?.reason as string | undefined;
        setMessage({ tone: "error", text: (reason && reasonText[reason]) || t("Couldn't refund.", "Kunne ikke tilbakebetale.") });
        return;
      }
      setMessage(
        data.emailFailed
          ? {
              tone: "error",
              text: t(
                `Refunded ${amount}, but the email to the customer failed — let them know.`,
                `Tilbakebetalt ${amount}, men e-posten til kunden feilet — gi dem beskjed.`,
              ),
            }
          : { tone: "ok", text: t(`Refunded ${amount}.`, `Tilbakebetalt ${amount}.`) },
      );
      onRefunded();
    } catch {
      setMessage({ tone: "error", text: t("Couldn't refund.", "Kunne ikke tilbakebetale.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        onClick={refund}
        disabled={busy}
        className="inline-flex h-11 items-center justify-center rounded-full bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? t("Refunding…", "Tilbakebetaler…") : t(`Refund ${amount}`, `Tilbakebetal ${amount}`)}
      </button>
      {message && (
        <p className={`text-center text-sm font-medium ${message.tone === "ok" ? "text-green-700" : "text-red-600"}`}>{message.text}</p>
      )}
    </div>
  );
}

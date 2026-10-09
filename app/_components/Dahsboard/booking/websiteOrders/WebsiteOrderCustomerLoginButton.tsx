"use client";

import { useState } from "react";

// "Send new login": emails the customer a fresh "My order" password
// (POST /api/orders/[orderId]/customer-login). For a customer who lost it,
// or whose login was already deleted (e.g. a no-show calling back to move
// the date). The modal only shows it while the order has no live login, and
// it hides itself once it has sent one.
export default function WebsiteOrderCustomerLoginButton({
  orderId,
  email,
  t,
  onResult,
}: {
  orderId: string;
  email: string | null;
  t: (en: string, no: string) => string;
  onResult: (message: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  if (!email || sent) return null;

  async function send() {
    if (sending) return;
    if (!confirm(t(`Send a new My order password to ${email}? The old one stops working.`, `Sende nytt Min bestilling-passord til ${email}? Det gamle slutter å virke.`))) {
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/customer-login`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) setSent(true);
      onResult(
        res.ok && data?.ok
          ? t(`New login sent to ${data.email}.`, `Ny innlogging sendt til ${data.email}.`)
          : t(`Could not send the login (${data?.reason ?? res.status}).`, `Kunne ikke sende innloggingen (${data?.reason ?? res.status}).`),
      );
    } catch {
      onResult(t("Could not send the login.", "Kunne ikke sende innloggingen."));
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={sending}
      className="inline-flex h-9 items-center justify-center rounded-full border border-black/20 px-4 text-sm font-semibold text-black/70 disabled:opacity-50"
    >
      {sending ? t("Sending…", "Sender…") : t("Send new login", "Send ny innlogging")}
    </button>
  );
}

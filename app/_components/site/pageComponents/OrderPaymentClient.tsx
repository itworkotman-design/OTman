"use client";

import { useState } from "react";

type Props = {
  token: string;
  locale: "en" | "no";
  payable: boolean;
  resultParam: string | null;
};

const TEXT = {
  no: {
    pay: "Betal med kort",
    paying: "Åpner betaling...",
    error: "Kunne ikke starte betaling. Prøv igjen, eller ta kontakt med oss.",
    cancelledNotice: "Betalingen ble avbrutt. Du kan prøve igjen når du er klar.",
  },
  en: {
    pay: "Pay with card",
    paying: "Opening payment...",
    error: "Could not start payment. Please try again, or contact us.",
    cancelledNotice: "Payment was cancelled. You can try again when ready.",
  },
} as const;

export default function OrderPaymentClient({ token, locale, payable, resultParam }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const t = TEXT[locale];

  async function handlePay() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/public/orders/${token}/checkout`, { method: "POST" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok || !data?.url) {
        setError(t.error);
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError(t.error);
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      {resultParam === "cancelled" && (
        <p className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">{t.cancelledNotice}</p>
      )}

      {payable && (
        <button
          type="button"
          onClick={handlePay}
          disabled={loading}
          className="customButtonEnabled h-11 px-6 disabled:opacity-50!"
        >
          {loading ? t.paying : t.pay}
        </button>
      )}

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}

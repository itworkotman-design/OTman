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
    <div>
      {resultParam === "cancelled" && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{t.cancelledNotice}</p>
      )}

      {payable && (
        <button
          type="button"
          onClick={handlePay}
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-logoblue px-6 text-base font-semibold text-white shadow-sm transition hover:bg-logoblue/90 disabled:opacity-50"
        >
          {loading ? t.paying : t.pay}
        </button>
      )}

      {error && <p className="mt-3 text-center text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}

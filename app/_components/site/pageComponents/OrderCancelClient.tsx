"use client";

import { useState } from "react";

type Props = {
  token: string;
  locale: "en" | "no";
};

const TEXT = {
  no: {
    confirm: "Er du sikker på at du vil kansellere bestillingen?",
    button: "Ja, kanseller bestillingen",
    cancelling: "Kansellerer...",
    done: "Bestillingen er kansellert.",
    error: "Kunne ikke kansellere bestillingen. Ta kontakt med oss.",
  },
  en: {
    confirm: "Are you sure you want to cancel the order?",
    button: "Yes, cancel the order",
    cancelling: "Cancelling...",
    done: "The order has been cancelled.",
    error: "Could not cancel the order. Please contact us.",
  },
} as const;

export default function OrderCancelClient({ token, locale }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const t = TEXT[locale];

  async function handleCancel() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/public/orders/${token}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(t.error);
        setLoading(false);
        return;
      }

      setDone(true);
    } catch {
      setError(t.error);
      setLoading(false);
    }
  }

  if (done) {
    return <p className="mt-6 text-sm font-medium text-green-700">{t.done}</p>;
  }

  return (
    <div className="mt-6">
      <p className="mb-4 text-sm text-textColorThird">{t.confirm}</p>
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="customButtonEnabled h-11 px-6 disabled:opacity-50!"
      >
        {loading ? t.cancelling : t.button}
      </button>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}

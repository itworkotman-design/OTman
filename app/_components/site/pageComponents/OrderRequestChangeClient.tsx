"use client";

import { useState } from "react";

type Props = {
  token: string;
  locale: "en" | "no";
};

const TEXT = {
  no: {
    label: "Hva ønsker du å endre?",
    placeholder: "Skriv en kort melding om hva du ønsker å endre...",
    submit: "Send melding",
    sending: "Sender...",
    done: "Takk! Meldingen din er sendt, og vi tar kontakt med deg.",
    error: "Kunne ikke sende meldingen. Ta kontakt med oss.",
    required: "Skriv inn en melding før du sender.",
  },
  en: {
    label: "What would you like to change?",
    placeholder: "Write a short message about what you'd like to change...",
    submit: "Send message",
    sending: "Sending...",
    done: "Thank you! Your message has been sent, and we'll be in touch.",
    error: "Could not send the message. Please contact us.",
    required: "Enter a message before sending.",
  },
} as const;

export default function OrderRequestChangeClient({ token, locale }: Props) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const t = TEXT[locale];

  async function handleSubmit() {
    if (!message.trim()) {
      setError(t.required);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/public/orders/${token}/request-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
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
      <label className="mb-2 block text-sm font-medium">{t.label}</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t.placeholder}
        rows={5}
        className="customInput w-full resize-y py-3"
        disabled={loading}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="customButtonEnabled mt-4 h-11 px-6 disabled:opacity-50!"
      >
        {loading ? t.sending : t.submit}
      </button>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}

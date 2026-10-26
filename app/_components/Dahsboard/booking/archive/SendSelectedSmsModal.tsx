"use client";

import { useEffect, useState } from "react";
import {
  SmsModalShell,
  SmsPlaceholderLegend,
  useSmsTemplates,
} from "@/app/_components/Dahsboard/booking/archive/SmsTemplates";
import { sortSmsTemplates } from "@/lib/sms/templates";

type SendResult = {
  sentCount: number;
  failed: Array<{ orderId: string; displayId: number; reason: string }>;
};

const FAILURE_LABELS: Record<string, string> = {
  MISSING_PHONE: "no phone number",
  INVALID_PHONE: "invalid phone number",
};

type Props = {
  open: boolean;
  orderIds: string[];
  onClose: () => void;
  onSent?: () => void;
};

export default function SendSelectedSmsModal({ open, orderIds, onClose, onSent }: Props) {
  const { data } = useSmsTemplates(open);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setError("");
    setResult(null);
  }, [open]);

  if (!open) return null;

  // Automatic templates are offered too, so their text can be sent by hand.
  const templates = sortSmsTemplates(data?.templates ?? []);

  async function handleSend() {
    if (!window.confirm(`Send this SMS to the customers on ${orderIds.length} order(s)?`)) return;

    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/orders/send-selected-sms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds, message }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        setError(json?.reason || "Failed to send SMS");
        return;
      }
      setResult({ sentCount: json.sentCount, failed: json.failed ?? [] });
      onSent?.();
    } catch {
      setError("Failed to send SMS");
    } finally {
      setSending(false);
    }
  }

  return (
    <SmsModalShell
      title="Send SMS"
      subtitle={`${orderIds.length} selected order(s). Each customer gets their own text at the order's Phone (or Phone 2).`}
      onClose={onClose}
    >
      {data && data.configured === false ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SMS is not set up yet (GATEWAYAPI_TOKEN is missing on the server).
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-2xl border border-black/10 bg-white p-4 text-sm">
          <div className="font-semibold text-green-700">Sent {result.sentCount} SMS.</div>
          {result.failed.length ? (
            <div className="text-red-700">
              <div className="font-semibold">Not sent ({result.failed.length}):</div>
              <ul className="mt-1 list-disc pl-5">
                {result.failed.map((item) => (
                  <li key={item.orderId}>
                    Order {item.displayId}: {FAILURE_LABELS[item.reason] ?? item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="rounded-full bg-logoblue px-5 py-2 text-sm font-semibold text-white">
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          {templates.length ? (
            <label className="mb-3 block">
              <div className="mb-1 text-sm font-medium text-textColorThird">Template</div>
              <select
                value=""
                onChange={(event) => {
                  const template = templates.find((item) => item.id === event.target.value);
                  if (template) setMessage(template.body);
                }}
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
              >
                <option value="">Insert template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.kind !== "MANUAL" ? " (automatic)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <div className="mb-1 text-sm font-medium text-textColorThird">Message</div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
              placeholder="Hei {name}! ..."
            />
          </label>
          <div className="mt-2">
            <SmsPlaceholderLegend placeholders={data?.placeholders ?? []} onInsert={(token) => setMessage((current) => `${current}${token}`)} />
          </div>

          {error ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={sending || !message.trim() || orderIds.length === 0}
              onClick={() => void handleSend()}
              className="rounded-full bg-logoblue px-5 py-2 text-sm font-semibold text-white transition hover:bg-logoblue/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending..." : `Send to ${orderIds.length} customer(s)`}
            </button>
          </div>
        </div>
      )}
    </SmsModalShell>
  );
}

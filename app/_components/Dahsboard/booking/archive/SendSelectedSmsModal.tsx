"use client";

import { useEffect, useState } from "react";
import {
  SmsModalShell,
  SmsPlaceholderLegend,
  useSmsTemplates,
} from "@/app/_components/Dahsboard/booking/archive/SmsTemplates";
import { sortSmsTemplates } from "@/lib/sms/templates";

type MissingPlaceholders = Array<{ orderId: string; displayId: number; placeholders: string[] }>;

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
  const [missing, setMissing] = useState<MissingPlaceholders>([]);

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setError("");
    setResult(null);
    setMissing([]);
  }, [open]);

  // Asks the route (preview mode, nothing is sent) which selected orders have
  // no value for a placeholder the text uses. Debounced while typing.
  useEffect(() => {
    if (!open || !message.trim() || !/\{\w+\}/.test(message)) {
      setMissing([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/orders/send-selected-sms", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds, message, preview: true }),
          signal: controller.signal,
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.ok) setMissing(json.missing ?? []);
      } catch {
        // Aborted or offline: keep the last known warning.
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, orderIds, message]);

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
              className="min-h-[140px] w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
              placeholder="Hei {name}! ..."
            />
          </label>
          <div className="mt-2">
            <SmsPlaceholderLegend placeholders={data?.placeholders ?? []} onInsert={(token) => setMessage((current) => `${current}${token}`)} />
          </div>

          {missing.length ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div className="font-semibold">
                {missing.length} order(s) have no value for a placeholder, so it will be left empty:
              </div>
              <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5">
                {missing.map((item) => (
                  <li key={item.orderId}>
                    Order {item.displayId}: {item.placeholders.map((key) => `{${key}}`).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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

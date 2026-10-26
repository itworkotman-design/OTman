"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { renderSmsTemplate, type SmsTemplateVariables } from "@/lib/sms/templates";
import { countSmsSegments } from "@/lib/sms/segments";

type SmsMessage = {
  id: string;
  kind: "MANUAL" | "DAY_OF_DELIVERY" | "REVIEW_REQUEST";
  status: "SENT" | "DELIVERED" | "FAILED";
  providerStatus: string | null;
  errorMessage: string | null;
  toPhone: string;
  body: string;
  createdAt: string;
  sentAt: string | null;
  statusUpdatedAt: string | null;
  sentByMembership: { user: { username: string | null; email: string } } | null;
};

type SmsTemplateOption = {
  id: string;
  kind: "MANUAL" | "DAY_OF_DELIVERY" | "REVIEW_REQUEST";
  name: string;
  body: string;
};

type OrderSmsResponse = {
  ok: boolean;
  reason?: string;
  configured?: boolean;
  messages?: SmsMessage[];
  phoneOptions?: Array<{ label: string; phone: string }>;
  templates?: SmsTemplateOption[];
  variables?: SmsTemplateVariables;
};

const CUSTOM_PHONE = "__custom__";

const STATUS_STYLES: Record<SmsMessage["status"], string> = {
  SENT: "bg-slate-100 text-textColorThird",
  DELIVERED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-700",
};

function formatTimestamp(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
}

export function SmsSegmentInfo({ text }: { text: string }) {
  const { characters, segments, unicode } = countSmsSegments(text);
  return (
    <span>
      {characters} characters · {segments} SMS{unicode ? " · contains special characters (shorter SMS parts)" : ""}
    </span>
  );
}

function SmsMessageCard({ message }: { message: SmsMessage }) {
  const sender =
    message.kind === "DAY_OF_DELIVERY"
      ? "Automatic (09:00 on delivery day)"
      : message.kind === "REVIEW_REQUEST"
        ? "Automatic (review request after completion)"
        : message.sentByMembership?.user.username || message.sentByMembership?.user.email || "Unknown";

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-sm text-textColorThird">
          <div className="font-semibold text-logoblue">To +{message.toPhone.replace(/^\+/, "")}</div>
          <div className="mt-1">{sender}</div>
        </div>
        <div className="text-right text-xs text-textColorThird">
          <span className={`rounded-full px-3 py-1 font-semibold ${STATUS_STYLES[message.status]}`}>
            {message.status === "SENT" ? "Sent" : message.status === "DELIVERED" ? "Delivered" : "Failed"}
            {message.providerStatus && message.providerStatus !== message.status ? ` (${message.providerStatus})` : ""}
          </span>
          <div className="mt-2">{formatTimestamp(message.sentAt || message.createdAt)}</div>
        </div>
      </div>
      <div className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-logoblue">{message.body}</div>
      {message.errorMessage ? <div className="mt-2 text-sm text-red-700">{message.errorMessage}</div> : null}
    </div>
  );
}

export default function OrderSmsPanel({ orderId }: { orderId: string }) {
  const [data, setData] = useState<OrderSmsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [phoneChoice, setPhoneChoice] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/sms`, { credentials: "include", cache: "no-store" });
      const json = (await response.json().catch(() => null)) as OrderSmsResponse | null;
      if (!response.ok || !json?.ok) {
        setLoadError(json?.reason || "Failed to load SMS");
        return;
      }
      setData(json);
      setPhoneChoice((current) => current || json.phoneOptions?.[0]?.phone || CUSTOM_PHONE);
    } catch {
      setLoadError("Failed to load SMS");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    setPhoneChoice("");
    setCustomPhone("");
    setMessage("");
    setSendError("");
    void load();
  }, [load]);

  const preview = useMemo(() => (data?.variables ? renderSmsTemplate(message, data.variables) : message), [data, message]);
  const toPhone = phoneChoice === CUSTOM_PHONE ? customPhone : phoneChoice;

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!toPhone.trim() || !message.trim()) return;

    setSending(true);
    setSendError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/sms`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: toPhone, message }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        setSendError(json?.reason === "INVALID_PHONE" ? "Invalid phone number" : json?.reason || "Failed to send SMS");
      } else {
        setMessage("");
      }
      await load();
    } catch {
      setSendError("Failed to send SMS");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {data && data.configured === false ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          SMS is not set up yet (GATEWAYAPI_TOKEN is missing on the server).
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="mb-4 text-base font-semibold text-logoblue">Send SMS</div>

        <form className="space-y-3" onSubmit={handleSend}>
          <div className="grid items-start gap-3 sm:grid-cols-2">
            {/* Recipient column: the custom number field stacks under the
                picker so the template picker beside it is always available. */}
            <div className="space-y-3">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-textColorThird">To</div>
                <select
                  value={phoneChoice}
                  onChange={(event) => setPhoneChoice(event.target.value)}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
                >
                  {data?.phoneOptions?.map((option) => (
                    <option key={option.label} value={option.phone}>
                      {option.label}: {option.phone}
                    </option>
                  ))}
                  <option value={CUSTOM_PHONE}>Other number...</option>
                </select>
              </label>

              {phoneChoice === CUSTOM_PHONE ? (
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-textColorThird">Phone number</div>
                  <input
                    value={customPhone}
                    onChange={(event) => setCustomPhone(event.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
                    placeholder="+47 400 00 000"
                  />
                </label>
              ) : null}
            </div>

            <label className="block">
              <div className="mb-1 text-sm font-medium text-textColorThird">Template</div>
              <select
                value=""
                onChange={(event) => {
                  const template = data?.templates?.find((item) => item.id === event.target.value);
                  if (template) setMessage(template.body);
                }}
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
              >
                <option value="">{data?.templates?.length ? "Insert template..." : "No templates yet (add them in Settings)"}</option>
                {data?.templates?.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.kind !== "MANUAL" ? " (automatic)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-textColorThird">Message</div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-[110px] w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
              placeholder="Write the SMS here. Placeholders like {name} and {address} are filled in from the order."
            />
          </label>

          {message.trim() ? (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-logoblue">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-textColorThird">Preview</div>
              <div className="whitespace-pre-wrap wrap-break-word">{preview}</div>
              <div className="mt-2 text-xs text-textColorThird">
                <SmsSegmentInfo text={preview} />
              </div>
            </div>
          ) : null}

          {sendError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sendError}</div> : null}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={sending || !message.trim() || !toPhone.trim()}
              className="rounded-full bg-logoblue px-5 py-2 text-sm font-semibold text-white transition hover:bg-logoblue/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send SMS"}
            </button>
          </div>
        </form>
      </div>

      {loading && !data ? (
        <div className="py-6 text-sm text-textColorThird">Loading SMS...</div>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : data?.messages?.length ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => void load()} className="text-xs font-semibold text-logoblue hover:underline">
              Refresh status
            </button>
          </div>
          {data.messages.map((item) => (
            <SmsMessageCard key={item.id} message={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-6 text-sm text-textColorThird">No SMS sent for this order yet.</div>
      )}
    </div>
  );
}

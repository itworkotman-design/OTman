"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { OrderRow } from "@/app/_components/Dahsboard/booking/archive/types";

type ConversationMessage = {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  status: "SENT" | "FAILED" | "RECEIVED";
  subject: string;
  bodyText: string;
  bodyHtml: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName: string;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
  sentByName: string;
  sentByEmail: string;
};

type ConversationState = {
  defaultRecipientEmail: string;
  defaultRecipientName: string;
  threadToken: string;
  needsEmailAttention: boolean;
  unreadInboundEmailCount: number;
  lastInboundEmailAt: string | null;
  lastOutboundEmailAt: string | null;
  messages: ConversationMessage[];
};

type OrderContactResponse = {
  ok: boolean;
  conversation?: ConversationState;
  reason?: string;
};

type Props = {
  open: boolean;
  order: OrderRow | null;
  onClose: () => void;
  onConversationChanged?: () => void;
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getConversationBody(message: ConversationMessage) {
  const source = message.bodyText.trim()
    ? message.bodyText
    : message.bodyHtml
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "");

  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*>\s?/, "").replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n(On .+ wrote:)/g, "\n\n$1")
    .replace(/(On .+ wrote:)\n(?!\n)/g, "$1\n\n")
    .replace(/\n(Med vennlig hilsen,)/g, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getConversationSubject(subject: string) {
  return subject.replace(/\s*\[OTMAN:[a-z0-9]+\]/i, "").trim() || "Message";
}

function formatEmailPerson(name: string, email: string) {
  if (name && email) return `${name} (${email})`;
  return name || email || "-";
}

function ConversationMessageCard({ message, expanded, onToggle }: { message: ConversationMessage; expanded: boolean; onToggle: () => void }) {
  const isFromOrderCreator = message.direction === "INBOUND";
  const body = getConversationBody(message);

  return (
    <div className={`flex ${isFromOrderCreator ? "justify-end pl-8 sm:pl-16 lg:pl-28" : "justify-start pr-8 sm:pr-16 lg:pr-28"}`}>
      <div
        className={`w-full max-w-[820] rounded-2xl border p-4 ${
          isFromOrderCreator ? "border-blue-200 bg-blue-50" : message.status === "FAILED" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
        }`}
      >
        <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-start justify-between gap-3 text-left" aria-expanded={expanded}>
          <div>
            <div className="text-base font-semibold text-logoblue">{getConversationSubject(message.subject)}</div>
            <div className="mt-1 text-sm text-textColorThird">
              {isFromOrderCreator
                ? `From ${formatEmailPerson(message.fromName, message.fromEmail)}`
                : `From admin: ${formatEmailPerson(message.fromName, message.fromEmail)}`}
            </div>
          </div>

          <div className="text-right text-sm text-textColorThird">
            <div>{message.direction === "INBOUND" ? "Sent by you" : message.status === "FAILED" ? "Failed" : "Admin reply"}</div>
            <div className="mt-1">{formatTimestamp(message.receivedAt || message.sentAt || message.createdAt)}</div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide">{expanded ? "Collapse" : "Expand"}</div>
          </div>
        </button>

        {expanded ? (
          <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 p-3">
            <div className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-logoblue">{body || "No message content stored."}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function OrderCreatorContactModal({ open, order, onClose, onConversationChanged }: Props) {
  const [mounted, setMounted] = useState(false);
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [expandedMessageIds, setExpandedMessageIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [subject, setSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !order) return;

    setSubject(order.orderNumber ? `Order ${order.displayId} | ${order.orderNumber}` : `Order ${order.displayId}`);
    setMessageText("");
    setSendError("");
    setError("");
  }, [open, order]);

  async function loadConversation(orderId: string) {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/orders/${orderId}/contact`, {
        credentials: "include",
        cache: "no-store",
      });

      const data: OrderContactResponse | null = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setError(data?.reason || "Kunne ikke laste inn samtalen");
        setConversation(null);
        return;
      }

      const nextConversation = data.conversation ?? null;
      setConversation(nextConversation);

      const latestMessageId = nextConversation?.messages?.[0]?.id;
      setExpandedMessageIds(latestMessageId ? [latestMessageId] : []);
    } catch {
      setError("Failed to load conversation");
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !order?.id) return;
    void loadConversation(order.id);
  }, [open, order?.id]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!order?.id) return;

    try {
      setSendLoading(true);
      setSendError("");

      const response = await fetch(`/api/orders/${order.id}/contact`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          message: messageText,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reason?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        setSendError(data?.reason || "Failed to send message");
        return;
      }

      setMessageText("");
      await loadConversation(order.id);
      onConversationChanged?.();
    } catch {
      setSendError("Failed to send message");
    } finally {
      setSendLoading(false);
    }
  }

  function toggleMessageExpansion(messageId: string) {
    setExpandedMessageIds((current) => (current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId]));
  }

  if (!open || !mounted || !order) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center px-4 py-6">
        <div className="flex max-h-[94vh] w-full max-w-[1180] flex-col customContainer bg-white" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
            <div>
              <h2 className="text-2xl font-semibold text-logoblue">Kontakt</h2>
              <p className="mt-1 text-sm text-textColorThird">
                Order {order.displayId}
                {order.orderNumber ? ` | ${order.orderNumber}` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-logoblue text-white"
              aria-label="Close contact modal"
            >
              X
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-6 py-5">
            <div className="space-y-4">
              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="mb-4 text-base font-semibold text-logoblue">{conversation?.messages.length ? "Svar" : "Start samtale"}</div>

                <form className="space-y-3" onSubmit={handleSendMessage}>
                  <label className="block">
                    <div className="mb-1 text-sm font-medium text-textColorThird">Tema</div>
                    <input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
                      placeholder="Tema"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-sm font-medium text-textColorThird">Melding </div>
                    <textarea
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      className="min-h-[140] w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
                      placeholder="Skriv meldingen din her"
                      required
                    />
                  </label>

                  {sendError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sendError}</div> : null}

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="submit"
                      disabled={sendLoading}
                      className="rounded-full bg-logoblue px-5 py-2 text-sm font-semibold text-white transition hover:bg-logoblue/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sendLoading ? "Sender..." : conversation?.messages.length ? "Svar" : "Send melding"}
                    </button>
                  </div>
                </form>
              </div>

              {loading ? (
                <div className="py-6 text-sm text-textColorThird">Laster inn samtale...</div>
              ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : (
                <>
                  <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-textColorThird"></div>
                  </div>

                  {conversation?.messages.length ? (
                    <div className="space-y-3">
                      {conversation.messages.map((message) => (
                        <ConversationMessageCard
                          key={message.id}
                          message={message}
                          expanded={expandedMessageIds.includes(message.id)}
                          onToggle={() => toggleMessageExpansion(message.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-black/10 bg-white px-4 py-6 text-sm text-textColorThird">
                      Ingen samtale ennå for denne bestillingen.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

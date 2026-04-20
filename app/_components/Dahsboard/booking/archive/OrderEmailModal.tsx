"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { OrderRow } from "@/app/_components/Dahsboard/booking/archive/types";

type SnapshotPayload = {
  kind: "created";
  snapshot: Record<string, unknown>;
};

type ChangeItem = {
  field?: string;
  label?: string;
  previousValue?: string;
  nextValue?: string;
};

type ProductChangeItem = {
  cardId?: number;
  title?: string;
  changeType?: "ADDED" | "REMOVED" | "UPDATED";
  changes?: ChangeItem[];
};

type UpdatedPayload = {
  kind: "updated";
  changes: ChangeItem[];
  productChanges?: ProductChangeItem[];
};

type StatusChangedPayload = {
  kind: "status_changed";
  fromStatus: string;
  toStatus: string;
  note: string | null;
};

type HistoryPayload = SnapshotPayload | UpdatedPayload | StatusChangedPayload;

type HistoryItem = {
  id: string;
  type: "CREATED" | "UPDATED" | "STATUS_CHANGED";
  actorName: string;
  actorEmail: string;
  actorSource: string;
  createdAt: string;
  payload: HistoryPayload;
};

type OrderHistoryResponse = {
  ok: boolean;
  history?: HistoryItem[];
  reason?: string;
};

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
  threadToken: string;
  needsEmailAttention: boolean;
  unreadInboundEmailCount: number;
  lastInboundEmailAt: string | null;
  lastOutboundEmailAt: string | null;
  messages: ConversationMessage[];
};

type OrderEmailsResponse = {
  ok: boolean;
  conversation?: ConversationState;
  reason?: string;
};

type NotificationItem = {
  id: string;
  type: "MANUAL_REVIEW" | "GSM_REVIEW" | "CAPACITY_REVIEW";
  title: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string;
};

type OrderNotificationsResponse = {
  ok: boolean;
  notifications?: NotificationItem[];
  reason?: string;
};

type OrderEmailModalProps = {
  open: boolean;
  order: OrderRow | null;
  onClose: () => void;
  onAlertsChanged?: () => void;
};

const SNAPSHOT_LABELS: Record<string, string> = {
  displayId: "Order ID",
  orderNumber: "Order number",
  status: "Status",
  statusNotes: "Status notes",
  customerLabel: "Customer",
  customerName: "Customer name",
  deliveryDate: "Delivery date",
  timeWindow: "Time window",
  pickupAddress: "Pickup address",
  extraPickupAddress: "Extra pickup",
  deliveryAddress: "Delivery address",
  returnAddress: "Return address",
  drivingDistance: "Driving distance",
  phone: "Phone",
  phoneTwo: "Phone 2",
  email: "Email",
  customerComments: "Customer comments",
  description: "Description",
  productsSummary: "Products",
  deliveryTypeSummary: "Delivery type",
  servicesSummary: "Services",
  cashierName: "Cashier name",
  cashierPhone: "Cashier phone",
  subcontractor: "Subcontractor",
  driver: "Driver",
  secondDriver: "Second driver",
  driverInfo: "Driver info",
  licensePlate: "License plate",
  deviation: "Deviation",
  feeExtraWork: "Extra work fee",
  feeAddToOrder: "Add fee to order",
  dontSendEmail: "Do not send email",
  priceExVat: "Price ex. VAT",
  priceSubcontractor: "Subcontractor price",
  rabatt: "Discount",
  leggTil: "Add-on",
  subcontractorMinus: "Subcontractor minus",
  subcontractorPlus: "Subcontractor plus",
  gsmLastTaskState: "GSM task state",
};

function formatActor(item: HistoryItem) {
  if (item.actorName && item.actorEmail) {
    return `${item.actorName} (${item.actorEmail})`;
  }

  if (item.actorName) {
    return item.actorName;
  }

  if (item.actorEmail) {
    return item.actorEmail;
  }

  if (item.actorSource === "GSM_WEBHOOK") {
    return "GSM webhook";
  }

  return "Unknown";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value !== "string") {
    return "-";
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : "-";
}

function getEventTitle(item: HistoryItem) {
  if (item.payload.kind === "created") {
    return "Order created";
  }

  if (item.payload.kind === "status_changed") {
    return `Status changed: ${item.payload.fromStatus} to ${item.payload.toStatus}`;
  }

  return "Order edited";
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
  return subject.replace(/\s*\[OTMAN:[a-z0-9]+\]/i, "").trim() || "Email";
}

function formatEmailPerson(name: string, email: string) {
  if (name && email) {
    return `${name} (${email})`;
  }

  return name || email || "-";
}

function getMessageStatusLabel(message: ConversationMessage) {
  if (message.direction === "INBOUND") {
    return "Received";
  }

  if (message.status === "FAILED") {
    return "Failed";
  }

  return "Sent";
}

function SnapshotGrid({ snapshot }: { snapshot: Record<string, unknown> }) {
  const entries = Object.entries(snapshot).filter(([, value]) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return true;
    }

    return typeof value === "string" && value.trim().length > 0;
  });

  if (entries.length === 0) {
    return <div className="text-sm text-textColorThird">No details available.</div>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-textColorThird">
            {SNAPSHOT_LABELS[key] ?? key}
          </div>
          <div className="mt-1 wrap-break-word text-sm text-logoblue">
            {formatValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function UpdatedChanges({ changes }: { changes: ChangeItem[] }) {
  if (changes.length === 0) {
    return <div className="text-sm text-textColorThird">No details available.</div>;
  }

  return (
    <div className="space-y-3">
      {changes.map((change, index) => (
        <div
          key={`${change.field ?? "change"}-${index}`}
          className="rounded-2xl border border-black/10 bg-white p-4"
        >
          <div className="text-sm font-semibold text-logoblue">
            {change.label || change.field || "Change"}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-textColorThird">
                Before
              </div>
              <div className="mt-1 wrap-break-word text-sm text-textColorThird">
                {change.previousValue || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-textColorThird">
                After
              </div>
              <div className="mt-1 wrap-break-word text-sm text-logoblue">
                {change.nextValue || "-"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductChanges({ changes }: { changes: ProductChangeItem[] }) {
  if (changes.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="text-sm font-semibold text-logoblue">Product changes</div>
      {changes.map((change, index) => {
        const tone =
          change.changeType === "ADDED"
            ? "border-emerald-200 bg-emerald-50"
            : change.changeType === "REMOVED"
              ? "border-rose-200 bg-rose-50"
              : "border-blue-200 bg-blue-50";

        return (
          <div
            key={`${change.cardId ?? index}-${change.title ?? "product"}`}
            className={`rounded-2xl border p-2 ${tone}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-logoblue">
                {change.title || "Product change"}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-textColorThird">
                {change.changeType || "UPDATED"}
              </div>
            </div>

            <div className="mt-2">
              {(change.changes ?? []).map((fieldChange, fieldIndex) => (
                <div
                  key={`${fieldChange.label ?? "field"}-${fieldIndex}`}
                  className="rounded-xl border border-white/70 bg-white/80 p-2"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-textColorThird">
                    {fieldChange.label || "Change"}
                  </div>
                  <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-textColorThird">
                        Before
                      </div>
                      <div className="mt-0.5 wrap-break-word text-sm leading-snug text-textColorThird">
                        {fieldChange.previousValue || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-textColorThird">
                        After
                      </div>
                      <div className="mt-0.5 wrap-break-word text-sm leading-snug text-logoblue">
                        {fieldChange.nextValue || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusChange({ payload }: { payload: StatusChangedPayload }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-800">
        <span>{payload.fromStatus}</span>
        <span>to</span>
        <span>{payload.toStatus}</span>
      </div>
      {payload.note ? (
        <div className="mt-2 text-sm text-emerald-900">{payload.note}</div>
      ) : null}
    </div>
  );
}

function ConversationMessageCard({
  message,
  expanded,
  onToggle,
}: {
  message: ConversationMessage;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isInbound = message.direction === "INBOUND";
  const statusLabel = getMessageStatusLabel(message);
  const body = getConversationBody(message);

  return (
    <div
      className={`flex ${
        isInbound
          ? "justify-start pr-8 sm:pr-16 lg:pr-28"
          : "justify-end pl-8 sm:pl-16 lg:pl-28"
      }`}
    >
      <div
        className={`w-full max-w-[820] rounded-2xl border p-4 ${
          isInbound
            ? "border-amber-200 bg-amber-50"
            : message.status === "FAILED"
              ? "border-red-200 bg-red-50"
              : "border-blue-200 bg-blue-50"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
          aria-expanded={expanded}
        >
          <div>
            <div className="text-base font-semibold text-logoblue">
              {getConversationSubject(message.subject)}
            </div>
            <div className="mt-1 text-sm text-textColorThird">
              {isInbound
                ? `From ${formatEmailPerson(message.fromName, message.fromEmail)}`
                : `To ${formatEmailPerson(message.toName, message.toEmail)}`}
            </div>
            {!isInbound && message.sentByName ? (
              <div className="mt-1 text-sm text-textColorThird">
                Sent by {formatEmailPerson(message.sentByName, message.sentByEmail)}
              </div>
            ) : null}
          </div>

          <div className="text-right text-sm text-textColorThird">
            <div>{statusLabel}</div>
            <div className="mt-1">
              {formatTimestamp(
                message.receivedAt || message.sentAt || message.createdAt,
              )}
            </div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-textColorThird">
              {expanded ? "Collapse" : "Expand"}
            </div>
          </div>
        </button>

        {expanded ? (
          <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 p-3">
            <div className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-logoblue">
              {body || "No message content stored."}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function OrderEmailModal({
  open,
  order,
  onClose,
  onAlertsChanged,
}: OrderEmailModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "conversation" | "notifications" | "history"
  >(
    "conversation",
  );

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [conversation, setConversation] = useState<ConversationState | null>(
    null,
  );
  const [expandedMessageIds, setExpandedMessageIds] = useState<string[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState("");

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [resolvingNotificationIds, setResolvingNotificationIds] = useState<
    string[]
  >([]);

  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [additionalRecipientEmail, setAdditionalRecipientEmail] = useState("");
  const [additionalRecipientName, setAdditionalRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !order) {
      return;
    }

    const defaultSubject =
      order.orderNumber && order.orderNumber.trim().length > 0
        ? `Order ${order.displayId} | ${order.orderNumber}`
        : `Order ${order.displayId}`;

    setActiveTab(
      order.needsNotificationAttention &&
        !(order.needsEmailAttention || order.unreadInboundEmailCount > 0)
        ? "notifications"
        : "conversation",
    );
    setRecipientEmail(order.email || "");
    setRecipientName(order.customerName || order.customerLabel || "");
    setAdditionalRecipientEmail("");
    setAdditionalRecipientName("");
    setSubject(defaultSubject);
    setMessageText("");
    setSendError("");
  }, [
    open,
    order,
  ]);

  useEffect(() => {
    const latestMessageId = conversation?.messages[0]?.id;

    if (!latestMessageId) {
      setExpandedMessageIds([]);
      return;
    }

    setExpandedMessageIds([latestMessageId]);
  }, [conversation?.messages]);

  useEffect(() => {
    if (!open || !order?.id) {
      return;
    }

    let active = true;
    const orderId = order.id;

    async function loadHistory() {
      try {
        setHistoryLoading(true);
        setHistoryError("");

        const response = await fetch(`/api/orders/${orderId}/history`, {
          credentials: "include",
          cache: "no-store",
        });

        const data: OrderHistoryResponse | null = await response
          .json()
          .catch(() => null);

        if (!response.ok || !data?.ok) {
          if (active) {
            setHistoryError(data?.reason || "Failed to load order history");
            setHistory([]);
          }
          return;
        }

        if (active) {
          setHistory(Array.isArray(data.history) ? data.history : []);
        }
      } catch {
        if (active) {
          setHistoryError("Failed to load order history");
          setHistory([]);
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    }

    async function loadConversation() {
      try {
        setConversationLoading(true);
        setConversationError("");

        const response = await fetch(`/api/orders/${orderId}/emails`, {
          credentials: "include",
          cache: "no-store",
        });

        const data: OrderEmailsResponse | null = await response
          .json()
          .catch(() => null);

        if (!response.ok || !data?.ok) {
          if (active) {
            setConversationError(
              data?.reason || "Failed to load order conversation",
            );
            setConversation(null);
          }
          return;
        }

        if (active) {
          setConversation(data.conversation ?? null);
        }
      } catch {
        if (active) {
          setConversationError("Failed to load order conversation");
          setConversation(null);
        }
      } finally {
        if (active) {
          setConversationLoading(false);
        }
      }
    }

    async function loadNotifications() {
      try {
        setNotificationsLoading(true);
        setNotificationsError("");

        const response = await fetch(`/api/orders/${orderId}/notifications`, {
          credentials: "include",
          cache: "no-store",
        });

        const data: OrderNotificationsResponse | null = await response
          .json()
          .catch(() => null);

        if (!response.ok || !data?.ok) {
          if (active) {
            setNotificationsError(
              data?.reason || "Failed to load notifications",
            );
            setNotifications([]);
          }
          return;
        }

        if (active) {
          setNotifications(
            Array.isArray(data.notifications) ? data.notifications : [],
          );
        }
      } catch {
        if (active) {
          setNotificationsError("Failed to load notifications");
          setNotifications([]);
        }
      } finally {
        if (active) {
          setNotificationsLoading(false);
        }
      }
    }

    void Promise.all([loadHistory(), loadConversation(), loadNotifications()]);

    return () => {
      active = false;
    };
  }, [open, order?.id]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function handleSendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!order?.id) {
      return;
    }

    try {
      setSendLoading(true);
      setSendError("");

      const response = await fetch(`/api/orders/${order.id}/emails`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: recipientEmail,
          recipientName,
          additionalTo: additionalRecipientEmail,
          additionalRecipientName,
          subject,
          message: messageText,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            reason?: string;
          }
        | null;

      if (!response.ok || !data?.ok) {
        setSendError(data?.reason || "Failed to send email");
        return;
      }

      setMessageText("");
      setConversationError("");

      const conversationResponse = await fetch(`/api/orders/${order.id}/emails`, {
        credentials: "include",
        cache: "no-store",
      });

      const conversationData: OrderEmailsResponse | null =
        await conversationResponse.json().catch(() => null);

      if (conversationResponse.ok && conversationData?.ok) {
        setConversation(conversationData.conversation ?? null);
      }

      onAlertsChanged?.();
    } catch {
      setSendError("Failed to send email");
    } finally {
      setSendLoading(false);
    }
  }

  async function handleConversationComplete() {
    if (!order?.id) {
      return;
    }

    try {
      setCompleteLoading(true);
      setConversationError("");

      const response = await fetch(`/api/orders/${order.id}/emails`, {
        method: "PATCH",
        credentials: "include",
      });

      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            reason?: string;
          }
        | null;

      if (!response.ok || !data?.ok) {
        setConversationError(data?.reason || "Failed to update conversation");
        return;
      }

      setConversation((current) =>
        current
          ? {
              ...current,
              needsEmailAttention: false,
              unreadInboundEmailCount: 0,
            }
          : current,
      );

      onAlertsChanged?.();
    } catch {
      setConversationError("Failed to update conversation");
    } finally {
      setCompleteLoading(false);
    }
  }

  async function handleResolveNotification(notificationId: string) {
    if (!order?.id) {
      return;
    }

    try {
      setResolvingNotificationIds((current) => [...current, notificationId]);
      setNotificationsError("");

      const response = await fetch(
        `/api/orders/${order.id}/notifications/${notificationId}`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      const data = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            reason?: string;
          }
        | null;

      if (!response.ok || !data?.ok) {
        setNotificationsError(data?.reason || "Failed to resolve notification");
        return;
      }

      const resolvedAt = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                resolvedAt,
                resolvedBy: "",
              }
            : notification,
        ),
      );

      onAlertsChanged?.();
    } catch {
      setNotificationsError("Failed to resolve notification");
    } finally {
      setResolvingNotificationIds((current) =>
        current.filter((id) => id !== notificationId),
      );
    }
  }

  function toggleMessageExpansion(messageId: string) {
    setExpandedMessageIds((current) =>
      current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId],
    );
  }

  if (!open || !mounted || !order) {
    return null;
  }

  const orderLabel =
    typeof order.displayId === "number" && order.displayId > 0
      ? `Order ${order.displayId}`
      : "Order";
  const hasMailAttention =
    (conversation?.needsEmailAttention ?? order.needsEmailAttention) ||
    order.unreadInboundEmailCount > 0;
  const hasNotificationAttention =
    notifications.some((notification) => !notification.resolvedAt) ||
    order.needsNotificationAttention;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center px-4 py-6">
        <div
          className="flex max-h-[94vh] w-full max-w-[1180] flex-col customContainer bg-white"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
            <div>
              <h2 className="text-2xl font-semibold text-logoblue">
                Alert Center
              </h2>
              <p className="mt-1 text-sm text-textColorThird">
                {orderLabel}
                {order.orderNumber ? ` | ${order.orderNumber}` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-logoblue text-white"
              aria-label="Close email modal"
            >
              X
            </button>
          </div>

          <div className="border-b border-black/10 px-6 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("conversation")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "conversation"
                    ? "bg-logoblue text-white"
                    : "bg-slate-100 text-textColorThird hover:bg-slate-200"
                }`}
              >
                Conversation
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "history"
                    ? "bg-logoblue text-white"
                    : "bg-slate-100 text-textColorThird hover:bg-slate-200"
                }`}
              >
                Order history
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("notifications")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "notifications"
                    ? "bg-logoblue text-white"
                    : "bg-slate-100 text-textColorThird hover:bg-slate-200"
                }`}
              >
                Notifications
              </button>
              {hasMailAttention ? (
                <>
                  <span className="rounded-full bg-logoblue/10 px-3 py-1 text-xs font-semibold text-logoblue">
                    Awaiting admin reply
                  </span>
                  <button
                    type="button"
                    onClick={handleConversationComplete}
                    disabled={completeLoading}
                    className="rounded-full bg-logoblue px-3 py-1 text-xs font-semibold text-white transition hover:bg-logoblue/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {completeLoading ? "Updating..." : "Conversation complete"}
                  </button>
                </>
              ) : null}
              {hasNotificationAttention ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                  Awaiting notification approval
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-6 py-5">
            {activeTab === "conversation" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="mb-4 text-base font-semibold text-logoblue">
                    Send email
                  </div>

                  <form className="space-y-3" onSubmit={handleSendEmail}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-sm font-medium text-textColorThird">
                          Customer email
                        </div>
                        <input
                          value={recipientEmail}
                          onChange={(event) =>
                            setRecipientEmail(event.target.value)
                          }
                          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
                          placeholder="customer@email.com"
                          readOnly={Boolean(order.email)}
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-sm font-medium text-textColorThird">
                          Customer name
                        </div>
                        <input
                          value={recipientName}
                          onChange={(event) =>
                            setRecipientName(event.target.value)
                          }
                          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
                          placeholder="Customer name"
                          readOnly={Boolean(order.customerName || order.customerLabel)}
                        />
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-sm font-medium text-textColorThird">
                          Additional recipient
                        </div>
                        <input
                          value={additionalRecipientEmail}
                          onChange={(event) =>
                            setAdditionalRecipientEmail(event.target.value)
                          }
                          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
                          placeholder="Optional extra email"
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-sm font-medium text-textColorThird">
                          Additional recipient name
                        </div>
                        <input
                          value={additionalRecipientName}
                          onChange={(event) =>
                            setAdditionalRecipientName(event.target.value)
                          }
                          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
                          placeholder="Optional extra name"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <div className="mb-1 text-sm font-medium text-textColorThird">
                        Subject
                      </div>
                      <input
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
                        placeholder="Email subject"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 text-sm font-medium text-textColorThird">
                        Message
                      </div>
                      <textarea
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        className="min-h-[140] w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-logoblue outline-none transition focus:border-logoblue"
                        placeholder="Write the email here"
                      />
                    </label>

                    {sendError ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {sendError}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="submit"
                        disabled={sendLoading}
                        className="rounded-full bg-logoblue px-5 py-2 text-sm font-semibold text-white transition hover:bg-logoblue/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sendLoading ? "Sending..." : "Send email"}
                      </button>
                    </div>
                  </form>
                </div>

                {conversationLoading ? (
                  <div className="py-6 text-sm text-textColorThird">
                    Loading conversation...
                  </div>
                ) : conversationError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {conversationError}
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-textColorThird">
                          <span>
                            Thread code:{" "}
                            <span className="font-semibold text-logoblue">
                              {conversation?.threadToken
                                ? `[OTMAN:${conversation.threadToken}]`
                                : "Not started yet"}
                            </span>
                          </span>
                        </div>
                      </div>
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
                        No conversation yet for this order.
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : activeTab === "notifications" ? (
              notificationsLoading ? (
                <div className="py-6 text-sm text-textColorThird">
                  Loading notifications...
                </div>
              ) : notificationsError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {notificationsError}
                </div>
              ) : notifications.length === 0 ? (
                <div className="rounded-2xl border border-black/10 bg-white px-4 py-6 text-sm text-textColorThird">
                  No notifications for this order.
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => {
                    const isResolving = resolvingNotificationIds.includes(
                      notification.id,
                    );
                    const isResolved = Boolean(notification.resolvedAt);

                    return (
                      <div
                        key={notification.id}
                        className={`rounded-2xl border p-5 ${
                          isResolved
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-red-200 bg-red-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-logoblue">
                              {notification.title}
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-sm text-textColorThird">
                              {notification.message}
                            </div>
                          </div>

                          <div className="text-right text-sm text-textColorThird">
                            <div>{formatTimestamp(notification.createdAt)}</div>
                            <div className="mt-1 text-xs font-semibold uppercase tracking-wide">
                              {notification.type.replaceAll("_", " ")}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm text-textColorThird">
                            {isResolved
                              ? `Fixed${notification.resolvedAt ? ` at ${formatTimestamp(notification.resolvedAt)}` : ""}${
                                  notification.resolvedBy
                                    ? ` by ${notification.resolvedBy}`
                                    : ""
                                }`
                              : "Needs admin approval"}
                          </div>

                          {!isResolved ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleResolveNotification(notification.id)
                              }
                              disabled={isResolving}
                              className="cursor-pointer rounded-full bg-logored px-4 py-2 text-sm font-semibold text-logoBlue transition hover:bg-logored/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isResolving ? "Updating..." : "Mark as fixed"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : historyLoading ? (
              <div className="py-6 text-sm text-textColorThird">
                Loading order history...
              </div>
            ) : historyError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {historyError}
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white px-4 py-6 text-sm text-textColorThird">
                No history available for this order.
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <details
                    key={item.id}
                    className={`overflow-hidden rounded-2xl border bg-white ${
                      item.payload.kind === "status_changed"
                        ? "border-emerald-200"
                        : "border-black/10"
                    }`}
                  >
                    <summary className="cursor-pointer list-none px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-logoblue">
                            {getEventTitle(item)}
                          </div>
                          <div className="mt-1 text-sm text-textColorThird">
                            {formatActor(item)}
                          </div>
                        </div>

                        <div className="text-right text-sm text-textColorThird">
                          {formatTimestamp(item.createdAt)}
                        </div>
                      </div>
                    </summary>

                    <div className="border-t border-black/10 bg-slate-50 px-5 py-4">
                      {item.payload.kind === "created" ? (
                        <SnapshotGrid snapshot={item.payload.snapshot} />
                      ) : null}

                      {item.payload.kind === "updated" ? (
                        <>
                          <UpdatedChanges changes={item.payload.changes} />
                          <ProductChanges
                            changes={item.payload.productChanges ?? []}
                          />
                        </>
                      ) : null}

                      {item.payload.kind === "status_changed" ? (
                        <StatusChange payload={item.payload} />
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

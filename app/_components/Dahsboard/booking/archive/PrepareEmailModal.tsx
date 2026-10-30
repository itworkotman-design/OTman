"use client";

import { useMemo, useState } from "react";
import { SmsModalShell } from "@/app/_components/Dahsboard/booking/archive/SmsTemplates";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import {
  buildPrepareEmailPreview,
  type PrepareEmailGroup,
  type PrepareEmailPreviewRow,
  type PrepareEmailStop,
} from "@/lib/orders/prepareOrdersEmailGroups";

type GroupStatus = { state: "sent" } | { state: "failed"; reason: string };

type Props = {
  open: boolean;
  groups: PrepareEmailGroup[];
  unresolved: PrepareEmailStop[];
  orders: Array<{ id: string; displayId: number }>;
  locale?: BookingUiLocale;
  onClose: () => void;
  // Called once after sending, with "Name (n)" for every group that went out.
  onSent?: (sent: string[]) => void;
};

// Confirmation for "Send prepare email to selected": shows every email that
// will go out (recipient, addresses, order ids + pickup addresses — an order
// with extra pickups appears once per place) and sends
// each group through /api/orders/send-prepare-email (Gmail, logged in each
// order's conversation, no reply thread). The parent
// mounts it only while open, so its send state starts fresh every time.
export default function PrepareEmailModal({ open, groups, unresolved, orders, locale, onClose, onSent }: Props) {
  const t = (text: string) => bookingText(locale, text);
  const [sending, setSending] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, GroupStatus>>({});
  const [done, setDone] = useState(false);

  const preview = useMemo(
    () => buildPrepareEmailPreview(groups, unresolved, orders),
    [groups, unresolved, orders],
  );

  if (!open) return null;

  const orderCount = preview.groups.reduce((sum, group) => sum + group.rows.length, 0);

  async function handleSend() {
    setSending(true);
    const sent: string[] = [];

    for (const group of groups) {
      const res = await fetch("/api/orders/send-prepare-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: group.orderIds,
          recipients: group.recipients,
          recipientName: group.recipientName,
        }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;
      const status: GroupStatus =
        res?.ok && data?.ok ? { state: "sent" } : { state: "failed", reason: data?.reason || "Failed to send email" };

      if (status.state === "sent") sent.push(`${group.recipientName} (${group.orderIds.length})`);
      setStatuses((prev) => ({ ...prev, [group.key]: status }));
    }

    setSending(false);
    setDone(true);
    if (sent.length > 0) onSent?.(sent);
  }

  return (
    <SmsModalShell
      title={t("Send prepare email")}
      subtitle={`${preview.groups.length} ${t("email(s)")} · ${orderCount} ${t("order(s)")}`}
      onClose={sending ? () => {} : onClose}
    >
      {preview.groups.map((group) => {
        const status = statuses[group.key];

        return (
          <div key={group.key} className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-logoblue">{group.recipientName}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-textColorThird">
                    {group.kind === "pickup" ? t("Pickup address") : group.kind === "store" ? t("Store") : t("Extra pickup")}
                  </span>
                </div>
                <div className="mt-1 text-sm text-textColorThird">
                  {t("To")}: {group.emails.join(", ")}
                </div>
              </div>

              {status?.state === "sent" ? (
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{t("Sent")}</span>
              ) : status?.state === "failed" ? (
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                  {t("Failed")}: {status.reason}
                </span>
              ) : null}
            </div>

            <OrderRowsTable rows={group.rows} t={t} />
          </div>
        );
      })}

      {preview.unresolved.length > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-700">
            {t("Not sent: no email address found")} ({preview.unresolved.length})
          </div>
          <OrderRowsTable rows={preview.unresolved} t={t} />
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        {done ? (
          <button type="button" onClick={onClose} className="customButtonEnabled h-10 px-5">
            {t("Close")}
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} disabled={sending} className="customButtonDefault h-10 px-5 disabled:opacity-50!">
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || preview.groups.length === 0}
              className="customButtonEnabled h-10 px-5 disabled:opacity-50! disabled:cursor-auto!"
            >
              {sending ? t("Sending...") : `${t("Send")} ${preview.groups.length} ${t("email(s)")}`}
            </button>
          </>
        )}
      </div>
    </SmsModalShell>
  );
}

function OrderRowsTable({ rows, t }: { rows: PrepareEmailPreviewRow[]; t: (text: string) => string }) {
  return (
    <table className="mt-3 w-full text-left text-sm">
      <thead>
        <tr className="border-b border-black/10 text-xs text-textColorThird">
          <th className="py-1.5 pr-4 font-medium">{t("Order ID")}</th>
          <th className="py-1.5 font-medium">{t("Pickup address")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-black/5 last:border-0">
            <td className="py-1.5 pr-4 font-medium text-logoblue">{row.displayId}</td>
            <td className="py-1.5 text-textColorSecond">
              {row.pickupAddress || "-"}
              {row.extra ? (
                <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{t("Extra pickup")}</span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

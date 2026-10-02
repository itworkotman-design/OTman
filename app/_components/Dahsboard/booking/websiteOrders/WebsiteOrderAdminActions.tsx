"use client";

import { useEffect, useState } from "react";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import { shouldPromptForPartner } from "@/lib/orders/partnerRequirement";
import { ORDER_STATUS_OPTIONS, normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { buildWebsiteOrderAdminUpdate } from "@/lib/orders/websiteOrderAdminUpdate";

type Partner = { id: string; name: string };

type Props = {
  order: {
    id: string;
    displayId: number;
    status: string | null;
    statusNotes: string | null;
    subcontractorMembershipId: string | null;
    subcontractor: string | null;
    gsmSentAt: string | null;
    gsmSyncStatus: string | null;
  };
  locale: BookingUiLocale;
  // Called after a successful save or GSM send so the caller can reload.
  onChanged: () => void;
};

// Status, status notes, partner and "send to GSM" for a website order — all
// through the existing endpoints (PATCH /api/orders/bulk and
// POST /api/orders/send-to-gsm with this one order), none of which re-price
// the order. Admin/owner only server-side; others get the error back.
export default function WebsiteOrderAdminActions({ order, locale, onChanged }: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const initial = {
    status: normalizeOrderStatus(order.status),
    statusNotes: order.statusNotes ?? "",
    subcontractorId: order.subcontractorMembershipId ?? "",
  };
  const [status, setStatus] = useState(initial.status);
  const [statusNotes, setStatusNotes] = useState(initial.statusNotes);
  const [subcontractorId, setSubcontractorId] = useState(initial.subcontractorId);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/subcontractors", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.ok && Array.isArray(data.subcontractors)) setPartners(data.subcontractors);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const reasonText: Record<string, string> = {
    NO_CHANGES: t("Nothing to save.", "Ingenting å lagre."),
    NOTES_NEED_STATUS_CHANGE: t(
      "Status notes are saved together with a status change.",
      "Statusnotater lagres sammen med en statusendring.",
    ),
    REJECTION_COMMENT_REQUIRED: t("Rejecting needs a comment.", "Avvisning krever en kommentar."),
    FORBIDDEN: t("Only admins can change website orders.", "Kun administratorer kan endre nettsidebestillinger."),
  };

  async function handleSave() {
    setMessage(null);
    const update = buildWebsiteOrderAdminUpdate(order.id, initial, { status, statusNotes, subcontractorId });
    if (!update.ok) {
      setMessage({ tone: "error", text: reasonText[update.reason] });
      return;
    }
    if (
      shouldPromptForPartner({ status, initialStatus: initial.status, subcontractorId, displayId: order.displayId }) &&
      !confirm(
        t(
          "This status normally needs a partner, but none is set. Save anyway?",
          "Denne statusen krever normalt en partner, men ingen er valgt. Lagre likevel?",
        ),
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/orders/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(update.body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const reason = data?.reason as string | undefined;
        setMessage({
          tone: "error",
          text: (reason && reasonText[reason]) || t("Couldn't save the order.", "Kunne ikke lagre bestillingen."),
        });
        return;
      }
      setMessage({ tone: "ok", text: t("Saved.", "Lagret.") });
      onChanged();
    } catch {
      setMessage({ tone: "error", text: t("Couldn't save the order.", "Kunne ikke lagre bestillingen.") });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendToGsm() {
    setMessage(null);
    try {
      setSending(true);
      const res = await fetch("/api/orders/send-to-gsm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderIds: [order.id] }),
      });
      const data = await res.json().catch(() => null);
      const result = Array.isArray(data?.results) ? data.results[0] : null;
      if (!res.ok || !data?.ok || !result?.ok) {
        const reason = (result?.error ?? data?.reason) as string | undefined;
        setMessage({
          tone: "error",
          text: (reason && reasonText[reason]) || reason || t("Couldn't send to GSM.", "Kunne ikke sende til GSM."),
        });
        return;
      }
      setMessage({
        tone: "ok",
        text: result.wasAlreadySent
          ? t("Updated in GSM.", "Oppdatert i GSM.")
          : t("Sent to GSM.", "Sendt til GSM."),
      });
      onChanged();
    } catch {
      setMessage({ tone: "error", text: t("Couldn't send to GSM.", "Kunne ikke sende til GSM.") });
    } finally {
      setSending(false);
    }
  }

  const fieldClass = "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-black/85";
  // The current partner may not be in the list (e.g. no longer a subcontractor).
  const partnerMissingFromList = !!initial.subcontractorId && !partners.some((p) => p.id === initial.subcontractorId);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6">
      <h3 className="text-lg font-semibold text-logoblue">{t("Handle order", "Behandle bestilling")}</h3>

      <div className="mt-4 flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-black/60">{t("Status", "Status")}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
            {!ORDER_STATUS_OPTIONS.includes(status as (typeof ORDER_STATUS_OPTIONS)[number]) && status && (
              <option value={status}>{bookingText(locale, status)}</option>
            )}
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {bookingText(locale, option)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-black/60">{t("Status notes", "Statusnotater")}</span>
          <textarea
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            rows={3}
            className={fieldClass}
            placeholder={t("Saved with a status change", "Lagres sammen med en statusendring")}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-black/60">{t("Partner", "Partner")}</span>
          <select value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)} className={fieldClass}>
            <option value="">{t("— No partner —", "— Ingen partner —")}</option>
            {partnerMissingFromList && (
              <option value={initial.subcontractorId}>{order.subcontractor || initial.subcontractorId}</option>
            )}
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </label>

        <p className="text-xs text-black/50">
          GSM:{" "}
          {order.gsmSentAt
            ? `${t("sent", "sendt")} ${new Date(order.gsmSentAt).toLocaleString("nb-NO")}${order.gsmSyncStatus ? ` (${order.gsmSyncStatus})` : ""}`
            : t("not sent yet", "ikke sendt ennå")}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-full bg-logoblue px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? t("Saving…", "Lagrer…") : t("Save", "Lagre")}
          </button>
          <button
            type="button"
            onClick={handleSendToGsm}
            disabled={sending}
            className="inline-flex h-10 items-center justify-center rounded-full border border-logoblue px-5 text-sm font-semibold text-logoblue disabled:opacity-50"
          >
            {sending
              ? t("Sending…", "Sender…")
              : order.gsmSentAt
                ? t("Update in GSM", "Oppdater i GSM")
                : t("Send to GSM", "Send til GSM")}
          </button>
        </div>

        {message && (
          <p className={`text-sm font-medium ${message.tone === "ok" ? "text-green-700" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";

type Props = {
  selectedCount: number;
  onApprove: (sendEmail: boolean) => Promise<boolean>;
  onReject: (comment: string, sendEmail: boolean) => Promise<boolean>;
  onSendEmail: (kind: "payment_request" | "rejected" | "payment_timeout") => Promise<boolean>;
  onClear: () => void;
  loading?: boolean;
  error?: string;
  locale?: BookingUiLocale;
};

const TEXT = {
  en: {
    selected: "Selected",
    decisionGroup: "Review decision",
    communicationGroup: "Customer emails",
    communicationHint: "Sent manually, separate from approve/reject.",
    approve: "Approve",
    reject: "Reject",
    rejectComment: "Comment (required to reject)",
    confirmReject: "Confirm reject",
    confirmApprove: "Confirm approve",
    cancel: "Cancel",
    alsoSendPaymentEmail: "Also send payment email",
    alsoSendRejectionEmail: "Also send rejection email",
    sendPaymentEmail: "Send payment email",
    sendRejectionEmail: "Send rejection email",
    sendReminderEmail: "Resend payment-reminder email",
    clear: "Clear selection",
    working: "Working...",
    commentRequired: "A comment is required to reject an order.",
    noSelection: "Select one or more orders below to enable actions.",
  },
  nb: {
    selected: "Valgt",
    decisionGroup: "Vurder bestilling",
    communicationGroup: "E-post til kunde",
    communicationHint: "Sendes manuelt, uavhengig av godkjenning/avvisning.",
    approve: "Godkjenn",
    reject: "Avvis",
    rejectComment: "Kommentar (påkrevd for å avvise)",
    confirmReject: "Bekreft avvisning",
    confirmApprove: "Bekreft godkjenning",
    cancel: "Avbryt",
    alsoSendPaymentEmail: "Send også betalings-e-post",
    alsoSendRejectionEmail: "Send også avvisnings-e-post",
    sendPaymentEmail: "Send betalings-e-post",
    sendRejectionEmail: "Send avvisnings-e-post",
    sendReminderEmail: "Send betalingspåminnelse på nytt",
    clear: "Tøm utvalg",
    working: "Arbeider...",
    commentRequired: "En kommentar er påkrevd for å avvise en bestilling.",
    noSelection: "Velg én eller flere bestillinger nedenfor for å aktivere handlinger.",
  },
} as const;

export default function WebsiteOrdersActionBar({
  selectedCount,
  onApprove,
  onReject,
  onSendEmail,
  onClear,
  loading = false,
  error = "",
  locale = "en",
}: Props) {
  const t = TEXT[locale === "nb" ? "nb" : "en"];
  const [comment, setComment] = useState("");
  const [localError, setLocalError] = useState("");
  const [showApprovePanel, setShowApprovePanel] = useState(false);
  const [approveSendEmail, setApproveSendEmail] = useState(false);
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [rejectSendEmail, setRejectSendEmail] = useState(false);

  const hasSelection = selectedCount > 0;
  const disabled = !hasSelection || loading;

  function openApprovePanel() {
    setLocalError("");
    setShowRejectPanel(false);
    setShowApprovePanel(true);
  }

  function closeApprovePanel() {
    setShowApprovePanel(false);
    setApproveSendEmail(false);
    setLocalError("");
  }

  async function handleApprove() {
    setLocalError("");
    const ok = await onApprove(approveSendEmail);
    if (ok) {
      setShowApprovePanel(false);
      setApproveSendEmail(false);
    }
  }

  function openRejectPanel() {
    setLocalError("");
    setShowApprovePanel(false);
    setShowRejectPanel(true);
  }

  function closeRejectPanel() {
    setShowRejectPanel(false);
    setComment("");
    setRejectSendEmail(false);
    setLocalError("");
  }

  async function handleReject() {
    if (!comment.trim()) {
      setLocalError(t.commentRequired);
      return;
    }
    setLocalError("");
    const ok = await onReject(comment.trim(), rejectSendEmail);
    if (ok) {
      setComment("");
      setShowRejectPanel(false);
      setRejectSendEmail(false);
    }
  }

  return (
    <section className="customContainer mt-4 flex flex-col gap-5">
      {/* Selection summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="customInput flex h-10 w-15 items-center justify-center text-center font-semibold text-logoblue">{selectedCount}</div>
          <div className="text-sm text-textColorThird">
            {t.selected}
            {!hasSelection && <span className="ml-2 hidden sm:inline">— {t.noSelection}</span>}
          </div>
        </div>

        <button type="button" disabled={disabled} onClick={onClear} className="customButtonDefault h-9 text-sm disabled:opacity-50! disabled:cursor-auto!">
          {t.clear}
        </button>
      </div>

      {/* Status-change actions: the reviewer's decision on the order */}
      <div className="border-t border-linePrimary pt-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-textColorThird">{t.decisionGroup}</div>

        <div className="flex flex-wrap items-start gap-3">
          {!showApprovePanel ? (
            <button type="button" disabled={disabled} onClick={openApprovePanel} className="customButtonEnabled h-10 disabled:opacity-50! disabled:cursor-auto!">
              {t.approve}
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-2xl border border-linePrimary bg-black/2 p-3">
              <label className="flex items-center gap-2 text-sm text-textColorThird">
                <input
                  type="checkbox"
                  checked={approveSendEmail}
                  onChange={(e) => setApproveSendEmail(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4"
                />
                {t.alsoSendPaymentEmail}
              </label>
              <div className="flex gap-2">
                <button type="button" disabled={disabled} onClick={handleApprove} className="customButtonEnabled h-9 text-sm disabled:opacity-50! disabled:cursor-auto!">
                  {loading ? t.working : t.confirmApprove}
                </button>
                <button type="button" disabled={loading} onClick={closeApprovePanel} className="customButtonDefault h-9 text-sm disabled:opacity-50! disabled:cursor-auto!">
                  {t.cancel}
                </button>
              </div>
            </div>
          )}

          {!showRejectPanel ? (
            <button
              type="button"
              disabled={disabled}
              onClick={openRejectPanel}
              className="customButtonDefault h-10 border-red-200! text-red-600! hover:bg-red-50! hover:text-red-700! disabled:opacity-50! disabled:cursor-auto!"
            >
              {t.reject}
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50/60 p-3">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.rejectComment}
                rows={2}
                autoFocus
                disabled={loading}
                className="customInput w-64 resize-y border-red-200! py-2"
              />
              <label className="flex items-center gap-2 text-sm text-textColorThird">
                <input
                  type="checkbox"
                  checked={rejectSendEmail}
                  onChange={(e) => setRejectSendEmail(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4"
                />
                {t.alsoSendRejectionEmail}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={handleReject}
                  className="customButtonEnabled h-9 bg-red-600! text-sm disabled:opacity-50! disabled:cursor-auto!"
                >
                  {loading ? t.working : t.confirmReject}
                </button>
                <button type="button" disabled={loading} onClick={closeRejectPanel} className="customButtonDefault h-9 text-sm disabled:opacity-50! disabled:cursor-auto!">
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Communication actions: sending customer-facing emails is a separate, manual step from the status decision above */}
      <div className="border-t border-linePrimary pt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-textColorThird">{t.communicationGroup}</div>
          <div className="text-xs text-textColorThird">{t.communicationHint}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSendEmail("payment_request")}
            className="customButtonDefault h-10 disabled:opacity-50! disabled:cursor-auto!"
          >
            {t.sendPaymentEmail}
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onSendEmail("rejected")}
            className="customButtonDefault h-10 disabled:opacity-50! disabled:cursor-auto!"
          >
            {t.sendRejectionEmail}
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onSendEmail("payment_timeout")}
            className="customButtonDefault h-10 disabled:opacity-50! disabled:cursor-auto!"
          >
            {t.sendReminderEmail}
          </button>
        </div>
      </div>

      {(localError || error) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{localError || error}</div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import { shouldPromptForPartner } from "@/lib/orders/partnerRequirement";
import { WEBSITE_ORDER_STATUS_OPTIONS, normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { buildWebsiteOrderAdminUpdate } from "@/lib/orders/websiteOrderAdminUpdate";
import {
  handlingChange,
  pricedHandlingFields,
  type PricedHandlingFields,
  type WebsiteOrderHandling,
} from "@/lib/orders/websiteOrderHandling";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import { websiteItemsSaveBody, type WebsiteOrderPricingDraft } from "@/lib/orders/websiteOrderCalculator";
import { CUSTOM_DEVIATION_CODE, DEVIATION_FEE_OPTIONS } from "@/lib/booking/pricing/deviationFees";
import WebsiteDatePicker from "@/app/_components/utils/WebsiteDatePicker";
import { TimeWindowField } from "@/app/_components/site/BookingModal/whiteGoods/timeWindowField";
import {
  EMPTY_ATTACHMENT_DRAFT,
  applyAttachmentDraft,
  hasAttachmentChanges,
  type AttachmentDraft,
} from "@/lib/orders/attachmentDraft";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";

type Partner = { id: string; name: string };

type Props = {
  order: {
    id: string;
    displayId: number;
    status: string | null;
    statusNotes: string | null;
    subcontractorMembershipId: string | null;
    subcontractor: string | null;
    handling: WebsiteOrderHandling;
  };
  locale: BookingUiLocale;
  // Called after a successful save so the caller can reload.
  onChanged: () => void;
  // Cards shown between this panel and its Save button (the attachments), so
  // Save is the last thing in the modal's left column.
  children?: ReactNode;
  // Shown left of Save in the same row (the modal's "Delete order").
  besideSave?: ReactNode;
  // The calculator's unsaved changes, stored by this Save too.
  pricingDraft?: WebsiteOrderPricingDraft | null;
  // An empty spot right above Save the calculator renders its price preview into.
  priceChangeSlotRef?: (el: HTMLDivElement | null) => void;
  // Picked/removed attachments (WebsiteOrderAttachments), applied by this Save too.
  attachmentDraft?: AttachmentDraft;
  // After this Save applied them: what's left — only the file changes that
  // failed (empty when all went through), kept for the next Save.
  onAttachmentsApplied?: (remaining: AttachmentDraft) => void;
  // Where the handling fields save (and preview) — a move saves through
  // /api/orders/[orderId]/moving-details instead of website-items.
  handlingEndpoint?: string;
  // Its unsaved express/deviation (null when unchanged), for the calculator's live lines.
  onPricedHandlingChange?: (fields: PricedHandlingFields | null) => void;
};

const CUSTOM_DEVIATION_LABEL = DEVIATION_FEE_OPTIONS.find((o) => o.code === CUSTOM_DEVIATION_CODE)?.englishLabel ?? "Custom";
const PREVIEW_DELAY_MS = 700;

// Everything on a website order only an admin handles, without opening the
// booking editor: status, status notes and partner (PATCH /api/orders/bulk,
// which doesn't re-price), delivery date and time window, driver(s), info for the driver, license plate,
// deviation, description and express delivery (PUT
// /api/orders/[orderId]/website-items with `handling`, which re-prices —
// express and the deviation change the total, previewed
// against what was paid before saving).
export default function WebsiteOrderAdminActions({
  order,
  locale,
  onChanged,
  children,
  besideSave,
  pricingDraft = null,
  priceChangeSlotRef,
  attachmentDraft = EMPTY_ATTACHMENT_DRAFT,
  onAttachmentsApplied,
  handlingEndpoint,
  onPricedHandlingChange,
}: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const initial = {
    status: normalizeOrderStatus(order.status),
    statusNotes: order.statusNotes ?? "",
    subcontractorId: order.subcontractorMembershipId ?? "",
  };
  const [status, setStatus] = useState(initial.status);
  const [statusNotes, setStatusNotes] = useState(initial.statusNotes);
  const [subcontractorId, setSubcontractorId] = useState(initial.subcontractorId);
  const [handling, setHandling] = useState<WebsiteOrderHandling>(order.handling);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<OrderPaymentComparison | null>(null);
  // Why the preview failed (the server's reason), shown in its place.
  const [previewReason, setPreviewReason] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewSeq = useRef(0);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  const change = handlingChange(order.handling, handling);
  const pricedHandling = pricedHandlingFields(order.handling, handling);
  const pricedHandlingKey = JSON.stringify(pricedHandling);
  useEffect(() => {
    onPricedHandlingChange?.(pricedHandling);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricedHandlingKey]);
  const setField = <K extends keyof WebsiteOrderHandling>(key: K, value: WebsiteOrderHandling[K]) =>
    setHandling((current) => ({ ...current, [key]: value }));

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

  async function putHandling(extra: Record<string, unknown> = {}) {
    // Discount, extra and partner minus/plus come from the calculator — only
    // sent when it changed them, otherwise the server keeps what it saved.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rabatt, leggTil, subcontractorMinus, subcontractorPlus, ...panelFields } = handling;
    const res = await fetch(handlingEndpoint ?? `/api/orders/${order.id}/website-items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      // The preview prices exactly what Save would store, calculator changes included.
      body: JSON.stringify(websiteItemsSaveBody(panelFields, pricingDraft, extra)),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok && !!data?.ok, data };
  }

  // Express and the deviation change the price: preview it.
  const previewKey = change.affectsPrice ? JSON.stringify([handling, pricingDraft]) : "";
  useEffect(() => {
    const seq = ++previewSeq.current;
    if (!previewKey) {
      setPreview(null);
      setPreviewing(false);
      return;
    }
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const { ok, data } = await putHandling({ dryRun: true });
        if (seq === previewSeq.current) {
          setPreview(ok ? data.comparison : null);
          setPreviewReason(ok ? null : (data?.reason ?? null));
        }
      } catch {
        if (seq === previewSeq.current) setPreview(null);
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const reasonText: Record<string, string> = {
    NOTES_NEED_STATUS_CHANGE: t(
      "Status notes are saved together with a status change.",
      "Statusnotater lagres sammen med en statusendring.",
    ),
    REJECTION_COMMENT_REQUIRED: t("Rejecting needs a comment.", "Avvisning krever en kommentar."),
    WEBSITE_ORDER_STATUS_NOT_ALLOWED: t("That status isn't used for website orders.", "Den statusen brukes ikke for nettsidebestillinger."),
    FORBIDDEN: t("Only admins can change website orders.", "Kun administratorer kan endre nettsidebestillinger."),
    INVALID_HANDLING: t(
      "Check the date, the deviation and the amounts (in kroner).",
      "Sjekk datoen, avviket og beløpene (i kroner).",
    ),
    PRICES_OUTDATED: t(
      "This order was saved with older prices, so its price can't be changed as it is. Press \"Use new price\" in the calculator first.",
      "Denne bestillingen ble lagret med eldre priser, så prisen kan ikke endres slik den er. Trykk «Bruk ny pris» i kalkulatoren først.",
    ),
    REASON_REQUIRED: t("Write why — the customer is told.", "Skriv hvorfor — det får kunden vite."),
    NOT_DECLINABLE: t(
      "This order is already completed or closed.",
      "Denne bestillingen er allerede fullført eller avsluttet.",
    ),
    REFUND_FAILED: t(
      "Stripe couldn't refund the payment. Nothing was changed on the order — try again, or check Stripe.",
      "Stripe kunne ikke tilbakebetale. Bestillingen er ikke endret — prøv igjen, eller sjekk Stripe.",
    ),
    REFUND_NOT_POSSIBLE: t(
      "A payment on this order can't be refunded automatically. Refund it in Stripe.",
      "En betaling på denne bestillingen kan ikke tilbakebetales automatisk. Gjør det i Stripe.",
    ),
  };

  // Decline: a job we can't or won't do. The server refunds everything paid
  // through Stripe, closes the order (refunded, or cancelled if unpaid) and
  // emails the customer the reason — see app/api/orders/[orderId]/decline.
  async function handleDecline() {
    setMessage(null);
    const reason = declineReason.trim();
    if (!reason) {
      setMessage({ tone: "error", text: reasonText.REASON_REQUIRED });
      return;
    }
    if (
      !confirm(
        t(
          "Decline this order? Everything the customer paid is refunded, the order is closed and the customer gets an email with your reason. This can't be undone.",
          "Avslå denne bestillingen? Alt kunden har betalt blir tilbakebetalt, bestillingen avsluttes og kunden får en e-post med begrunnelsen. Dette kan ikke angres.",
        ),
      )
    ) {
      return;
    }

    try {
      setDeclining(true);
      const res = await fetch(`/api/orders/${order.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const reasonKey = data?.reason as string | undefined;
        setMessage({ tone: "error", text: (reasonKey && reasonText[reasonKey]) || t("Couldn't decline the order.", "Kunne ikke avslå bestillingen.") });
        return;
      }
      const refundedKr = ((data.refundedCents as number) / 100).toLocaleString("nb-NO");
      const done =
        data.status === "refunded"
          ? t(`Declined — ${refundedKr} kr refunded.`, `Avslått — ${refundedKr} kr tilbakebetalt.`)
          : t("Declined — nothing had been paid.", "Avslått — ingenting var betalt.");
      setMessage({
        tone: data.emailFailed ? "error" : "ok",
        text: data.emailFailed
          ? `${done} ${t("The email to the customer failed — contact them.", "E-posten til kunden feilet — ta kontakt med dem.")}`
          : done,
      });
      setDeclineOpen(false);
      onChanged();
    } catch {
      setMessage({ tone: "error", text: t("Couldn't decline the order.", "Kunne ikke avslå bestillingen.") });
    } finally {
      setDeclining(false);
    }
  }
  const canDecline = !["completed", "cancelled", "refunded"].includes(initial.status);

  async function handleSave() {
    setMessage(null);
    const update = buildWebsiteOrderAdminUpdate(order.id, initial, { status, statusNotes, subcontractorId });
    const statusChanged = update.ok;
    if (!update.ok && update.reason !== "NO_CHANGES") {
      setMessage({ tone: "error", text: reasonText[update.reason] });
      return;
    }
    const pricesChanged = !!pricingDraft;
    const filesChanged = hasAttachmentChanges(attachmentDraft);
    if (!statusChanged && !change.changed && !pricesChanged && !filesChanged) {
      setMessage({ tone: "error", text: t("Nothing to save.", "Ingenting å lagre.") });
      return;
    }
    if (
      statusChanged &&
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

    // Setting an overpaid order to confirmed refunds the difference (app/api/orders/bulk).
    let refundNote = "";
    let refundFailed = false;
    try {
      setSaving(true);
      if (change.changed || pricesChanged) {
        const { ok, data } = await putHandling();
        if (!ok) {
          const reason = data?.reason as string | undefined;
          setMessage({ tone: "error", text: (reason && reasonText[reason]) || t("Couldn't save the order.", "Kunne ikke lagre bestillingen.") });
          return;
        }
      }
      if (update.ok) {
        const res = await fetch("/api/orders/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(update.body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          const reason = data?.reason as string | undefined;
          setMessage({ tone: "error", text: (reason && reasonText[reason]) || t("Couldn't save the status.", "Kunne ikke lagre statusen.") });
          if (change.changed || pricesChanged) onChanged();
          return;
        }
        const refunded = Array.isArray(data.refunds) ? (data.refunds as { refundedCents: number }[]) : [];
        refundFailed = Array.isArray(data.refundFailures) && data.refundFailures.length > 0;
        if (refunded.length > 0) {
          const kr = (refunded.reduce((sum, r) => sum + r.refundedCents, 0) / 100).toLocaleString("nb-NO");
          refundNote = t(` ${kr} kr refunded to the customer.`, ` ${kr} kr tilbakebetalt til kunden.`);
        }
        if (refundFailed) {
          refundNote += t(
            " The refund of the overpaid amount failed — use Refund in the payment box.",
            " Tilbakebetalingen av det kunden har betalt for mye feilet — bruk Tilbakebetal i betalingsboksen.",
          );
        }
      }
      // Last, once the order itself saved: the picked files go up, removed ones go.
      if (filesChanged) {
        const files = await applyAttachmentDraft(order.id, attachmentDraft);
        onAttachmentsApplied?.(files.remaining);
        if (!files.ok) {
          setMessage({
            tone: "error",
            text: t(
              `Saved, but ${files.failed} file change(s) didn't go through — press Save to try them again.`,
              `Lagret, men ${files.failed} filendring(er) gikk ikke gjennom — trykk Lagre for å prøve igjen.`,
            ),
          });
          onChanged();
          return;
        }
      }
      setMessage({ tone: refundFailed ? "error" : "ok", text: t("Saved.", "Lagret.") + refundNote });
      onChanged();
    } catch {
      setMessage({ tone: "error", text: t("Couldn't save the order.", "Kunne ikke lagre bestillingen.") });
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-black/85";
  const labelClass = "font-medium text-black/60";
  // The current partner may not be in the list (e.g. no longer a subcontractor).
  const partnerMissingFromList = !!initial.subcontractorId && !partners.some((p) => p.id === initial.subcontractorId);
  const isCustomDeviation = handling.deviation === CUSTOM_DEVIATION_LABEL;
  const siteLocale = locale === "nb" ? "no" : "en";

  return (
    <>
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-semibold text-logoblue">{t("Handle order", "Behandle bestilling")}</h3>

        <div className="mt-4 flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("Description (internal)", "Beskrivelse (intern)")}</span>
            <textarea value={handling.description} onChange={(e) => setField("description", e.target.value)} rows={8} className={fieldClass} />
          </label>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{t("Delivery date", "Leveringsdato")}</span>
              <WebsiteDatePicker
                value={handling.deliveryDate}
                onChange={(value) => setField("deliveryDate", value)}
                locale={siteLocale}
                placeholder={t("Select a date", "Velg en dato")}
                className={fieldClass}
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className={labelClass}>{t("Time window", "Tidsvindu")}</span>
              <TimeWindowField
                locale={siteLocale}
                value={handling.timeWindow}
                onChange={(value) => setField("timeWindow", value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={handling.expressDelivery} onChange={(e) => setField("expressDelivery", e.target.checked)} />
            <span className="font-medium text-black/70">{t("Express delivery", "Ekspresslevering")}</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("Partner", "Partner")}</span>
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

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{t("Driver", "Sjåfør")}</span>
              <input value={handling.driver} onChange={(e) => setField("driver", e.target.value)} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{t("Second driver", "Sjåfør 2")}</span>
              <input value={handling.secondDriver} onChange={(e) => setField("secondDriver", e.target.value)} className={fieldClass} />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("Info for the driver", "Info til sjåføren")}</span>
            <textarea value={handling.driverInfo} onChange={(e) => setField("driverInfo", e.target.value)} rows={3} className={fieldClass} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("License plate", "Registreringsnummer")}</span>
            <input value={handling.licensePlate} onChange={(e) => setField("licensePlate", e.target.value)} className={fieldClass} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("Deviation", "Avvik")}</span>
            <select value={handling.deviation} onChange={(e) => setField("deviation", e.target.value)} className={fieldClass}>
              <option value="">{t("— No deviation —", "— Ingen avvik —")}</option>
              {DEVIATION_FEE_OPTIONS.map((option) => (
                <option key={option.code} value={option.englishLabel}>
                  {locale === "nb" ? option.norwegianLabel : option.englishLabel}
                </option>
              ))}
            </select>
          </label>
          {isCustomDeviation && (
            <div className="flex flex-col gap-2 rounded-lg bg-black/3 p-3">
              <input
                value={handling.customDeviation.description ?? ""}
                onChange={(e) => setField("customDeviation", { ...handling.customDeviation, description: e.target.value || null })}
                placeholder={t("Describe the deviation…", "Beskriv avviket…")}
                className={fieldClass}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>{t("Price (customer)", "Pris (kunde)")}</span>
                  <input
                    type="number"
                    min={0}
                    value={handling.customDeviation.price ?? ""}
                    onChange={(e) =>
                      setField("customDeviation", { ...handling.customDeviation, price: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>{t("Price (partner)", "Pris (partner)")}</span>
                  <input
                    type="number"
                    min={0}
                    value={handling.customDeviation.subcontractorPrice ?? ""}
                    onChange={(e) =>
                      setField("customDeviation", {
                        ...handling.customDeviation,
                        subcontractorPrice: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("Status", "Status")}</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
              {!WEBSITE_ORDER_STATUS_OPTIONS.includes(status as (typeof WEBSITE_ORDER_STATUS_OPTIONS)[number]) && status && (
                <option value={status}>{bookingText(locale, status)}</option>
              )}
              {WEBSITE_ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {bookingText(locale, option)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>
              {status === "rejected"
                ? t("What the customer needs to change (shown to them)", "Hva kunden må endre (vises for kunden)")
                : t("Status notes", "Statusnotater")}
            </span>
            <textarea
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              rows={2}
              className={fieldClass}
              placeholder={t("Saved with a status change", "Lagres sammen med en statusendring")}
            />
          </label>

          {canDecline &&
            (declineOpen ? (
              <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50/60 p-3">
                <p className="font-semibold text-red-700">{t("Decline order", "Avslå bestilling")}</p>
                <p className="text-xs text-black/60">
                  {t(
                    "For a job we can't or won't do. Refunds everything paid and closes the order. To ask the customer for a change instead, use the status \"rejected\".",
                    "For et oppdrag vi ikke kan eller vil ta. Tilbakebetaler alt som er betalt og avslutter bestillingen. Skal kunden heller endre noe, bruk statusen «Avvist».",
                  )}
                </p>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={2}
                  className={fieldClass}
                  placeholder={t("Why (shown to the customer)", "Hvorfor (vises for kunden)")}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={declining}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {declining ? t("Declining…", "Avslår…") : t("Decline and refund", "Avslå og tilbakebetal")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeclineOpen(false)}
                    disabled={declining}
                    className="rounded-full px-4 py-2 text-sm font-medium text-black/60"
                  >
                    {t("Cancel", "Avbryt")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDeclineOpen(true)}
                className="self-start text-sm font-medium text-red-600 underline-offset-2 hover:underline"
              >
                {t("Decline order…", "Avslå bestilling…")}
              </button>
            ))}
        </div>

        {/* Attachments sit in the same card, below a divider. */}
        {children && <div className="mt-6 border-t border-black/10 pt-6">{children}</div>}
      </div>

      <div className="flex flex-col gap-2">
        {change.affectsPrice && (
          <div className="rounded-xl border border-logoblue/20 bg-logoblue/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-logoblue">{t("Price after this change", "Pris etter endringen")}</p>
              {previewing && <span className="text-xs text-black/50">{t("Calculating…", "Beregner…")}</span>}
            </div>
            {preview ? (
              <WebsiteOrderPaymentSummary
                comparison={preview}
                locale={locale}
                totalLabel={t("New total (incl. VAT)", "Ny total (inkl. MVA)")}
              />
            ) : (
              !previewing && <p className="text-xs text-black/50">{(previewReason && reasonText[previewReason]) || reasonText.INVALID_HANDLING}</p>
            )}
          </div>
        )}
        <div ref={priceChangeSlotRef} className="empty:hidden" />
        <div className="flex items-center gap-3">
          {besideSave}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-logoblue px-5 text-base font-semibold text-white disabled:opacity-50"
          >
            {saving ? t("Saving…", "Lagrer…") : t("Save", "Lagre")}
          </button>
        </div>
        {message && (
          <p className={`text-center text-sm font-medium ${message.tone === "ok" ? "text-green-700" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </div>
    </>
  );
}

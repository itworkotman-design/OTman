"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";
import { shouldPromptForPartner } from "@/lib/orders/partnerRequirement";
import { ORDER_STATUS_OPTIONS, normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import { buildWebsiteOrderAdminUpdate } from "@/lib/orders/websiteOrderAdminUpdate";
import { handlingChange, type WebsiteOrderHandling } from "@/lib/orders/websiteOrderHandling";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import { websiteItemsSaveBody, type WebsiteOrderPricingDraft } from "@/lib/orders/websiteOrderCalculator";
import { CUSTOM_DEVIATION_CODE, DEVIATION_FEE_OPTIONS } from "@/lib/booking/pricing/deviationFees";
import DatePicker from "@/app/_components/utils/DatePicker";
import { TimeWindowField } from "@/app/_components/site/BookingModal/whiteGoods/timeWindowField";
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
export default function WebsiteOrderAdminActions({ order, locale, onChanged, children, besideSave, pricingDraft = null }: Props) {
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
  const [previewing, setPreviewing] = useState(false);
  const previewSeq = useRef(0);

  const change = handlingChange(order.handling, handling);
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
    const res = await fetch(`/api/orders/${order.id}/website-items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(websiteItemsSaveBody(panelFields, extra.dryRun ? null : pricingDraft, extra)),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok && !!data?.ok, data };
  }

  // Express and the deviation change the price: preview it.
  const previewKey = change.affectsPrice ? JSON.stringify(handling) : "";
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
        if (seq === previewSeq.current) setPreview(ok ? data.comparison : null);
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
    FORBIDDEN: t("Only admins can change website orders.", "Kun administratorer kan endre nettsidebestillinger."),
    INVALID_HANDLING: t(
      "Check the date, the deviation and the amounts (in kroner).",
      "Sjekk datoen, avviket og beløpene (i kroner).",
    ),
  };

  async function handleSave() {
    setMessage(null);
    const update = buildWebsiteOrderAdminUpdate(order.id, initial, { status, statusNotes, subcontractorId });
    const statusChanged = update.ok;
    if (!update.ok && update.reason !== "NO_CHANGES") {
      setMessage({ tone: "error", text: reasonText[update.reason] });
      return;
    }
    const pricesChanged = !!pricingDraft;
    if (!statusChanged && !change.changed && !pricesChanged) {
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
      }
      setMessage({ tone: "ok", text: t("Saved.", "Lagret.") });
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
            <span className={labelClass}>{t("Status", "Status")}</span>
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
            <span className={labelClass}>{t("Status notes", "Statusnotater")}</span>
            <textarea
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              rows={2}
              className={fieldClass}
              placeholder={t("Saved with a status change", "Lagres sammen med en statusendring")}
            />
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
              <span className={labelClass}>{t("Delivery date", "Leveringsdato")}</span>
              <DatePicker
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
            <span className={labelClass}>{t("Description (internal)", "Beskrivelse (intern)")}</span>
            <textarea value={handling.description} onChange={(e) => setField("description", e.target.value)} rows={4} className={fieldClass} />
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

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={handling.expressDelivery} onChange={(e) => setField("expressDelivery", e.target.checked)} />
            <span className="font-medium text-black/70">{t("Express delivery", "Ekspresslevering")}</span>
          </label>

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
                !previewing && <p className="text-xs text-black/50">{reasonText.INVALID_HANDLING}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {children}

      <div className="flex flex-col gap-2">
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

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import { PropertyDetailsSection, PropertyWhereSection } from "@/app/_components/site/BookingModal/moving/PropertySection";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";
import { movingEditBody, type MovingEditDraft } from "./movingEditBody";

type Props = {
  orderId: string;
  locale: BookingUiLocale;
  // The move and the customer as loaded (GET website-details).
  initial: MovingEditDraft;
  onSaved: (message: string) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  // Shown left of Save in the same row (the modal's "Delete order").
  besideSave?: ReactNode;
};

const PREVIEW_DELAY_MS = 800;
const noop = () => {};

function formatKr(n: number) {
  return `${n.toLocaleString("nb-NO")} kr`;
}

// The admin's "Edit order" tab for a homepage move (WebsiteOrderModal): both
// ends of the move with the booking flow's own sections (PropertySection —
// address, type, size, floors, lift, parking), the additional services and
// the customer's contact details. Every change is priced by the server
// (PUT /api/orders/[orderId]/moving-details, dryRun) against what was paid,
// and saved at that price. Date, time window, drivers etc. stay in the
// Overview's "Handle order" panel, like on a delivery order.
export default function MovingOrderEditTab({ orderId, locale, initial, onSaved, onCancel, onDirtyChange, besideSave }: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const siteLocale = locale === "nb" ? "no" : "en";
  const [draft, setDraft] = useState<MovingEditDraft>(initial);
  // An address counts as picked until it's typed in (as the booking flow).
  const [selected, setSelected] = useState({ pickup: true, delivery: true });
  const [catalog, setCatalog] = useState<{ options: MovingCatalogOption[]; services: MovingCatalogOption[] } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ priceExVat: number; previousPriceExVat: number; comparison: OrderPaymentComparison } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewSeq = useRef(0);

  const body = movingEditBody(initial, draft);
  const bodyKey = JSON.stringify(body);
  const dirty = bodyKey !== "{}";

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site/moving-request/catalog", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) setCatalog({ options: data.options ?? [], services: data.services ?? [] });
        else setCatalogError(t("Could not load the moving prices.", "Kunne ikke laste flytteprisene."));
      })
      .catch(() => !cancelled && setCatalogError(t("Could not load the moving prices.", "Kunne ikke laste flytteprisene.")));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function put(extra: Record<string, unknown>) {
    const res = await fetch(`/api/orders/${orderId}/moving-details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...body, ...extra }),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok && !!json?.ok, json };
  }

  const reasonText = (reason: unknown) =>
    reason === "INVALID_DETAILS"
      ? t("Check the addresses and both ends of the move.", "Sjekk adressene og begge ender av flyttingen.")
      : reason === "NOT_EDITABLE_STATUS"
        ? t("This order can't be changed any more.", "Denne bestillingen kan ikke endres lenger.")
        : t("Couldn't save the order.", "Kunne ikke lagre bestillingen.");

  // The price of the edits, from the server (debounced).
  useEffect(() => {
    const seq = ++previewSeq.current;
    if (!dirty) {
      setPreview(null);
      setError("");
      return;
    }
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const { ok, json } = await put({ dryRun: true });
        if (seq !== previewSeq.current) return;
        setPreview(ok ? json : null);
        setError(ok ? "" : reasonText(json?.reason));
      } catch {
        if (seq === previewSeq.current) setPreview(null);
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyKey]);

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setError("");
    try {
      const { ok, json } = await put({});
      if (!ok) {
        setError(reasonText(json?.reason));
        return;
      }
      onSaved(
        json.priceExVat !== json.previousPriceExVat
          ? t(`Order saved. New total: ${formatKr(json.priceExVat)} ex. VAT.`, `Bestillingen er lagret. Ny total: ${formatKr(json.priceExVat)} eks. mva.`)
          : t("Order saved.", "Bestillingen er lagret."),
      );
    } catch {
      setError(t("Couldn't save the order.", "Kunne ikke lagre bestillingen."));
    } finally {
      setSaving(false);
    }
  }

  const setEdit = (patch: Partial<MovingEditDraft["edit"]>) => setDraft((d) => ({ ...d, edit: { ...d.edit, ...patch } }));
  const setCustomer = (patch: Partial<MovingEditDraft["customer"]>) => setDraft((d) => ({ ...d, customer: { ...d.customer, ...patch } }));
  const toggleService = (code: string) =>
    setEdit({
      serviceCodes: draft.edit.serviceCodes.includes(code)
        ? draft.edit.serviceCodes.filter((c) => c !== code)
        : [...draft.edit.serviceCodes, code],
    });

  const sectionClass = "customContainer flex flex-col gap-4";
  const fieldClass = "customInput w-full";
  const labelClass = "mb-1 block text-xs font-medium text-textColorThird";
  const ends = [
    {
      key: "pickup" as const,
      title: t("Moving from", "Flytter fra"),
      address: draft.edit.pickupAddress,
      property: draft.edit.origin,
      onAddress: (address: string, picked: boolean) => {
        setEdit({ pickupAddress: address });
        setSelected((s) => ({ ...s, pickup: picked }));
      },
      onProperty: (origin: MovingEditDraft["edit"]["origin"]) => setEdit({ origin }),
    },
    {
      key: "delivery" as const,
      title: t("Moving to", "Flytter til"),
      address: draft.edit.deliveryAddress,
      property: draft.edit.destination,
      onAddress: (address: string, picked: boolean) => {
        setEdit({ deliveryAddress: address });
        setSelected((s) => ({ ...s, delivery: picked }));
      },
      onProperty: (destination: MovingEditDraft["edit"]["destination"]) => setEdit({ destination }),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4">
        {ends.map((end) => (
          <section key={end.key} className={sectionClass}>
            <h3 className="text-lg font-semibold text-logoblue">{end.title}</h3>
            <PropertyWhereSection
              locale={siteLocale}
              address={end.address}
              addressSelected={selected[end.key]}
              onAddressChange={end.onAddress}
              addressPlaceholder={end.title}
              value={end.property}
              onChange={end.onProperty}
              onReady={noop}
              onRetract={noop}
            />
            <PropertyDetailsSection
              locale={siteLocale}
              address={end.address}
              addressSelected={selected[end.key]}
              value={end.property}
              onChange={end.onProperty}
              sizeOptions={catalog?.options ?? []}
              catalogLoading={!catalog && !catalogError}
              catalogError={catalogError}
              onReady={noop}
              onRetract={noop}
            />
          </section>
        ))}

        <section className={sectionClass}>
          <h3 className="text-lg font-semibold text-logoblue">{t("Additional services", "Tilleggstjenester")}</h3>
          {(catalog?.services ?? []).length === 0 ? (
            <p className="text-sm text-black/50">{t("No additional services.", "Ingen tilleggstjenester.")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {catalog!.services.map((service) => {
                const active = draft.edit.serviceCodes.includes(service.code);
                return (
                  <button
                    key={service.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleService(service.code)}
                    className={`flex h-11 items-center justify-between gap-2 rounded-xl border px-4 text-sm font-medium transition-colors ${
                      active ? "border-logoblue bg-logoblue/10 text-logoblue" : "border-neutral-200 text-black/60 hover:border-logoblue/50"
                    }`}
                  >
                    <span>{locale === "nb" ? service.labelNo : service.labelEn}</span>
                    <span className="tabular-nums text-xs">{formatKr(Math.round(service.customerPriceCents / 100))}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className={sectionClass}>
          <h3 className="text-lg font-semibold text-logoblue">{t("Customer", "Kunde")}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["name", t("Name", "Navn")],
                ["phone", t("Phone", "Telefon")],
                ["email", t("Email", "E-post")],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className={labelClass}>{label}</span>
                <input className={fieldClass} value={draft.customer[key]} onChange={(e) => setCustomer({ [key]: e.target.value })} />
              </label>
            ))}
          </div>
          <label className="block">
            <span className={labelClass}>{t("Customer comments", "Kundens kommentar")}</span>
            <textarea
              rows={3}
              className={`${fieldClass} resize-none`}
              value={draft.customer.comments}
              onChange={(e) => setCustomer({ comments: e.target.value })}
            />
          </label>
        </section>

        <div className="flex flex-col gap-2">
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {besideSave}
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-black/15 px-5 text-base font-semibold text-black/70 hover:bg-black/5 disabled:opacity-50"
            >
              {t("Cancel", "Avbryt")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving || previewing || !!error}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-logoblue px-5 text-base font-semibold text-white disabled:opacity-50"
            >
              {saving ? t("Saving…", "Lagrer…") : t("Save changes", "Lagre endringer")}
            </button>
          </div>
        </div>
      </div>

      {/* The price of the edits against what was paid, as on a delivery order. */}
      <div className="flex flex-col gap-4 lg:self-start">
        <section className={sectionClass}>
          <h3 className="text-lg font-semibold text-logoblue">{t("Price", "Pris")}</h3>
          {!dirty ? (
            <p className="text-sm text-black/50">{t("Make your changes on the left.", "Gjør endringene til venstre.")}</p>
          ) : previewing ? (
            <p className="text-sm text-black/50">{t("Calculating…", "Beregner…")}</p>
          ) : preview ? (
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-black/60">{t("Before (ex. VAT)", "Før (eks. mva)")}</span>
                <span className="tabular-nums">{formatKr(preview.previousPriceExVat)}</span>
              </div>
              <div className="flex justify-between font-semibold text-logoblue">
                <span>{t("New total (ex. VAT)", "Ny total (eks. mva)")}</span>
                <span className="tabular-nums">{formatKr(preview.priceExVat)}</span>
              </div>
            </div>
          ) : null}
        </section>
        {preview && (
          <section className={sectionClass}>
            <h3 className="text-lg font-semibold text-logoblue">{t("Payment", "Betaling")}</h3>
            <WebsiteOrderPaymentSummary comparison={preview.comparison} locale={locale} totalLabel={t("New total (incl. VAT)", "Ny total (inkl. MVA)")} />
          </section>
        )}
      </div>
    </div>
  );
}

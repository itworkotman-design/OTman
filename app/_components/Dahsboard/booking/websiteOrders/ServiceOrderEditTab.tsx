"use client";

import { calculatorDraftBody } from "@/lib/orders/websiteOrderCalculator";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import type { ServiceEditItem } from "@/lib/orders/serviceOrderEdit";
import { SERVICE_REQUEST_CUSTOM_CODE, SERVICE_REQUEST_OPTIONS, serviceRequestLabel } from "@/lib/content/serviceRequestCatalog";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { BuildingIcon, HomeIcon, PinIcon, SearchIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import { ServiceIcon } from "@/app/_components/site/BookingModal/services/serviceIcons";
import { CardHeading, ChoiceButton, TimeWindowChoice } from "./EditTabParts";
import type { WebsiteOrderCalculatorView, WebsiteOrderPricingDraft } from "@/lib/orders/websiteOrderCalculator";
import WebsiteOrderCalculator from "./WebsiteOrderCalculator";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";
import { serviceEditBlockers, serviceEditBody, type ServiceEditBlocker, type ServiceEditDraft } from "./serviceEditBody";
import type { AdjustmentLine } from "@/lib/booking/pricing/adjustmentLines";

type Props = {
  orderId: string;
  locale: BookingUiLocale;
  // The request and the customer as loaded (GET website-details).
  initial: ServiceEditDraft;
  // The Overview's calculator as stored (website-details), its discount/extra
  // and partner minus/plus, and the stored total.
  calculator: WebsiteOrderCalculatorView;
  adjustments: WebsiteOrderPricingDraft["adjustments"];
  adjustmentLines?: AdjustmentLine[];
  storedTotal: number;
  onSaved: (message: string) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  // Shown left of Save in the same row (the modal's "Delete order").
  besideSave?: ReactNode;
};

const PREVIEW_DELAY_MS = 800;

function formatKr(n: number) {
  return `${n.toLocaleString("nb-NO")} kr`;
}

// The admin's "Edit order" tab for a homepage service request
// (WebsiteOrderModal), in the same dashboard style as the moving and delivery
// Edit tabs (EditTabParts): the services (the services modal's tiles, any
// number), each in its own card with a custom one's name, what needs doing
// and staff's quote (customer and partner price ex. VAT — its own priced
// line), then the address, the date and time window, and the customer,
// beside the Overview's calculator. Every change is
// priced by the server (PUT /api/orders/[orderId]/service-details, dryRun)
// against what was paid, and saved at that price. Drivers, express and the
// deviation stay in the Overview's "Handle order" panel.
export default function ServiceOrderEditTab({
  orderId,
  locale,
  initial,
  calculator,
  adjustments,
  adjustmentLines,
  storedTotal,
  onSaved,
  onCancel,
  onDirtyChange,
  besideSave,
}: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const siteLocale = locale === "nb" ? "no" : "en";
  const [draft, setDraft] = useState<ServiceEditDraft>(initial);
  const [preview, setPreview] = useState<{
    priceExVat: number;
    previousPriceExVat: number;
    comparison: OrderPaymentComparison;
    calculator: WebsiteOrderCalculatorView;
  } | null>(null);
  // The calculator's unsaved discount/extra and partner minus/plus — priced
  // and saved together with the edits on the left.
  const [pricingDraft, setPricingDraft] = useState<WebsiteOrderPricingDraft | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewSeq = useRef(0);

  const body = {
    ...serviceEditBody(initial, draft),
    ...calculatorDraftBody(pricingDraft),
  };
  const bodyKey = JSON.stringify(body);
  const dirty = bodyKey !== "{}";

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  async function put(extra: Record<string, unknown>) {
    const res = await fetch(`/api/orders/${orderId}/service-details`, {
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
      ? t("Check the services, the address and the prices.", "Sjekk tjenestene, adressen og prisene.")
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

  const setEdit = (patch: Partial<ServiceEditDraft["edit"]>) => setDraft((d) => ({ ...d, edit: { ...d.edit, ...patch } }));
  const setService = (index: number, patch: Partial<ServiceEditItem>) =>
    setDraft((d) => ({ ...d, edit: { ...d.edit, services: d.edit.services.map((s, i) => (i === index ? { ...s, ...patch } : s)) } }));
  // A tile adds its service (unpriced, nothing described yet) or removes it.
  const toggleService = (serviceCode: string) =>
    setDraft((d) => ({
      ...d,
      edit: {
        ...d.edit,
        services: d.edit.services.some((s) => s.serviceCode === serviceCode)
          ? d.edit.services.filter((s) => s.serviceCode !== serviceCode)
          : [...d.edit.services, { serviceCode, customService: "", jobDescription: "", quote: { customer: null, partner: null } }],
      },
    }));
  const setCustomer = (patch: Partial<ServiceEditDraft["customer"]>) => setDraft((d) => ({ ...d, customer: { ...d.customer, ...patch } }));
  const setSchedule = (patch: Partial<ServiceEditDraft["schedule"]>) => setDraft((d) => ({ ...d, schedule: { ...d.schedule, ...patch } }));
  // An emptied price field is "no price yet".
  const priceValue = (raw: string) => (raw === "" ? null : Number(raw));

  const blockers = serviceEditBlockers(draft);
  const blocked = (field: ServiceEditBlocker) => blockers.includes(field);

  const sectionClass = "customContainer flex flex-col gap-4";
  const fieldClass = "customInput w-full";
  const labelClass = "mb-1 block text-xs font-medium text-textColorThird";
  const errorClass = "mt-1 text-xs font-medium text-red-600";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4">
        {/* The services — the same tiles the customer picked from, then one
            card per service: what needs doing and staff's quote for it (its
            own line; the calculator's discount/extra and partner minus/plus
            come on top). */}
        <section className={sectionClass}>
          <div>
            <h3 className="text-lg font-semibold text-logoblue">{t("Services", "Tjenester")}</h3>
            <p className="text-xs text-black/45">{t("Prices ex. VAT", "Priser eks. mva")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SERVICE_REQUEST_OPTIONS.map((option) => (
              <ChoiceButton
                key={option.code}
                wide
                selected={draft.edit.services.some((s) => s.serviceCode === option.code)}
                onClick={() => toggleService(option.code)}
              >
                <ServiceIcon iconKey={option.iconKey} className="h-4 w-4" />
                {locale === "nb" ? option.labelNo : option.labelEn}
              </ChoiceButton>
            ))}
          </div>
          {blocked("services") && <p className={errorClass}>{t("Choose at least one service.", "Velg minst én tjeneste.")}</p>}

          {draft.edit.services.map((service, index) => {
            const option = SERVICE_REQUEST_OPTIONS.find((o) => o.code === service.serviceCode);
            return (
              <div key={service.serviceCode} className="rounded-xl border border-neutral-200 p-4">
                <CardHeading
                  icon={<ServiceIcon iconKey={option?.iconKey ?? "custom"} />}
                  title={serviceRequestLabel(service.serviceCode, service.customService, siteLocale) ?? t("Service", "Tjeneste")}
                  summary={service.jobDescription}
                  action={
                    <button
                      type="button"
                      onClick={() => toggleService(service.serviceCode)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      {t("Remove", "Fjern")}
                    </button>
                  }
                />

                {service.serviceCode === SERVICE_REQUEST_CUSTOM_CODE && (
                  <label className="mb-3 block">
                    <span className={labelClass}>{t("Which service", "Hvilken tjeneste")}</span>
                    <input
                      autoComplete="off"
                      maxLength={200}
                      className={fieldClass}
                      value={service.customService}
                      onChange={(e) => setService(index, { customService: e.target.value })}
                    />
                    {blocked(`services.${index}.customService`) && <p className={errorClass}>{t("Name the service.", "Skriv hvilken tjeneste.")}</p>}
                  </label>
                )}

                <label className="mb-3 block">
                  <span className={labelClass}>{t("What needs doing", "Hva skal gjøres")}</span>
                  <textarea
                    rows={3}
                    className={`${fieldClass} resize-none`}
                    value={service.jobDescription}
                    onChange={(e) => setService(index, { jobDescription: e.target.value })}
                  />
                  {blocked(`services.${index}.jobDescription`) && <p className={errorClass}>{t("Describe the job.", "Beskriv jobben.")}</p>}
                </label>

                <div className="grid grid-cols-1 gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>{t("Customer price", "Kundepris")}</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      className={fieldClass}
                      value={service.quote.customer ?? ""}
                      onChange={(e) => setService(index, { quote: { ...service.quote, customer: priceValue(e.target.value) } })}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>{t("Partner price", "Partnerpris")}</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      className={fieldClass}
                      value={service.quote.partner ?? ""}
                      onChange={(e) => setService(index, { quote: { ...service.quote, partner: priceValue(e.target.value) } })}
                    />
                  </label>
                  {blocked(`services.${index}.quote`) && (
                    <p className={`${errorClass} sm:col-span-2`}>{t("Prices can't be negative.", "Prisene kan ikke være negative.")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <section className={sectionClass}>
          <h3 className="text-lg font-semibold text-logoblue">{t("Where", "Hvor")}</h3>
          <div className="rounded-xl border border-neutral-200 p-4">
            <CardHeading icon={<PinIcon />} title={t("Address", "Adresse")} summary={draft.edit.address} />
            <AddressAutocompleteInput
              value={draft.edit.address}
              onChange={(address) => setEdit({ address })}
              placeholder={t("Enter a location", "Skriv inn et sted")}
              locale={locale}
              icon={<SearchIcon />}
            />
            {blocked("address") && <p className={errorClass}>{t("Add an address.", "Legg til en adresse.")}</p>}
          </div>
        </section>

        <section className={sectionClass}>
          <h3 className="text-lg font-semibold text-logoblue">{t("Date and time", "Dato og tid")}</h3>
          <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
            <label>
              <span className={labelClass}>{t("Date", "Dato")}</span>
              <input type="date" className={fieldClass} value={draft.schedule.preferredDate} onChange={(e) => setSchedule({ preferredDate: e.target.value })} />
            </label>
            <TimeWindowChoice
              value={draft.schedule.timeWindow}
              onChange={(timeWindow) => setSchedule({ timeWindow })}
              t={t}
              labelClass={labelClass}
              fieldClass={fieldClass}
            />
            {blocked("timeWindow") && (
              <p className={errorClass}>{t("Choose a start and end time, with the end after the start.", "Velg start- og sluttid, der slutten er etter starten.")}</p>
            )}
          </div>
        </section>

        {/* Customer — the same card as the moving and delivery Edit tabs'. */}
        <section className={sectionClass}>
          <h3 className="text-lg font-semibold text-logoblue">{t("Customer", "Kunde")}</h3>
          <div className="rounded-xl border border-neutral-200 p-4">
            <CardHeading
              icon={draft.customerType === "business" ? <BuildingIcon /> : <HomeIcon />}
              title={draft.customer.name || t("Customer", "Kunde")}
              summary={[draft.customer.phone, draft.customer.email].filter(Boolean).join(" · ")}
            />

            <div className="mb-3">
              <span className={labelClass}>{t("Customer type", "Kundetype")}</span>
              <div className="grid grid-cols-2 gap-2">
                {(["private", "business"] as const).map((type) => (
                  <ChoiceButton key={type} wide selected={draft.customerType === type} onClick={() => setDraft((d) => ({ ...d, customerType: type }))}>
                    {type === "private" ? <HomeIcon /> : <BuildingIcon />}
                    {type === "private" ? t("Private", "Privat") : t("Business", "Bedrift")}
                  </ChoiceButton>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelClass}>{t("Name", "Navn")}</span>
                <input autoComplete="off" className={fieldClass} value={draft.customer.name} onChange={(e) => setCustomer({ name: e.target.value })} />
              </label>
              <label>
                <span className={labelClass}>{t("Phone", "Telefon")}</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  className={fieldClass}
                  value={draft.customer.phone}
                  onChange={(e) => setCustomer({ phone: e.target.value })}
                />
              </label>
              <label>
                <span className={labelClass}>{t("Email", "E-post")}</span>
                <input type="email" autoComplete="off" className={fieldClass} value={draft.customer.email} onChange={(e) => setCustomer({ email: e.target.value })} />
              </label>
            </div>

            <label className="mt-4 block border-t border-neutral-200 pt-4">
              <span className={labelClass}>{t("Customer comments", "Kundens kommentar")}</span>
              <textarea rows={3} className={`${fieldClass} resize-none`} value={draft.customer.comments} onChange={(e) => setCustomer({ comments: e.target.value })} />
            </label>
          </div>
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
              disabled={!dirty || saving || previewing || !!error || blockers.length > 0}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-logoblue px-5 text-base font-semibold text-white disabled:opacity-50"
            >
              {saving ? t("Saving…", "Lagrer…") : t("Save changes", "Lagre endringer")}
            </button>
          </div>
        </div>
      </div>

      {/* The Overview's calculator, priced together with the edits on the left
          and saved with them; then the price against what was paid — as on a
          move (MovingOrderEditTab). No catalog, so no "Use new price". */}
      <div className="flex flex-col gap-4 lg:self-start">
        <WebsiteOrderCalculator
          orderId={orderId}
          calculator={calculator}
          adjustments={adjustments}
          adjustmentLines={adjustmentLines}
          missingFromLines={0}
          storedTotal={storedTotal}
          currentPricesTotal={null}
          priceChanges={[]}
          locale={locale}
          onDraftChange={setPricingDraft}
          externalPricing={{
            view: preview?.calculator ?? null,
            previewing,
            useNewPrice: false,
            onUseNewPrice: () => {},
          }}
        />
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

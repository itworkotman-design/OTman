"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PriceChangeRow } from "@/lib/booking/pricing/priceChanges";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import type { OrderPaymentComparison } from "@/lib/orders/paidOrderSnapshot";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { BuildingIcon, HomeIcon, SearchIcon, TruckIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import {
  MOVING_HOME_TYPES,
  MOVING_MAX_FLOORS,
  MOVING_PARKING_OPTIONS,
  movingLiftApplies,
  movingLiftRequired,
  type MovingPropertyDraft,
} from "@/lib/orders/movingProperty";
import { CardHeading, ChoiceButton, TimeWindowChoice } from "./EditTabParts";
import type { WebsiteOrderCalculatorView, WebsiteOrderPricingDraft } from "@/lib/orders/websiteOrderCalculator";
import WebsiteOrderCalculator from "./WebsiteOrderCalculator";
import WebsiteOrderPaymentSummary from "./WebsiteOrderPaymentSummary";
import { movingEditBlockers, movingEditBody, type MovingEditBlocker, type MovingEditDraft } from "./movingEditBody";

type Props = {
  orderId: string;
  locale: BookingUiLocale;
  // The move and the customer as loaded (GET website-details).
  initial: MovingEditDraft;
  // The Overview's calculator as stored (website-details), its discount/extra
  // and partner minus/plus, and the stored total.
  calculator: WebsiteOrderCalculatorView;
  adjustments: WebsiteOrderPricingDraft["adjustments"];
  storedTotal: number;
  // The move's answers at today's prices (website-details): "Use new price" when
  // priceChanges lists any. An edit re-prices at today's catalog, so it needs
  // that chosen first — as on a delivery order.
  currentPricesTotal?: number | null;
  priceChanges?: PriceChangeRow[];
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

// The admin's "Edit order" tab for a homepage move (WebsiteOrderModal), in the
// same dashboard style as the delivery Edit tab (EditTabParts): both
// ends of the move as cards (type, address, size, floors, floor + lift,
// parking — the booking flow's rules, movingEditBlockers), the additional
// services, the date and time window, and the customer (type, contact
// details), beside the Overview's calculator. Every change is priced by the
// server (PUT /api/orders/[orderId]/moving-details, dryRun) against what was
// paid, and saved at that price. Drivers etc. stay in the Overview's "Handle
// order" panel, like on a delivery order.
export default function MovingOrderEditTab({
  orderId,
  locale,
  initial,
  calculator,
  adjustments,
  storedTotal,
  currentPricesTotal = null,
  priceChanges = [],
  onSaved,
  onCancel,
  onDirtyChange,
  besideSave,
}: Props) {
  const t = (en: string, no: string) => (locale === "nb" ? no : en);
  const [draft, setDraft] = useState<MovingEditDraft>(initial);
  const [catalog, setCatalog] = useState<{ options: MovingCatalogOption[]; services: MovingCatalogOption[] } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    priceExVat: number;
    previousPriceExVat: number;
    comparison: OrderPaymentComparison;
    calculator: WebsiteOrderCalculatorView;
  } | null>(null);
  // The calculator's unsaved discount/extra and partner minus/plus — priced
  // and saved together with the edits on the left.
  const [pricingDraft, setPricingDraft] = useState<WebsiteOrderPricingDraft | null>(null);
  // "Use new price" chosen: the save re-prices the move at today's catalog.
  const [useNewPrices, setUseNewPrices] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewSeq = useRef(0);

  const body = {
    ...movingEditBody(initial, draft),
    ...(pricingDraft ? { handling: pricingDraft.adjustments, nulledLines: pricingDraft.nulledLines } : {}),
    ...(useNewPrices ? { useCurrentPrices: true } : {}),
  };
  const bodyKey = JSON.stringify(body);
  const dirty = bodyKey !== "{}";
  const pricesOutdated = priceChanges.length > 0 && !useNewPrices;
  // Changing the move itself on outdated prices waits for "Use new price".
  const blockedByPrices = pricesOutdated && "edit" in body;

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
      : reason === "PRICES_OUTDATED"
        ? t(
            "This move was saved with older prices. Press \"Use new price\" in the calculator to change it.",
            "Denne flyttingen ble lagret med eldre priser. Trykk «Bruk ny pris» i kalkulatoren for å endre den.",
          )
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
  const setSchedule = (patch: Partial<MovingEditDraft["schedule"]>) => setDraft((d) => ({ ...d, schedule: { ...d.schedule, ...patch } }));
  const toggleService = (code: string) =>
    setEdit({
      serviceCodes: draft.edit.serviceCodes.includes(code)
        ? draft.edit.serviceCodes.filter((c) => c !== code)
        : [...draft.edit.serviceCodes, code],
    });

  const blockers = movingEditBlockers(draft);
  const blocked = (end: MovingEditBlocker["end"], field: MovingEditBlocker["field"]) =>
    blockers.some((b) => b.end === end && b.field === field);
  const label = (option: { labelEn: string; labelNo: string }) => (locale === "nb" ? option.labelNo : option.labelEn);

  const sectionClass = "customContainer flex flex-col gap-4";
  const fieldClass = "customInput w-full";
  const labelClass = "mb-1 block text-xs font-medium text-textColorThird";
  const errorClass = "mt-1 text-xs font-medium text-red-600";
  const ends = [
    {
      key: "origin" as const,
      title: t("Moving from", "Flytter fra"),
      address: draft.edit.pickupAddress,
      property: draft.edit.origin,
      onAddress: (pickupAddress: string) => setEdit({ pickupAddress }),
      onProperty: (patch: Partial<MovingPropertyDraft>) => setEdit({ origin: { ...draft.edit.origin, ...patch } }),
    },
    {
      key: "destination" as const,
      title: t("Moving to", "Flytter til"),
      address: draft.edit.deliveryAddress,
      property: draft.edit.destination,
      onAddress: (deliveryAddress: string) => setEdit({ deliveryAddress }),
      onProperty: (patch: Partial<MovingPropertyDraft>) => setEdit({ destination: { ...draft.edit.destination, ...patch } }),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4">
        {/* Both ends — same card style as the delivery Edit tab's pickup and delivery. */}
        {ends.map((end) => {
          const property = end.property;
          const sizeLabel = catalog?.options.find((o) => o.code === property.sizeOptionCode);
          const homeType = MOVING_HOME_TYPES.find((h) => h.code === property.homeType);
          return (
            <section key={end.key} className={sectionClass}>
              <h3 className="text-lg font-semibold text-logoblue">{end.title}</h3>
              <div className="rounded-xl border border-neutral-200 p-4">
                <CardHeading
                  icon={end.key === "origin" ? <HomeIcon /> : <TruckIcon />}
                  title={end.title}
                  summary={[end.address, homeType && label(homeType), sizeLabel && label(sizeLabel)].filter(Boolean).join(" · ")}
                />

                <div className="mb-3">
                  <span className={labelClass}>{t("Type", "Type")}</span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {MOVING_HOME_TYPES.map((type) => (
                      <ChoiceButton key={type.code} wide selected={property.homeType === type.code} onClick={() => end.onProperty({ homeType: type.code })}>
                        {type.code === "OFFICE" || type.code === "APARTMENT" ? <BuildingIcon /> : <HomeIcon />}
                        {label(type)}
                      </ChoiceButton>
                    ))}
                  </div>
                  {blocked(end.key, "homeType") && <p className={errorClass}>{t("Choose a type.", "Velg en type.")}</p>}
                </div>

                <div className="mb-3">
                  <span className={labelClass}>{t("Address", "Adresse")}</span>
                  <AddressAutocompleteInput
                    value={end.address}
                    onChange={end.onAddress}
                    placeholder={t("Enter a location", "Skriv inn et sted")}
                    locale={locale}
                    icon={<SearchIcon />}
                  />
                  {blocked(end.key, "address") && <p className={errorClass}>{t("Add an address.", "Legg til en adresse.")}</p>}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>{t("Size", "Størrelse")}</span>
                    <select
                      className={fieldClass}
                      value={property.sizeOptionCode ?? ""}
                      onChange={(e) => end.onProperty({ sizeOptionCode: e.target.value || null })}
                    >
                      <option value="">{catalog ? t("Choose a size", "Velg størrelse") : t("Loading sizes…", "Laster størrelser…")}</option>
                      {(catalog?.options ?? []).map((option) => (
                        <option key={option.code} value={option.code}>
                          {label(option)}
                        </option>
                      ))}
                    </select>
                    {catalogError && <p className={errorClass}>{catalogError}</p>}
                    {blocked(end.key, "sizeOptionCode") && <p className={errorClass}>{t("Choose a size.", "Velg en størrelse.")}</p>}
                  </label>
                  <label>
                    <span className={labelClass}>{t("Floors in the home", "Etasjer i boligen")}</span>
                    <select
                      className={fieldClass}
                      value={property.floors}
                      onChange={(e) => end.onProperty({ floors: Number(e.target.value) })}
                    >
                      {Array.from({ length: MOVING_MAX_FLOORS }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  {/* Apartments and offices: which floor, then the lift — asked
                      unless it's the ground floor, as in the booking flow. */}
                  {movingLiftApplies(property.homeType) && (
                    <>
                      <label>
                        <span className={labelClass}>{t("Floor", "Etasje")}</span>
                        <input
                          type="number"
                          className={fieldClass}
                          value={property.floorNumber ?? ""}
                          onChange={(e) =>
                            end.onProperty({ floorNumber: e.target.value === "" || e.target.value === "0" ? null : Number(e.target.value) })
                          }
                        />
                        {blocked(end.key, "floorNumber") && <p className={errorClass}>{t("Enter the floor.", "Skriv inn etasjen.")}</p>}
                      </label>
                      {movingLiftRequired(property.floorNumber) && (
                        <div>
                          <span className={labelClass}>{t("Lift", "Heis")}</span>
                          <div className="grid grid-cols-2 gap-2">
                            <ChoiceButton wide selected={property.hasLift === true} onClick={() => end.onProperty({ hasLift: true })}>
                              {t("Yes", "Ja")}
                            </ChoiceButton>
                            <ChoiceButton wide selected={property.hasLift === false} onClick={() => end.onProperty({ hasLift: false })}>
                              {t("No", "Nei")}
                            </ChoiceButton>
                          </div>
                          {blocked(end.key, "hasLift") && <p className={errorClass}>{t("Is there a lift?", "Er det heis?")}</p>}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-4 border-t border-neutral-200 pt-4">
                  <span className={labelClass}>{t("Parking", "Parkering")}</span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {MOVING_PARKING_OPTIONS.map((option) => (
                      <ChoiceButton key={option.code} wide selected={property.parking === option.code} onClick={() => end.onProperty({ parking: option.code })}>
                        {label(option)}
                      </ChoiceButton>
                    ))}
                  </div>
                  {blocked(end.key, "parking") && <p className={errorClass}>{t("Choose where the van can park.", "Velg hvor bilen kan parkere.")}</p>}
                </div>
              </div>
            </section>
          );
        })}

        <section className={sectionClass}>
          <h3 className="text-lg font-semibold text-logoblue">{t("Additional services", "Tilleggstjenester")}</h3>
          {(catalog?.services ?? []).length === 0 ? (
            <p className="text-sm text-black/50">{t("No additional services.", "Ingen tilleggstjenester.")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {catalog!.services.map((service) => (
                <ChoiceButton key={service.code} selected={draft.edit.serviceCodes.includes(service.code)} onClick={() => toggleService(service.code)}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span>{label(service)}</span>
                    <span className="text-xs tabular-nums">{formatKr(Math.round(service.customerPriceCents / 100))}</span>
                  </span>
                </ChoiceButton>
              ))}
            </div>
          )}
        </section>

        {/* Date and time window — as in the delivery Edit tab's delivery card. */}
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
            {blocked(null, "timeWindow") && (
              <p className={errorClass}>{t("Choose a start and end time, with the end after the start.", "Velg start- og sluttid, der slutten er etter starten.")}</p>
            )}
          </div>
        </section>

        {/* Customer — the same card as the delivery Edit tab's. */}
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
              disabled={!dirty || saving || previewing || !!error || blockedByPrices || blockers.length > 0}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-logoblue px-5 text-base font-semibold text-white disabled:opacity-50"
            >
              {saving ? t("Saving…", "Lagrer…") : t("Save changes", "Lagre endringer")}
            </button>
          </div>
        </div>
      </div>

      {/* The Overview's calculator, priced together with the edits on the left
          and saved with them; then the price against what was paid — as on a
          delivery order (WebsiteOrderEditTab). */}
      <div className="flex flex-col gap-4 lg:self-start">
        <WebsiteOrderCalculator
          orderId={orderId}
          calculator={calculator}
          adjustments={adjustments}
          missingFromLines={0}
          storedTotal={storedTotal}
          currentPricesTotal={currentPricesTotal}
          priceChanges={priceChanges}
          locale={locale}
          onDraftChange={setPricingDraft}
          externalPricing={{
            view: preview?.calculator ?? null,
            previewing,
            useNewPrice: useNewPrices,
            onUseNewPrice: () => setUseNewPrices(true),
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

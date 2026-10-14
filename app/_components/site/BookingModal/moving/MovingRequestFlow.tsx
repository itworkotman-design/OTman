"use client";

import { useEffect, useState } from "react";
import { SteppedModal, type FinalStep, type StepSection } from "../SteppedModal";
import { CustomerTypeStep } from "../whiteGoods/CustomerTypeStep";
import { AutoAdvance } from "../AutoAdvance";
import { DateTimeWindowFields } from "../whiteGoods/DateTimeWindowFields";
import { WhiteGoodsOrderSummary } from "../whiteGoods/WhiteGoodsOrderSummary";
import { isTimeWindowComplete } from "@/lib/booking/timeWindows";
import { parseDistanceKm } from "@/lib/booking/pricing/orderCalculatorExtras";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import {
  websiteCustomerPrice,
  websiteCustomerTotalDisplay,
  type CustomerType,
} from "@/lib/booking/pricing/websiteVat";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import {
  MOVING_CARRY_SURCHARGE_PRODUCT_CODE,
  MOVING_DISTANCE_ITEM_CODE,
  MOVING_FLOOR_SURCHARGE_PRODUCT_CODE,
  MOVING_PRODUCT_CODE,
  MOVING_SERVICE_OPTIONS,
  MOVING_SERVICES_PRODUCT_CODE,
} from "@/lib/content/movingCatalog";
import { movingCustomerLiveTotals, movingLineKeyFor } from "@/lib/orders/movingOrderCalculator";
import { buildOrderAdjustmentLines } from "../whiteGoods/orderSummaryLines";
import {
  movingCarrySurchargeLines,
  movingDistanceLines,
  movingFloorSurchargeLines,
} from "@/lib/orders/movingOrderPricing";
import {
  emptyMovingProperty,
  isMovingEndReady,
  movingDraftChargeableFloors,
  type MovingPropertyDraft,
} from "@/lib/orders/movingProperty";
import { PropertyDetailsSection, PropertyWhereSection } from "./PropertySection";
import { movingSummary } from "./movingSummary";
import CustomerOrderEditFooter from "@/app/_components/site/pageComponents/myOrder/CustomerOrderEditFooter";
import type { CustomerEditDraft } from "@/app/_components/site/pageComponents/myOrder/customerEditPayload";
import { buildMovingReviewBlocks } from "./movingReview";
import { OrderReviewBlocks, ReviewTotalFooter } from "../whiteGoods/OrderReviewParts";
import {
  isValidEmail,
  sanitizeEmailInput,
  sanitizePhoneInput,
  sanitizeTextInput,
  validatePhoneField,
} from "@/lib/orders/websiteOrderValidation";

// The same flow, opened by the customer on their own move in "My order"
// (like the delivery modal's WhiteGoodsCustomerEdit): loaded from
// /api/customer/orders/[orderNumber] with every section open, saved through
// its PUT from the edit bar (CustomerOrderEditFooter). Within 24h of the job
// only the contact details and adding services are left.
export type MovingCustomerEdit = {
  orderNumber: string;
  beforeCutoff: boolean;
  onSaved: (message: string) => void;
};

type Props = {
  locale: Locale;
  onClose: () => void;
  customer?: MovingCustomerEdit;
};


function formatKr(n: number) {
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

export function MovingRequestFlow({ locale, onClose, customer }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  const [catalogOptions, setCatalogOptions] = useState<MovingCatalogOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<MovingCatalogOption[]>([]);
  const [floorSurchargeOption, setFloorSurchargeOption] = useState<MovingCatalogOption | null>(null);
  const [carrySurcharges, setCarrySurcharges] = useState<MovingCatalogOption[]>([]);
  const [distanceRates, setDistanceRates] = useState<{ kmFrom21: MovingCatalogOption; kmOver100: MovingCatalogOption } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/site/moving-request/catalog", { signal: controller.signal, cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setCatalogError(t("Could not load pricing", "Kunne ikke laste priser"));
          return;
        }
        setCatalogOptions(data.options ?? []);
        setServiceOptions(data.services ?? []);
        setFloorSurchargeOption(data.floorSurcharge ?? null);
        setCarrySurcharges(data.carrySurcharges ?? []);
        setDistanceRates(data.distanceRates ?? null);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setCatalogError(t("Could not load pricing", "Kunne ikke laste priser"));
        }
      } finally {
        setCatalogLoading(false);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  // Picked from the autocomplete suggestions (not free-typed) — required to
  // move on, as in the delivery modal. Every keystroke resets it.
  const [pickupAddressSelected, setPickupAddressSelected] = useState(false);
  const [deliveryAddressSelected, setDeliveryAddressSelected] = useState(false);
  // Both ends of the move get the same questions (PropertySection). The
  // origin's size is what the move is priced on.
  const [origin, setOrigin] = useState<MovingPropertyDraft>(emptyMovingProperty);
  const [destination, setDestination] = useState<MovingPropertyDraft>(emptyMovingProperty);
  const [serviceCodes, setServiceCodes] = useState<string[]>([]);

  // Driving distance pickup → delivery via Mapbox, like the delivery modal:
  // only once both addresses are picked from the suggestions (a free-typed
  // one is never geocoded and priced), debounced.
  const [drivingDistance, setDrivingDistance] = useState("");
  const routeKey =
    pickupAddressSelected && deliveryAddressSelected && pickupAddress.trim() && deliveryAddress.trim()
      ? JSON.stringify({ pickupAddress: pickupAddress.trim(), deliveryAddress: deliveryAddress.trim() })
      : "";
  useEffect(() => {
    if (!routeKey) {
      setDrivingDistance("");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/site/route-distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: routeKey,
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && typeof data.distanceKm === "string") setDrivingDistance(data.distanceKm);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) setDrivingDistance("");
      }
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [routeKey]);

  const [preferredDate, setPreferredDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const [timingTouched, setTimingTouched] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Set once by the very first step ("customer-type", below) so the
  // size-tile prices shown on the very next step are already in the right
  // VAT mode — no toggle to change it again later, since asking twice
  // would be redundant. Still display-only (never affects actual pricing).
  // Starts `null` (unanswered) rather than defaulting to "private" so the
  // first step's tiles open with neither one highlighted —
  // websiteCustomerTotalDisplay already treats "private" as its own default
  // whenever this is null.
  const [customerType, setCustomerType] = useState<CustomerType | null>(null);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{ orderNumber: string } | null>(null);

  // "My order": the customer's own move, loaded into the flow's state.
  const customerLocked = !!customer && !customer.beforeCutoff;
  const [customerLoaded, setCustomerLoaded] = useState(!customer);
  const [customerLoadError, setCustomerLoadError] = useState(false);
  // The order as loaded — what the edit bar compares the flow with.
  const [customerInitialDraft, setCustomerInitialDraft] = useState<CustomerEditDraft | null>(null);
  const [customerSummaryOpen, setCustomerSummaryOpen] = useState(false);
  // What staff set on the move's price (discount, extra, lines set to 0), from
  // the order — applied to the live price below.
  const [staffPricing, setStaffPricing] = useState<{ rabatt: string; leggTil: string; nulledLineKeys: string[] } | null>(null);
  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customer/orders/${encodeURIComponent(customer.orderNumber)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        const details = data?.details;
        if (cancelled) return;
        if (!res.ok || !data?.ok || details?.kind !== "moving") {
          setCustomerLoadError(true);
          return;
        }
        const moving = details.moving as CustomerEditDraft["moving"] & {
          pickupAddress: string;
          deliveryAddress: string;
          origin: MovingPropertyDraft;
          destination: MovingPropertyDraft;
        };
        setPickupAddress(moving.pickupAddress);
        setDeliveryAddress(moving.deliveryAddress);
        setPickupAddressSelected(true);
        setDeliveryAddressSelected(true);
        setOrigin(moving.origin);
        setDestination(moving.destination);
        setServiceCodes(moving.serviceCodes);
        setPreferredDate(details.preferredDate);
        setTimeWindow(details.timeWindow);
        setName(details.customer.name);
        setPhone(details.customer.phone);
        setEmail(details.customer.email);
        setNotes(details.customer.comments);
        setCustomerType(details.customerType ?? "private");
        setStaffPricing(data.pricingContext ?? null);
        setCustomerInitialDraft({
          customer: details.customer,
          preferredDate: details.preferredDate,
          timeWindow: details.timeWindow,
          moving,
        });
        setCustomerLoaded(true);
      } catch {
        if (!cancelled) setCustomerLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.orderNumber]);

  const selectedOption = catalogOptions.find((o) => o.code === origin.sizeOptionCode) ?? null;
  const selectedServices = serviceOptions.filter((o) => serviceCodes.includes(o.code));
  // customerPriceCents is the price list's price, ex. VAT like every website
  // price; a private customer pays each line + 25%, rounded to whole kroner —
  // movingCustomerTotals is what the order's payment link charges too
  // (lib/orders/movingOrderPricing.ts).
  // No-lift floor surcharge per end, live from each draft as the floor box
  // changes — not only once the whole section (size, parking) is answered.
  // Only counts while the lift question applies, so an answer left over
  // from an earlier type never shows a charge the server wouldn't make.
  const chargeableFloors = movingDraftChargeableFloors;
  // One entry per end with chargeable floors, priced like the server prices
  // them (movingFloorSurchargeLines) — `end` labels the summary row.
  const floorLines = [
    { end: t("from", "fra"), endKey: "from" as const, chargeableFloors: chargeableFloors(origin) },
    { end: t("to", "til"), endKey: "to" as const, chargeableFloors: chargeableFloors(destination) },
  ].flatMap(({ end, endKey, chargeableFloors }) =>
    movingFloorSurchargeLines(floorSurchargeOption, [{ label: end, chargeableFloors }]).map((line) => ({ ...line, end, endKey })),
  );
  // Carrying-distance surcharge per end, from its parking answer (right
  // outside is free) — also priced like the server prices it.
  const carryLines = [
    { end: t("from", "fra"), endKey: "from" as const, parking: origin.parking },
    { end: t("to", "til"), endKey: "to" as const, parking: destination.parking },
  ].flatMap(({ end, endKey, parking }) =>
    movingCarrySurchargeLines(carrySurcharges, [{ label: end, parking }]).map((line) => {
      const option = carrySurcharges.find((o) => o.code === line.code);
      return { ...line, end, endKey, labelNo: option?.labelNo ?? line.labelEn, labelEn: option?.labelEn ?? line.labelEn };
    }),
  );
  // The km charge (same rule as delivery — movingDistanceLines), from the
  // driving distance looked up below. The server looks it up again itself.
  const distanceLines = movingDistanceLines(distanceRates, parseDistanceKm(drivingDistance));
  // Every priced line with its key (movingLineKeyFor — the same as its stored
  // line's), so what staff set on a booked move ("My order": staffPricing) can
  // be applied: a line set to 0 shows and counts at 0 kr, a discount/extra
  // gets its own row — the price the server prices the change at
  // (movingCustomerLiveTotals). Booking a new move, staffPricing is null.
  const keyedLines = selectedOption
    ? [
        { key: movingLineKeyFor(MOVING_PRODUCT_CODE, selectedOption.code), customerPriceCents: selectedOption.customerPriceCents },
        ...selectedServices.map((s) => ({ key: movingLineKeyFor(MOVING_SERVICES_PRODUCT_CODE, s.code), customerPriceCents: s.customerPriceCents })),
        ...floorLines.map((l) => ({ key: movingLineKeyFor(MOVING_FLOOR_SURCHARGE_PRODUCT_CODE, l.code, l.endKey), customerPriceCents: l.customerPriceCents })),
        ...carryLines.map((l) => ({ key: movingLineKeyFor(MOVING_CARRY_SURCHARGE_PRODUCT_CODE, l.code, l.endKey), customerPriceCents: l.customerPriceCents })),
        ...distanceLines.map((l) => ({ key: movingLineKeyFor(MOVING_DISTANCE_ITEM_CODE, l.code), customerPriceCents: l.customerPriceCents })),
      ]
    : [];
  const totals = movingCustomerLiveTotals(keyedLines, staffPricing);
  const zeroed = <T extends { customerPriceCents: number }>(line: T, key: string): T =>
    totals.nulledKeys.includes(key) ? { ...line, customerPriceCents: 0 } : line;
  const vatDisplay = websiteCustomerTotalDisplay({
    totalExVat: totals.totalExVat,
    totalIncVat: totals.totalIncVat,
    customerType: customerType ?? undefined,
  });
  const linePrice = (option: { customerPriceCents: number }) =>
    websiteCustomerPrice(option.customerPriceCents / 100, customerType ?? "private");
  // One live calculator — the delivery modal's order-summary card — shared
  // by every step from "about the place you're moving from" until "your
  // details" (SteppedModal's `aside`), following them in a sticky right
  // column instead of each step carrying its own. "Where are you moving
  // from?" (address + type) stays full width above it.
  const summary = movingSummary({
    locale,
    sizeOption: selectedOption && zeroed(selectedOption, movingLineKeyFor(MOVING_PRODUCT_CODE, selectedOption.code)),
    services: selectedServices.map((s) => zeroed(s, movingLineKeyFor(MOVING_SERVICES_PRODUCT_CODE, s.code))),
    floorLines: floorLines.map((l) => zeroed(l, movingLineKeyFor(MOVING_FLOOR_SURCHARGE_PRODUCT_CODE, l.code, l.endKey))),
    carryLines: carryLines.map((l) => zeroed(l, movingLineKeyFor(MOVING_CARRY_SURCHARGE_PRODUCT_CODE, l.code, l.endKey))),
    distanceLines: distanceLines.map((l) => zeroed(l, movingLineKeyFor(MOVING_DISTANCE_ITEM_CODE, l.code))),
  });
  // A staff discount / extra as rows, so the lines add up to the total (as the delivery flow).
  const summaryOrderExtras = [...summary.orderExtras, ...buildOrderAdjustmentLines(totals, locale)];
  const calculator = (
    <WhiteGoodsOrderSummary
      locale={locale}
      products={summary.products}
      orderExtras={summaryOrderExtras}
      totalExVat={totals.totalExVat}
      totalIncVat={totals.totalIncVat}
      customerType={customerType ?? "private"}
      hideProductHints
    />
  );
  // Within 24h of the job a booked service can't be removed — only added to.
  const bookedServiceCodes = customerLocked ? (customerInitialDraft?.moving?.serviceCodes ?? []) : [];
  const toggleService = (code: string) => {
    if (bookedServiceCodes.includes(code)) return;
    setServiceCodes((codes) => (codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]));
  };

  const canContinueTiming = !!preferredDate && isTimeWindowComplete(timeWindow);
  const canSubmit =
    !!name.trim() &&
    validatePhoneField(phone) === null &&
    isValidEmail(email) &&
    isMovingEndReady({ address: pickupAddress, addressSelected: pickupAddressSelected, property: origin }) &&
    isMovingEndReady({ address: deliveryAddress, addressSelected: deliveryAddressSelected, property: destination }) &&
    !submitLoading;

  async function handleSubmit() {
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/site/moving-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupAddress,
          deliveryAddress,
          origin,
          destination,
          serviceCodes,
          customerType,
          preferredDate,
          timeWindow,
          name,
          phone,
          email,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitError(
          t("Something went wrong. Please try again.", "Noe gikk galt. Prøv igjen."),
        );
        return;
      }
      setSubmitResult({ orderNumber: data.orderNumber ?? String(data.displayId) });
    } catch {
      setSubmitError(t("Something went wrong. Please try again.", "Noe gikk galt. Prøv igjen."));
    } finally {
      setSubmitLoading(false);
    }
  }

  const sections: StepSection[] = [
    {
      id: "customer-type",
      title: t("Are you ordering as a private person or a business?", "Bestiller du som privatperson eller bedrift?"),
      render: ({ onComplete }) => (
        <CustomerTypeStep
          locale={locale}
          value={customerType}
          onPick={(next) => {
            setCustomerType(next);
            onComplete();
          }}
        />
      ),
    },
    {
      id: "moving-from",
      title: t("Where are you moving from?", "Hvor flytter du fra?"),
      render: ({ onComplete, onUncomplete }) => (
        <PropertyWhereSection
          locale={locale}
          address={pickupAddress}
          addressSelected={pickupAddressSelected}
          onAddressChange={(address, selected) => {
            setPickupAddress(address);
            setPickupAddressSelected(selected);
          }}
          addressPlaceholder={t("Moving from (address)", "Flytter fra (adresse)")}
          value={origin}
          onChange={setOrigin}
          onReady={onComplete}
          onRetract={onUncomplete}
        />
      ),
    },
    {
      id: "moving-from-details",
      title: t("About the place you're moving from", "Om stedet du flytter fra"),
      render: ({ onComplete, onUncomplete }) => (
        <PropertyDetailsSection
          locale={locale}
          address={pickupAddress}
          addressSelected={pickupAddressSelected}
          value={origin}
          onChange={setOrigin}
          sizeOptions={catalogOptions}
          catalogLoading={catalogLoading}
          catalogError={catalogError}
          onReady={onComplete}
          onRetract={onUncomplete}
        />
      ),
    },
    {
      id: "moving-to",
      title: t("Where are you moving to?", "Hvor flytter du til?"),
      render: ({ onComplete, onUncomplete }) => (
        <PropertyWhereSection
          locale={locale}
          address={deliveryAddress}
          addressSelected={deliveryAddressSelected}
          onAddressChange={(address, selected) => {
            setDeliveryAddress(address);
            setDeliveryAddressSelected(selected);
          }}
          addressPlaceholder={t("Moving to (address)", "Flytter til (adresse)")}
          value={destination}
          onChange={setDestination}
          onReady={onComplete}
          onRetract={onUncomplete}
        />
      ),
    },
    {
      id: "moving-to-details",
      title: t("About the place you're moving to", "Om stedet du flytter til"),
      description: t(
        "So we know what to expect on arrival.",
        "Så vi vet hva som venter ved levering.",
      ),
      render: ({ onComplete, onUncomplete }) => (
        <PropertyDetailsSection
          locale={locale}
          address={deliveryAddress}
          addressSelected={deliveryAddressSelected}
          value={destination}
          onChange={setDestination}
          sizeOptions={catalogOptions}
          catalogLoading={catalogLoading}
          catalogError={catalogError}
          onReady={onComplete}
          onRetract={onUncomplete}
        />
      ),
    },
    {
      // Always present (even before the catalog loads or with no services
      // priced) — SteppedModal tracks progress by position, so a step
      // appearing later would shift the ones after it.
      id: "additional-services",
      title: t("Additional services", "Tilleggstjenester"),
      description: t(
        "Optional — pick anything you'd like us to take care of as well.",
        "Valgfritt — velg det du vil at vi skal ta oss av i tillegg.",
      ),
      render: ({ onComplete, onUncomplete }) => (
        <div className="flex flex-col gap-3">
          {serviceOptions.length === 0 && !catalogLoading && (
            <p className="text-sm text-black/50">
              {t("No additional services are available right now.", "Ingen tilleggstjenester er tilgjengelige akkurat nå.")}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {serviceOptions.map((option) => {
              const active = serviceCodes.includes(option.code);
              const blurb = MOVING_SERVICE_OPTIONS.find((s) => s.code === option.code);
              return (
                <button
                  key={option.code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleService(option.code)}
                  className={`flex flex-col gap-1.5 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    active ? "border-logoblue bg-logoblue text-white" : "border-black/8 bg-white text-textColor"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{locale === "no" ? option.labelNo : option.labelEn}</span>
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                        active ? "border-white bg-white text-logoblue" : "border-black/20"
                      }`}
                    >
                      {active ? "✓" : ""}
                    </span>
                  </span>
                  {blurb && (
                    <span className={active ? "text-white/80" : "text-black/50"}>
                      {locale === "no" ? blurb.blurbNo : blurb.blurbEn}
                    </span>
                  )}
                  <span className={`font-semibold ${active ? "text-white/90" : "text-logoblue"}`}>
                    + {formatKr(linePrice(option))}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Nothing here is required, so the next section opens right away. */}
          <AutoAdvance ready onReady={onComplete} onRetract={onUncomplete} />
        </div>
      ),
    },
    {
      id: "timing",
      title: t("When?", "Når?"),
      description: t(
        "Pick a preferred date and window — we'll confirm the exact time once your booking is approved.",
        "Velg en foretrukket dato og et tidsvindu — vi bekrefter eksakt tidspunkt når bestillingen er godkjent.",
      ),
      render: ({ onComplete, onUncomplete }) => (
        // Same card, date picker and time windows as the delivery modal's
        // order details (DateTimeWindowFields) — fields only turn red once
        // focus has left the card with them still unanswered.
        <div
          className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTimingTouched(true);
          }}
        >
          <DateTimeWindowFields
            locale={locale}
            preferredDate={preferredDate}
            setPreferredDate={setPreferredDate}
            timeWindow={timeWindow}
            setTimeWindow={setTimeWindow}
            dateError={timingTouched && !preferredDate}
            timeWindowError={timingTouched && !isTimeWindowComplete(timeWindow)}
          />
          <AutoAdvance ready={canContinueTiming} onReady={onComplete} onRetract={onUncomplete} />
        </div>
      ),
    },
    {
      id: "your-details",
      title: t("Your details", "Dine opplysninger"),
      render: ({ onComplete }) => (
        <div className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(sanitizeTextInput(e.target.value))}
            placeholder={t("Full name", "Fullt navn")}
            className="h-11 rounded-lg border border-black/15 px-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={phone}
              inputMode="tel"
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              placeholder={t("Phone", "Telefon")}
              className="h-11 rounded-lg border border-black/15 px-2 text-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(sanitizeEmailInput(e.target.value))}
              placeholder={t("Email", "E-post")}
              className="h-11 rounded-lg border border-black/15 px-2 text-sm"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(sanitizeTextInput(e.target.value))}
            rows={3}
            placeholder={t(
              "Anything else? Particularly heavy or fragile items, a piano, a storage room…",
              "Noe annet vi bør vite? Spesielt tunge eller skjøre gjenstander, piano, bod …",
            )}
            className="rounded-lg border border-black/15 px-2 py-1.5 text-sm"
          />
          {/* The one explicit button, as in the delivery modal: moving on swaps
              the modal to the summary, so it mustn't fire the moment the email
              first parses as valid while still being typed, or before notes. */}
          {!customer && (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onComplete}
            className="self-center inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
          >
            {t("Go to summary", "Gå til oppsummering")}
          </button>
          )}
        </div>
      ),
    },
  ];

  const reviewBlocks = buildMovingReviewBlocks(locale, {
    pickupAddress,
    deliveryAddress,
    origin,
    destination,
    sizeOptions: catalogOptions,
    preferredDate,
    timeWindow,
    drivingDistance,
    contact: { name, phone, email, notes },
  });

  const finalStep: FinalStep = {
    render: ({ onBack }) =>
      submitResult ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <h4 className="text-lg font-semibold text-logoblue">{t("Request received!", "Forespørsel mottatt!")}</h4>
          <p className="text-sm text-black/60">
            {t(
              `Request #${submitResult.orderNumber} is with us — once it's approved we'll email you a link to pay and confirm.`,
              `Forespørsel #${submitResult.orderNumber} er mottatt — når den er godkjent sender vi deg en lenke for betaling og bekreftelse på e-post.`,
            )}
          </p>
        </div>
      ) : (
        // Same layout as the delivery modal's review page: the answers as
        // cards on the left, the order summary (size, services, surcharges,
        // km) with the VAT breakdown and the send button on the right.
        <div className="flex flex-col gap-6">
          <button
            type="button"
            onClick={onBack}
            className="self-start flex items-center gap-1.5 text-sm font-semibold text-logoblue transition hover:opacity-70"
          >
            <span aria-hidden="true">←</span>
            {t("Back", "Tilbake")}
          </button>

          <h4 className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-logoblue">
            {t("Summary", "Oppsummering")}
          </h4>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
            <div className="flex flex-col gap-4">
              <OrderReviewBlocks blocks={reviewBlocks} />
            </div>

            <div className="flex flex-col gap-4 lg:self-start">
              <WhiteGoodsOrderSummary
                locale={locale}
                products={summary.products}
                orderExtras={summaryOrderExtras}
                totalExVat={totals.totalExVat}
                totalIncVat={totals.totalIncVat}
                customerType={customerType ?? "private"}
                hideProductHints
                totalFooter={
                  <ReviewTotalFooter
                    locale={locale}
                    exVat={totals.totalExVat}
                    vat={totals.totalIncVat - totals.totalExVat}
                    incVat={totals.totalIncVat}
                    emphasiseExVat={vatDisplay.primary === "exVat"}
                  />
                }
              />

              <p className="text-xs leading-relaxed text-black/50">
                {t(
                  "This price is based on the approximate size you selected — the final price is confirmed when we review your booking. You'll get a payment link by email once it's approved.",
                  "Denne prisen er basert på den omtrentlige størrelsen du valgte — endelig pris bekreftes når vi har gått gjennom bestillingen. Du får en betalingslenke på e-post når den er godkjent.",
                )}
              </p>

              {/* "My order" saves from its edit bar (CustomerOrderEditFooter). */}
              {!customer && submitError && <p className="text-sm text-red-600">{submitError}</p>}

              {!customer && (
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
              >
                {submitLoading ? t("Sending…", "Sender…") : t("Submit booking", "Send bestilling")}
              </button>
              )}
            </div>
          </div>
        </div>
      ),
  };

  if (customer) {
    // Everything but the customer type (answered at booking); within 24h of
    // the job only adding services and the contact details.
    const customerSections = customerLocked
      ? sections.filter((section) => section.id === "additional-services" || section.id === "your-details")
      : sections.filter((section) => section.id !== "customer-type");
    const loadingSections: StepSection[] = [
      {
        id: "customer-loading",
        title: customerLoadError ? t("Couldn't load the order", "Kunne ikke laste bestillingen") : t("Loading order…", "Laster bestilling…"),
        render: () => null,
      },
    ];
    const customerDraft: CustomerEditDraft = {
      customer: { name, phone, email, comments: notes },
      preferredDate,
      timeWindow,
      moving: { pickupAddress, deliveryAddress, origin, destination, serviceCodes },
    };
    // A typed address must be picked from the suggestions before saving, as when booking.
    const blockedMessage =
      !customerLocked &&
      (!isMovingEndReady({ address: pickupAddress, addressSelected: pickupAddressSelected, property: origin }) ||
        !isMovingEndReady({ address: deliveryAddress, addressSelected: deliveryAddressSelected, property: destination }))
        ? t(
            "Pick both addresses from the suggestions and answer every question about both places.",
            "Velg begge adressene fra forslagene og svar på alle spørsmålene om begge stedene.",
          )
        : null;
    return (
      <SteppedModal
        showAll
        sections={customerLoaded ? customerSections : loadingSections}
        finalStep={finalStep}
        finalStepOpen={!customerLocked && customerSummaryOpen}
        onFinalStepBack={() => setCustomerSummaryOpen(false)}
        onClose={onClose}
        title={
          <span className="truncate text-base font-semibold text-logoblue">
            {t("Change order", "Endre bestilling")} #{customer.orderNumber}
          </span>
        }
        aside={customerLocked ? undefined : { node: calculator, fromId: "moving-from-details", untilId: "your-details" }}
        footer={
          customerLoaded && customerInitialDraft ? (
            <CustomerOrderEditFooter
              orderNumber={customer.orderNumber}
              initial={customerInitialDraft}
              current={customerDraft}
              beforeCutoff={customer.beforeCutoff}
              locale={locale}
              onCancel={onClose}
              onSaved={customer.onSaved}
              blockedMessage={blockedMessage}
              summaryOpen={customerSummaryOpen}
              onOpenSummary={() => setCustomerSummaryOpen(true)}
            />
          ) : null
        }
      />
    );
  }

  return (
    <SteppedModal
      sections={sections}
      finalStep={finalStep}
      onClose={onClose}
      aside={{ node: calculator, fromId: "moving-from-details", untilId: "your-details" }}
      dimCompleted
      scrollToNewSections
    />
  );
}

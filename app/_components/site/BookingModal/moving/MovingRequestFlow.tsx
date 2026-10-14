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
import { MOVING_SERVICE_OPTIONS } from "@/lib/content/movingCatalog";
import {
  movingCarrySurchargeLines,
  movingCustomerTotals,
  movingDistanceLines,
  movingFloorSurchargeLines,
} from "@/lib/orders/movingOrderPricing";
import {
  emptyMovingProperty,
  isMovingEndReady,
  movingDraftChargeableFloors,
  type MovingPropertyDraft,
} from "@/lib/orders/movingProperty";
import { PropertyDetailsSection, PropertyWhereSection, floorsLabel, propertySummary } from "./PropertySection";
import { movingSummary } from "./movingSummary";
import {
  isValidEmail,
  sanitizeEmailInput,
  sanitizePhoneInput,
  sanitizeTextInput,
  validatePhoneField,
} from "@/lib/orders/websiteOrderValidation";

type Props = {
  locale: Locale;
  onClose: () => void;
};


function formatKr(n: number) {
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

export function MovingRequestFlow({ locale, onClose }: Props) {
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
    { end: t("from", "fra"), chargeableFloors: chargeableFloors(origin) },
    { end: t("to", "til"), chargeableFloors: chargeableFloors(destination) },
  ].flatMap(({ end, chargeableFloors }) =>
    movingFloorSurchargeLines(floorSurchargeOption, [{ label: end, chargeableFloors }]).map((line) => ({ ...line, end })),
  );
  // Carrying-distance surcharge per end, from its parking answer (right
  // outside is free) — also priced like the server prices it.
  const carryLines = [
    { end: t("from", "fra"), parking: origin.parking },
    { end: t("to", "til"), parking: destination.parking },
  ].flatMap(({ end, parking }) =>
    movingCarrySurchargeLines(carrySurcharges, [{ label: end, parking }]).map((line) => {
      const option = carrySurcharges.find((o) => o.code === line.code);
      return { ...line, end, labelNo: option?.labelNo ?? line.labelEn, labelEn: option?.labelEn ?? line.labelEn };
    }),
  );
  // The km charge (same rule as delivery — movingDistanceLines), from the
  // driving distance looked up below. The server looks it up again itself.
  const distanceLines = movingDistanceLines(distanceRates, parseDistanceKm(drivingDistance));
  const totals = movingCustomerTotals(
    selectedOption ? [selectedOption, ...selectedServices, ...floorLines, ...carryLines, ...distanceLines] : [],
  );
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
  const summary = movingSummary({ locale, sizeOption: selectedOption, services: selectedServices, floorLines, carryLines, distanceLines });
  const calculator = (
    <WhiteGoodsOrderSummary
      locale={locale}
      products={summary.products}
      orderExtras={summary.orderExtras}
      totalExVat={totals.totalExVat}
      totalIncVat={totals.totalIncVat}
      customerType={customerType ?? "private"}
      hideProductHints
    />
  );
  const toggleService = (code: string) =>
    setServiceCodes((codes) => (codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]));

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
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onComplete}
            className="self-center inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
          >
            {t("Go to summary", "Gå til oppsummering")}
          </button>
        </div>
      ),
    },
  ];

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
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={onBack}
            className="self-start flex items-center gap-1.5 text-sm font-semibold text-logoblue transition hover:opacity-70"
          >
            <span aria-hidden="true">←</span>
            {t("Back", "Tilbake")}
          </button>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-logoblue">
              {t("Summary", "Oppsummering")}
            </h4>
            <div className="mt-3 flex flex-col gap-1 text-sm text-black/70">
              {[
                { label: t("From", "Fra"), address: pickupAddress, property: origin },
                { label: t("To", "Til"), address: deliveryAddress, property: destination },
              ].map((end) => (
                <div key={end.label} className="flex justify-between gap-4">
                  <span>{end.label}</span>
                  <span className="text-right">
                    {end.address || "—"}
                    <span className="block text-xs text-black/45">
                      {propertySummary(locale, end.property, catalogOptions)}
                    </span>
                  </span>
                </div>
              ))}
              {selectedServices.map((service) => (
                <div key={service.code} className="flex justify-between gap-4">
                  <span>{locale === "no" ? service.labelNo : service.labelEn}</span>
                  <span>+ {formatKr(linePrice(service))}</span>
                </div>
              ))}
              {floorLines.map((line) => (
                <div key={line.end} className="flex justify-between gap-4">
                  <span>
                    {t("Floor surcharge", "Etasjetillegg")}, {line.end} ({floorsLabel(locale, line.quantity)})
                  </span>
                  <span>+ {formatKr(linePrice(line))}</span>
                </div>
              ))}
              {carryLines.map((line) => (
                <div key={line.end} className="flex justify-between gap-4">
                  <span>
                    {locale === "no" ? line.labelNo : line.labelEn}, {line.end}
                  </span>
                  <span>+ {formatKr(linePrice(line))}</span>
                </div>
              ))}
              {distanceLines.map((line) => (
                <div key={line.code} className="flex justify-between gap-4">
                  <span>
                    {t("Distance", "Kjøring")} ({line.quantity} km)
                  </span>
                  <span>+ {formatKr(linePrice(line))}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4">
                <span>{t("Date", "Dato")}</span>
                <span>
                  {preferredDate} · {timeWindow.replace(/:00/g, "")}
                </span>
              </div>
            </div>

            <div className="mt-4 border-t border-black/10 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-logoblue">{t("Total", "Totalt")}</span>
                <span className="text-lg font-semibold text-logoblue">{formatKr(vatDisplay.primaryAmount)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-end">
                <span className="text-xs text-black/45">
                  {formatKr(vatDisplay.secondaryAmount)} {vatDisplay.primary === "incVat" ? t("ex. VAT", "eks. mva") : t("incl. VAT", "inkl. mva")}
                </span>
              </div>
            </div>
          </div>

          <p className="rounded-lg bg-logoblue/5 p-3 text-sm text-black/60">
            {t(
              "This price is based on the approximate size you selected — the final price is confirmed when we review your booking. You'll get a payment link by email once it's approved.",
              "Denne prisen er basert på den omtrentlige størrelsen du valgte — endelig pris bekreftes når vi har gått gjennom bestillingen. Du får en betalingslenke på e-post når den er godkjent.",
            )}
          </p>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="self-start inline-flex h-11 items-center justify-center rounded-full bg-logoblue px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-40"
          >
            {submitLoading ? t("Sending…", "Sender…") : t("Submit booking", "Send bestilling")}
          </button>
        </div>
      ),
  };

  return (
    <SteppedModal
      sections={sections}
      finalStep={finalStep}
      onClose={onClose}
      aside={{ node: calculator, fromId: "moving-from-details", untilId: "your-details" }}
      dimCompleted
    />
  );
}

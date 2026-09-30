"use client";

import type { ReactNode } from "react";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { PinIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  DocumentIcon,
  LiftIcon,
  QuestionMarkIcon,
  WarningTriangleIcon,
} from "./orderDetailsIcons";
import { BuildingIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";

type Props = {
  locale: Locale;
  bookingLocale: BookingUiLocale;
  pickupAddress: string;
  setPickupAddress: (value: string) => void;
  // Reflects the pickup-source answer from the step before this one (store /
  // private individual / business) so the field reads less generically.
  pickupAddressPlaceholder: string;
  deliveryAddress: string;
  setDeliveryAddress: (value: string) => void;
  // A store pickup skips the floor/lift question entirely — a store always
  // has loading access, so there's nothing useful to ask.
  showPickupFloor: boolean;
  pickupFloor: number;
  setPickupFloor: (value: number) => void;
  deliveryFloor: number;
  setDeliveryFloor: (value: number) => void;
  // Tracked separately: a lift at pickup says nothing about delivery, or
  // vice versa.
  pickupLiftAvailable: boolean;
  setPickupLiftAvailable: (value: boolean) => void;
  deliveryLiftAvailable: boolean;
  setDeliveryLiftAvailable: (value: boolean) => void;
  preferredDate: string;
  setPreferredDate: (value: string) => void;
  timeWindow: string;
  setTimeWindow: (value: string) => void;
  // Calculated from the addresses above (see WhiteGoodsBookingFlow), never
  // typed by the customer — this card only ever displays it.
  drivingDistance: string;
  drivingDistanceLoading: boolean;
};

// Small uppercase eyebrow label used above the two address inputs — the
// inputs themselves carry a leading pin icon, so the label needs none.
function AddressLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-black/45">
      {children}
    </label>
  );
}

// The sentence-case label used above every other field: a small icon, the
// text, and an optional "?" tooltip (native title attribute — this app has
// no tooltip component yet, and a hover title is enough for a one-line hint).
function FieldLabel({
  icon,
  children,
  hint,
}: {
  icon: ReactNode;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-black/75">
      <span className="text-black/40">{icon}</span>
      {children}
      {hint && (
        <span
          title={hint}
          tabIndex={0}
          className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-black/30 hover:text-black/50"
        >
          <QuestionMarkIcon className="h-3.5 w-3.5" />
        </span>
      )}
    </span>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-sm text-black/85 outline-none transition placeholder:text-black/35 focus:border-logoblue/40";

// A floor number field with a stacked up/down chevron stepper on the right,
// instead of the browser's default (and inconsistently styled) number spinner.
function FloorInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="relative">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`${inputClass} pr-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-black/10">
        <button
          type="button"
          aria-label="Increase"
          onClick={() => onChange(value + 1)}
          className="grid h-4 w-6 place-items-center text-black/40 transition hover:bg-black/5 hover:text-black/70"
        >
          <ChevronUpIcon className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="grid h-4 w-6 place-items-center border-t border-black/10 text-black/40 transition hover:bg-black/5 hover:text-black/70"
        >
          <ChevronDownIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// Shared by the pickup and delivery floor columns — checkbox, lift icon,
// label, and the "?" tooltip explaining what it's for.
function LiftCheckbox({
  locale,
  checked,
  onChange,
}: {
  locale: Locale;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      <span className="flex items-center gap-1.5 font-medium text-black/75">
        <span className="text-black/40">
          <LiftIcon className="h-4 w-4" />
        </span>
        {t("Lift available", "Heis tilgjengelig")}
        <span
          title={t(
            "Is there a lift we can use to move the items?",
            "Er det en heis vi kan bruke til å flytte varene?",
          )}
          tabIndex={0}
          className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-black/30 hover:text-black/50"
        >
          <QuestionMarkIcon className="h-3.5 w-3.5" />
        </span>
      </span>
    </label>
  );
}

export function OrderDetailsCard({
  locale,
  bookingLocale,
  pickupAddress,
  setPickupAddress,
  pickupAddressPlaceholder,
  showPickupFloor,
  deliveryAddress,
  setDeliveryAddress,
  pickupFloor,
  setPickupFloor,
  deliveryFloor,
  setDeliveryFloor,
  pickupLiftAvailable,
  setPickupLiftAvailable,
  deliveryLiftAvailable,
  setDeliveryLiftAvailable,
  preferredDate,
  setPreferredDate,
  timeWindow,
  setTimeWindow,
  drivingDistance,
  drivingDistanceLoading,
}: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/5 text-logoblue">
          <DocumentIcon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-black/85">{t("Order Details", "Ordredetaljer")}</h3>
          <p className="text-sm text-black/50">
            {t("Provide pickup and delivery information for your order.", "Oppgi henting- og leveringsinformasjon for bestillingen din.")}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <AddressLabel>{t("Pickup address", "Hentested")}</AddressLabel>
          <AddressAutocompleteInput
            value={pickupAddress}
            onChange={(v) => setPickupAddress(v)}
            locale={bookingLocale}
            placeholder={pickupAddressPlaceholder}
            icon={<PinIcon />}
          />
        </div>
        <div>
          <AddressLabel>{t("Delivery address", "Leveringsadresse")}</AddressLabel>
          <AddressAutocompleteInput
            value={deliveryAddress}
            onChange={(v) => setDeliveryAddress(v)}
            locale={bookingLocale}
            placeholder={t("Your address", "Din adresse")}
            icon={<PinIcon />}
          />
        </div>

        <div className={showPickupFloor ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-1 gap-3"}>
          {showPickupFloor && (
            <div className="flex flex-col gap-2">
              <label className="block">
                <FieldLabel
                  icon={<BuildingIcon />}
                  hint={t("Ground floor is 0.", "Bakkeplan er 0.")}
                >
                  {t("Pickup floor", "Etasje ved henting")}
                </FieldLabel>
                <FloorInput value={pickupFloor} onChange={setPickupFloor} />
              </label>
              <LiftCheckbox locale={locale} checked={pickupLiftAvailable} onChange={setPickupLiftAvailable} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="block">
              <FieldLabel
                icon={<BuildingIcon />}
                hint={t("Ground floor is 0.", "Bakkeplan er 0.")}
              >
                {t("Delivery floor", "Etasje ved levering")}
              </FieldLabel>
              <FloorInput value={deliveryFloor} onChange={setDeliveryFloor} />
            </label>
            <LiftCheckbox locale={locale} checked={deliveryLiftAvailable} onChange={setDeliveryLiftAvailable} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel icon={<CalendarIcon className="h-4 w-4" />}>{t("Requested date", "Ønsket dato")}</FieldLabel>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel icon={<ClockIcon className="h-4 w-4" />}>{t("Time window", "Tidsvindu")}</FieldLabel>
            <input
              type="text"
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value)}
              placeholder={t("e.g. 08:00–12:00", "f.eks. 08:00–12:00")}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block">
          <FieldLabel
            icon={<WarningTriangleIcon className="h-4 w-4" />}
            hint={t(
              "Calculated automatically from the addresses above.",
              "Beregnes automatisk fra adressene over.",
            )}
          >
            {t("Driving distance", "Kjøreavstand")}
          </FieldLabel>
          <div className="relative">
            <input
              type="text"
              readOnly
              value={drivingDistanceLoading ? "" : drivingDistance}
              placeholder={
                drivingDistanceLoading
                  ? t("Calculating…", "Beregner…")
                  : t("Fill in the addresses above", "Fyll inn adressene over")
              }
              className={`${inputClass} cursor-default bg-black/2 pr-12 text-black/60`}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md bg-black/5 px-1.5 py-0.5 text-xs font-medium text-black/50">
              km
            </span>
          </div>
        </label>
      </div>
    </div>
  );
}

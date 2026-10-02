"use client";

import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { PinIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import DatePicker from "@/app/_components/utils/DatePicker";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { addDaysIso, getOsloDateKey } from "@/lib/dates/isoDate";
import { isNorwegianPublicHoliday } from "@/lib/dates/norwayHolidays";
import { CalendarIcon, ClockIcon, DocumentIcon, WarningTriangleIcon } from "./orderDetailsIcons";
import { AddressLabel, FieldLabel, inputClass, sideColumnClass } from "./formFieldStyles";
import { FloorLiftField } from "./floorLiftField";
import { TimeWindowField } from "./timeWindowField";

type Props = {
  locale: Locale;
  bookingLocale: BookingUiLocale;
  // The pickup address (and, for private/business, the pickup floor/lift)
  // are collected earlier, in the pickup-contact step — this card only asks
  // about delivery.
  deliveryAddress: string;
  // wasSelected: whether the text was actually picked from the address
  // suggestions (vs. free-typed) — see AddressAutocompleteInput.
  setDeliveryAddress: (value: string, wasSelected?: boolean) => void;
  deliveryFloor: number;
  setDeliveryFloor: (value: number) => void;
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
  // Customer-facing price per chargeable floor above the 2nd, no lift (see
  // getChargeableFloors) — drives the live surcharge shown next to the
  // delivery floor input.
  floorSurchargePerFloor: number;
};

export function OrderDetailsCard({
  locale,
  bookingLocale,
  deliveryAddress,
  setDeliveryAddress,
  deliveryFloor,
  setDeliveryFloor,
  deliveryLiftAvailable,
  setDeliveryLiftAvailable,
  preferredDate,
  setPreferredDate,
  timeWindow,
  setTimeWindow,
  drivingDistance,
  drivingDistanceLoading,
  floorSurchargePerFloor,
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
            {t("Provide delivery information for your order.", "Oppgi leveringsinformasjon for bestillingen din.")}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Driving distance sits beside the address it's calculated from —
            plain text rather than a (read-only) input, so it doesn't read as
            something the customer can edit. Stacks under it on phones. */}
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <AddressLabel>{t("Delivery address", "Leveringsadresse")}</AddressLabel>
            <AddressAutocompleteInput
              value={deliveryAddress}
              onChange={setDeliveryAddress}
              locale={bookingLocale}
              placeholder={t("Your address", "Din adresse")}
              icon={<PinIcon />}
            />
          </div>

          <div className={sideColumnClass}>
            <FieldLabel
              icon={<WarningTriangleIcon className="h-4 w-4" />}
              hint={t(
                "Calculated automatically along every pickup address, then the delivery address.",
                "Beregnes automatisk via alle hentestedene og deretter leveringsadressen.",
              )}
            >
              {t("Driving distance", "Kjøreavstand")}
            </FieldLabel>
            {/* h-12.5 matches the address autocomplete input beside it. */}
            <p className="flex h-12.5 items-center text-sm" aria-live="polite">
              {drivingDistanceLoading ? (
                <span className="text-black/40">{t("Calculating…", "Beregner…")}</span>
              ) : drivingDistance ? (
                <span className="text-base font-semibold text-black/80">{drivingDistance} km</span>
              ) : (
                <span className="text-black/40">{t("Fill in the addresses", "Fyll inn adressene")}</span>
              )}
            </p>
          </div>
        </div>

        <FloorLiftField
          locale={locale}
          label={t("Delivery floor", "Etasje ved levering")}
          hint={t(
            "Ground floor is 0. Without a lift, floors above the 2nd add a surcharge.",
            "Bakkeplan er 0. Uten heis tilkommer et tillegg for etasjer over 2.",
          )}
          floorValue={deliveryFloor}
          onFloorChange={setDeliveryFloor}
          liftChecked={deliveryLiftAvailable}
          onLiftChange={setDeliveryLiftAvailable}
          surchargePerFloor={floorSurchargePerFloor}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel icon={<CalendarIcon className="h-4 w-4" />}>{t("Requested date", "Ønsket dato")}</FieldLabel>
            <DatePicker
              value={preferredDate}
              onChange={setPreferredDate}
              locale={locale}
              placeholder={t("Select a date", "Velg en dato")}
              className={inputClass}
              minDate={addDaysIso(getOsloDateKey(), 1)}
              blockedWeekdays={[0]}
              isDateBlocked={isNorwegianPublicHoliday}
            />
          </label>
          <label className="block">
            <FieldLabel icon={<ClockIcon className="h-4 w-4" />}>{t("Time window", "Tidsvindu")}</FieldLabel>
            <TimeWindowField locale={locale} value={timeWindow} onChange={setTimeWindow} />
          </label>
        </div>
      </div>
    </div>
  );
}

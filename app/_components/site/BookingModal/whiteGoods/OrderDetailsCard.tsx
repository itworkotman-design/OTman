"use client";

import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import { PinIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { CalendarIcon, ClockIcon, DocumentIcon, WarningTriangleIcon } from "./orderDetailsIcons";
import { AddressLabel, FieldLabel, inputClass } from "./formFieldStyles";
import { FloorLiftField } from "./floorLiftField";

type Props = {
  locale: Locale;
  bookingLocale: BookingUiLocale;
  // The pickup address (and, for private/business, the pickup floor/lift)
  // are collected earlier, in the pickup-contact step — this card only asks
  // about delivery.
  deliveryAddress: string;
  setDeliveryAddress: (value: string) => void;
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

        <FloorLiftField
          locale={locale}
          label={t("Delivery floor", "Etasje ved levering")}
          floorValue={deliveryFloor}
          onFloorChange={setDeliveryFloor}
          liftChecked={deliveryLiftAvailable}
          onLiftChange={setDeliveryLiftAvailable}
        />

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

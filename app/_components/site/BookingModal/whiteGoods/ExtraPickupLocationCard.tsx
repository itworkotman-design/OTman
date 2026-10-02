"use client";

import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { RevealSection } from "../SteppedModal";
import { PickupContactCard, type PickupProductPoolSection } from "./PickupContactCard";
import { PickupSourceStep, pickupAddressPlaceholder } from "./PickupSourceStep";
import type { PickupLocationState } from "./pickupLocations";

// One pickup stop beyond the first — same source-then-contact shape as the
// top-level pickup-source/pickup-contact steps, just rendered as a single
// stacked card (inside the outer "pickup-contact" step's own AnimatedStack)
// instead of two separate wizard steps, since there can be several of these.
export function ExtraPickupLocationCard({
  locale,
  bookingLocale,
  index,
  location,
  productPoolSections,
  floorSurchargePerFloor,
  onChange,
}: {
  locale: Locale;
  bookingLocale: BookingUiLocale;
  // 0 for the second overall pickup location, 1 for the third, and so on.
  index: number;
  location: PickupLocationState;
  productPoolSections: PickupProductPoolSection[];
  floorSurchargePerFloor: number;
  onChange:(patch: Partial<PickupLocationState>) => void;
}) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  return (
    <div className="rounded-2xl border border-dashed border-logoblue/30 p-4 sm:p-5">
      <h5 className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-logoblue/70">
        {t("Pickup location", "Hentested")} {index + 2}
      </h5>

      <PickupSourceStep locale={locale} value={location.source} onPick={(next) => onChange({ source: next })} />

      <RevealSection collapsed={!location.source} spacing={0}>
        {location.source && (
          <div className="mt-4">
            <PickupContactCard
              locale={locale}
              bookingLocale={bookingLocale}
              pickupSource={location.source}
              pickupPlaceName={location.placeName}
              setPickupPlaceName={(value) => onChange({ placeName: value })}
              pickupAddress={location.address}
              setPickupAddress={(value, wasSelected) => onChange({ address: value, addressSelected: Boolean(wasSelected) })}
              pickupAddressSelected={location.addressSelected}
              pickupAddressPlaceholder={pickupAddressPlaceholder(locale, location.source)}
              pickupFloor={location.floor}
              setPickupFloor={(value) => onChange({ floor: value })}
              pickupLiftAvailable={location.liftAvailable}
              setPickupLiftAvailable={(value) => onChange({ liftAvailable: value })}
              pickupContactName={location.contactName}
              setPickupContactName={(value) => onChange({ contactName: value })}
              pickupContactPhone={location.contactPhone}
              setPickupContactPhone={(value) => onChange({ contactPhone: value })}
              productPoolSections={productPoolSections}
              allRemainingHere={location.allRemainingHere}
              setAllRemainingHere={(value) => onChange({ allRemainingHere: value })}
              selectedCardIds={location.selectedCardIds}
              setSelectedCardIds={(ids) => onChange({ selectedCardIds: ids })}
              allRemainingLabel={t(
                "All the remaining products are picked up here",
                "Alle de resterende varene hentes her",
              )}
              floorSurchargePerFloor={floorSurchargePerFloor}
            />
          </div>
        )}
      </RevealSection>
    </div>
  );
}

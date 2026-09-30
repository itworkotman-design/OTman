"use client";

import { useState } from "react";
import PickupAddressAutocomplete from "./PickupAddressAutocomplete";
import { BuildingIcon, PinIcon } from "@/app/_components/Dahsboard/booking/create/fieldIcons";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { PersonIcon, PhoneIcon } from "./orderDetailsIcons";
import { AddressLabel, FieldLabel, fieldClass } from "./formFieldStyles";
import { FloorLiftField } from "./floorLiftField";
import { ProductIcon } from "./productIcons";
import type { PickupSource } from "./PickupSourceStep";

// One product card offerable to a pickup location's checklist — see
// pickupLocations.ts's per-card (not per-product) assignment.
export type PickupProductChoice = { cardId: number; name: string; code: string; iconKey: string | null };
// Checklist items grouped by price-list category (e.g. white goods vs.
// furniture) — `label` is null when there's nothing worth grouping by
// (a single category on the order), in which case the checklist renders flat.
export type PickupProductPoolSection = { label: string | null; items: PickupProductChoice[] };

type Props = {
  locale: Locale;
  bookingLocale: BookingUiLocale;
  // Always set by the time this step is reached — it follows the required
  // pickup-source step.
  pickupSource: PickupSource;
  // The store's or business's name — same field either way, just relabeled.
  pickupPlaceName: string;
  setPickupPlaceName: (value: string) => void;
  pickupAddress: string;
  // wasSelected: whether the text was actually picked from the address
  // suggestions (vs. free-typed) — see AddressAutocompleteInput.
  setPickupAddress: (value: string, wasSelected?: boolean) => void;
  // Whether pickupAddress was actually picked from the suggestions — a
  // free-typed address that was never selected isn't good enough to advance
  // (see isPickupContactStepReady).
  pickupAddressSelected: boolean;
  // Reflects the pickup-source answer above so the field reads less
  // generically (e.g. "Store address" vs. "Their address").
  pickupAddressPlaceholder: string;
  // A store pickup skips the floor/lift question — a store always has
  // loading access, so there's nothing useful to ask (only shown for
  // private/business, derived from pickupSource below).
  pickupFloor: number;
  setPickupFloor: (value: number) => void;
  pickupLiftAvailable: boolean;
  setPickupLiftAvailable: (value: boolean) => void;
  pickupContactName: string;
  setPickupContactName: (value: string) => void;
  pickupContactPhone: string;
  setPickupContactPhone: (value: string) => void;
  // The other product cards on the order this location could claim, grouped
  // by category — omitted (or one card or fewer total) when there's nothing
  // to choose between, which hides the checkbox and checklist below
  // entirely. See pickupLocations.ts.
  productPoolSections?: PickupProductPoolSection[];
  allRemainingHere: boolean;
  setAllRemainingHere: (value: boolean) => void;
  selectedCardIds: number[];
  setSelectedCardIds: (ids: number[]) => void;
  // "All products are picked up here" for the first location, "All the
  // remaining products are picked up here" for the ones after (whose pool
  // is already just whatever earlier locations left unclaimed).
  allRemainingLabel: string;
};

export function PickupContactCard({
  locale,
  bookingLocale,
  pickupSource,
  pickupPlaceName,
  setPickupPlaceName,
  pickupAddress,
  setPickupAddress,
  pickupAddressSelected,
  pickupAddressPlaceholder,
  pickupFloor,
  setPickupFloor,
  pickupLiftAvailable,
  setPickupLiftAvailable,
  pickupContactName,
  setPickupContactName,
  pickupContactPhone,
  setPickupContactPhone,
  productPoolSections,
  allRemainingHere,
  setAllRemainingHere,
  selectedCardIds,
  setSelectedCardIds,
  allRemainingLabel,
}: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  const showPlaceName = pickupSource === "store" || pickupSource === "business";
  const showContactPerson = pickupSource === "private" || pickupSource === "business";
  const showPickupFloor = pickupSource !== "store";

  // Every field here is required (given the pickup source) — a field only
  // glows red once the visitor has left it (blurred) still empty, not while
  // they're still typing into it for the first time.
  const [touched, setTouched] = useState({
    placeName: false,
    address: false,
    contactName: false,
    contactPhone: false,
  });
  const markTouched = (field: keyof typeof touched) => setTouched((prev) => ({ ...prev, [field]: true }));

  const placeNameError = showPlaceName && touched.placeName && !pickupPlaceName.trim();
  const addressMissing = touched.address && !pickupAddress.trim();
  // Typed but never picked from the suggestions — same red state as an
  // empty field, plus a hint below explaining why (see
  // isPickupContactStepReady, which blocks advancing either way).
  const addressNotSelected = touched.address && !!pickupAddress.trim() && !pickupAddressSelected;
  const addressError = addressMissing || addressNotSelected;
  const contactNameError = showContactPerson && touched.contactName && !pickupContactName.trim();
  const contactPhoneError = showContactPerson && touched.contactPhone && !pickupContactPhone.trim();

  const placeNameLabel = pickupSource === "store" ? t("Store name", "Butikknavn") : t("Business name", "Firmanavn");
  const placeNamePlaceholder =
    pickupSource === "store" ? t("e.g. Power Grünerløkka", "f.eks. Power Grünerløkka") : t("e.g. Acme AS", "f.eks. Acme AS");

  const title =
    pickupSource === "store"
      ? t("What's the store called?", "Hva heter butikken?")
      : pickupSource === "business"
        ? t("Tell us about the business", "Fortell oss om bedriften")
        : t("Who's our contact for the pickup?", "Hvem er kontaktpersonen for hentingen?");

  const subtitle =
    pickupSource === "store"
      ? t("So our driver knows exactly where to go.", "Slik at sjåføren vår vet nøyaktig hvor de skal.")
      : t(
          "Someone we can reach if the driver needs to call ahead.",
          "Noen vi kan nå hvis sjåføren må ringe på forhånd.",
        );

  return (
    <div
      className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6"
      // Moving on from the whole card (not just one field) — focus leaving
      // it entirely — flags every required field at once, so a visitor who
      // skips straight past an empty one without ever focusing it still
      // sees it glow red.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setTouched({ placeName: true, address: true, contactName: true, contactPhone: true });
        }
      }}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/5 text-logoblue">
          <PersonIcon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-black/85">{title}</h3>
          <p className="text-sm text-black/50">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {showPlaceName && (
          <label className="block">
            <FieldLabel icon={<BuildingIcon />}>{placeNameLabel}</FieldLabel>
            <input
              type="text"
              value={pickupPlaceName}
              onChange={(e) => setPickupPlaceName(e.target.value)}
              onBlur={() => markTouched("placeName")}
              placeholder={placeNamePlaceholder}
              className={fieldClass(placeNameError)}
            />
          </label>
        )}

        <div>
          <AddressLabel>{t("Pickup address", "Hentested")}</AddressLabel>
          <PickupAddressAutocomplete
            value={pickupAddress}
            onChange={setPickupAddress}
            onBlur={() => markTouched("address")}
            hasError={addressError}
            locale={bookingLocale}
            placeholder={pickupAddressPlaceholder}
            icon={<PinIcon />}
          />
          {addressNotSelected && (
            <p className="mt-1.5 text-xs text-red-500">
              {t(
                "Please choose an address from the suggestions.",
                "Velg en adresse fra forslagene.",
              )}
            </p>
          )}
        </div>

        {showPickupFloor && (
          <FloorLiftField
            locale={locale}
            label={t("Pickup floor", "Etasje ved henting")}
            floorValue={pickupFloor}
            onFloorChange={setPickupFloor}
            liftChecked={pickupLiftAvailable}
            onLiftChange={setPickupLiftAvailable}
          />
        )}

        {showContactPerson && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel icon={<PersonIcon className="h-4 w-4" />}>{t("Contact person", "Kontaktperson")}</FieldLabel>
              <input
                type="text"
                value={pickupContactName}
                onChange={(e) => setPickupContactName(e.target.value)}
                onBlur={() => markTouched("contactName")}
                placeholder={t("Full name", "Fullt navn")}
                className={fieldClass(contactNameError)}
              />
            </label>
            <label className="block">
              <FieldLabel icon={<PhoneIcon className="h-4 w-4" />}>{t("Phone", "Telefon")}</FieldLabel>
              <input
                type="tel"
                value={pickupContactPhone}
                onChange={(e) => setPickupContactPhone(e.target.value)}
                onBlur={() => markTouched("contactPhone")}
                placeholder={t("e.g. 412 34 567", "f.eks. 412 34 567")}
                className={fieldClass(contactPhoneError)}
              />
            </label>
          </div>
        )}

        {productPoolSections && productPoolSections.reduce((n, s) => n + s.items.length, 0) > 1 && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allRemainingHere}
                onChange={(e) => setAllRemainingHere(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="font-medium text-black/75">{allRemainingLabel}</span>
            </label>

            {!allRemainingHere && (
              <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-black/2 p-3">
                <p className="text-xs font-medium text-black/50">
                  {t("Which of these are picked up here?", "Hvilke av disse hentes her?")}
                </p>
                {productPoolSections.map((section, i) => (
                  <div key={section.label ?? i} className="flex flex-col gap-1.5">
                    {section.label && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-black/40">{section.label}</p>
                    )}
                    {section.items.map((item) => {
                      const checked = selectedCardIds.includes(item.cardId);
                      return (
                        <label key={item.cardId} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedCardIds(
                                e.target.checked
                                  ? [...selectedCardIds, item.cardId]
                                  : selectedCardIds.filter((id) => id !== item.cardId),
                              )
                            }
                            className="h-4 w-4 shrink-0"
                          />
                          <ProductIcon code={item.code} iconKey={item.iconKey} className="h-5 w-5 shrink-0 text-logoblue" />
                          <span>{item.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ))}
                {selectedCardIds.length === 0 && (
                  <p className="text-xs text-black/40">{t("Choose at least one.", "Velg minst én.")}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Whether this step's required fields are filled, given the pickup source —
// used to gate auto-advance the same way every other required step does.
export function isPickupContactStepReady(params: {
  pickupSource: PickupSource | null;
  pickupPlaceName: string;
  pickupAddress: string;
  // A free-typed address that was never picked from the suggestions isn't
  // good enough to advance on — see AddressAutocompleteInput.
  pickupAddressSelected: boolean;
  pickupContactName: string;
  pickupContactPhone: string;
}): boolean {
  const {
    pickupSource,
    pickupPlaceName,
    pickupAddress,
    pickupAddressSelected,
    pickupContactName,
    pickupContactPhone,
  } = params;
  if (!pickupSource) return false;
  if (!pickupAddress.trim() || !pickupAddressSelected) return false;

  const placeNameOk = pickupSource === "private" || pickupPlaceName.trim().length > 0;
  const contactOk =
    pickupSource === "store" ||
    (pickupContactName.trim().length > 0 && pickupContactPhone.trim().length > 0);

  return placeNameOk && contactOk;
}

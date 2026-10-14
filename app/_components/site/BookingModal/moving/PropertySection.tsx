"use client";

import { useState } from "react";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import {
  MOVING_HOME_TYPES,
  MOVING_PARKING_OPTIONS,
  movingLiftApplies,
  isMovingEndReady,
  isMovingEndWhereReady,
  movingDraftChargeableFloors,
  type MovingParkingCode,
  type MovingPropertyDraft,
} from "@/lib/orders/movingProperty";
import { sanitizeTextInput } from "@/lib/orders/websiteOrderValidation";
import { AutoAdvance } from "../AutoAdvance";
import { FloorInput } from "../whiteGoods/floorLiftField";
import { HouseIllustration } from "./HouseIllustration";
import { HOUSE_MAX_FLOORS, HOUSE_MIN_FLOORS, clampFloors } from "./houseGeometry";

// Shared by both of an end's sections.
type SectionProps = {
  locale: Locale;
  value: MovingPropertyDraft;
  onChange: (next: MovingPropertyDraft) => void;
  // SteppedModal's onComplete/onUncomplete: the next section appears as
  // soon as every required field here is answered, and goes away again if
  // one is cleared (AutoAdvance) — same as the delivery modal.
  onReady: () => void;
  onRetract: () => void;
};

type WhereProps = SectionProps & {
  address: string;
  // `selected`: picked from the autocomplete suggestions (not free-typed) —
  // required before the next section opens, as in the delivery modal.
  addressSelected: boolean;
  onAddressChange: (address: string, selected: boolean) => void;
  addressPlaceholder: string;
};

type DetailsProps = SectionProps & {
  // The end counts as answered only with a picked address too (it was
  // asked in the section before).
  address: string;
  addressSelected: boolean;
  sizeOptions: MovingCatalogOption[];
  // Shown on the size tiles when given (the origin is what's priced);
  // omitted for the destination, whose size is information for staff only.
  sizePrice?: (option: MovingCatalogOption) => string;
  // The customer-facing surcharge for this many chargeable floors, formatted
  // (VAT mode applied by the caller, rounded on the line like the charge),
  // or null for none — shown live next to the "which floor?" box, like the
  // delivery modal.
  floorSurchargeLabel: (chargeableFloors: number) => string | null;
  // The carrying-distance surcharge for a parking answer, formatted the same
  // way, or null when it's free — shown on the parking pills.
  parkingPriceLabel: (parking: MovingParkingCode) => string | null;
  catalogLoading: boolean;
  catalogError: string | null;
};

export function floorsLabel(locale: Locale, n: number) {
  return locale === "no" ? `${n} ${n === 1 ? "etasje" : "etasjer"}` : `${n} ${n === 1 ? "floor" : "floors"}`;
}

// "Leilighet, Under 40 m², 1 etasje, i 4. etasje, heis: ja, parkering: innen 50 m" — the
// customer-facing twin of movingPropertyLine, for the summary step.
export function propertySummary(locale: Locale, draft: MovingPropertyDraft, sizeOptions: MovingCatalogOption[]): string {
  const no = locale === "no";
  const homeType = MOVING_HOME_TYPES.find((h) => h.code === draft.homeType);
  const size = sizeOptions.find((o) => o.code === draft.sizeOptionCode);
  const parking = MOVING_PARKING_OPTIONS.find((p) => p.code === draft.parking);
  const lift =
    movingLiftApplies(draft.homeType) && draft.hasLift !== null
      ? `${no ? "heis" : "lift"}: ${draft.hasLift ? (no ? "ja" : "yes") : no ? "nei" : "no"}`
      : null;
  const floorNumber =
    movingLiftApplies(draft.homeType) && draft.floorNumber !== null
      ? no
        ? `i ${draft.floorNumber}. etasje`
        : `on floor ${draft.floorNumber}`
      : null;
  return [
    homeType && (no ? homeType.labelNo : homeType.labelEn),
    size && (no ? size.labelNo : size.labelEn),
    floorsLabel(locale, draft.floors),
    floorNumber,
    lift,
    parking && `${no ? "parkering" : "parking"}: ${(no ? parking.labelNo : parking.labelEn).toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="pt-1 text-center text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{children}</p>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`w-full rounded-full border px-4 py-2 text-center text-sm font-semibold transition ${
        active ? "border-logoblue bg-logoblue text-white" : "border-black/10 bg-white text-logoblue hover:border-logoblue/40"
      }`}
    >
      {children}
    </button>
  );
}

// Each end of the move (MovingRequestFlow's "moving from" and "moving to")
// is asked in two sections, so neither reveals too much at once:
// PropertyWhereSection (address + property type), then
// PropertyDetailsSection (size + floors with the house preview, then for
// apartments/offices which floor it's on and then the lift, and parking).
export function PropertyWhereSection({
  locale,
  address,
  addressSelected,
  onAddressChange,
  addressPlaceholder,
  value,
  onChange,
  onReady,
  onRetract,
}: WhereProps) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const set = (patch: Partial<MovingPropertyDraft>) => onChange({ ...value, ...patch });
  const isReady = isMovingEndWhereReady({ address, addressSelected, property: value });
  const [addressTouched, setAddressTouched] = useState(false);
  const addressNotSelected = addressTouched && !!address.trim() && !addressSelected;

  return (
    <div className="flex flex-col gap-3">
      <AddressAutocompleteInput
        value={address}
        onChange={(v, wasSelected) => onAddressChange(sanitizeTextInput(v), Boolean(wasSelected))}
        locale={locale === "no" ? "nb" : "en"}
        placeholder={addressPlaceholder}
        onBlur={() => setAddressTouched(true)}
        // Not clipped by the modal under this short section (see `floating`).
        floating
        hasError={addressNotSelected}
      />
      {/* Typed but never picked from the suggestions — same hint as the delivery modal. */}
      {addressNotSelected && (
        <p className="-mt-1.5 text-xs text-red-500">
          {t("Please choose an address from the suggestions.", "Velg en adresse fra forslagene.")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MOVING_HOME_TYPES.map((h) => (
          <Chip key={h.code} active={value.homeType === h.code} onClick={() => set({ homeType: h.code })}>
            {locale === "no" ? h.labelNo : h.labelEn}
          </Chip>
        ))}
      </div>

      <AutoAdvance ready={isReady} onReady={onReady} onRetract={onRetract} />
    </div>
  );
}

export function PropertyDetailsSection({
  locale,
  address,
  addressSelected,
  value,
  onChange,
  sizeOptions,
  sizePrice,
  floorSurchargeLabel,
  parkingPriceLabel,
  catalogLoading,
  catalogError,
  onReady,
  onRetract,
}: DetailsProps) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const set = (patch: Partial<MovingPropertyDraft>) => onChange({ ...value, ...patch });
  const isReady = isMovingEndReady({ address, addressSelected, property: value });
  const [floorTouched, setFloorTouched] = useState(false);
  const floorSurcharge = floorSurchargeLabel(movingDraftChargeableFloors(value));
  const stepButton =
    "flex h-8 w-8 items-center justify-center rounded-full border border-logoblue/30 bg-white text-lg font-semibold text-logoblue transition hover:border-logoblue disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="flex flex-col gap-3">
      {catalogLoading && <p className="text-sm text-black/50">{t("Loading sizes…", "Laster størrelser…")}</p>}
      {catalogError && <p className="text-sm text-red-600">{catalogError}</p>}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
        <div className="grid gap-2 md:grid-cols-2">
          {sizeOptions.map((option) => {
            const active = value.sizeOptionCode === option.code;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => set({ sizeOptionCode: option.code })}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  active ? "border-logoblue bg-logoblue text-white" : "border-black/8 bg-white text-textColor"
                }`}
              >
                <span className="font-semibold">{locale === "no" ? option.labelNo : option.labelEn}</span>
                {sizePrice && <span className={active ? "text-white/90" : "text-black/50"}>{sizePrice(option)}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2 rounded-2xl bg-logoblue/5 px-3 py-3">
          <HouseIllustration
            sizeCode={value.sizeOptionCode}
            floors={value.floors}
            homeType={value.homeType}
            className="h-auto w-full max-w-50"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set({ floors: clampFloors(value.floors - 1) })}
              disabled={value.floors <= HOUSE_MIN_FLOORS}
              aria-label={t("Remove a floor", "Fjern en etasje")}
              className={stepButton}
            >
              −
            </button>
            <span className="min-w-18 text-center text-sm font-semibold text-logoblue" aria-live="polite">
              {floorsLabel(locale, value.floors)}
            </span>
            <button
              type="button"
              onClick={() => set({ floors: clampFloors(value.floors + 1) })}
              disabled={value.floors >= HOUSE_MAX_FLOORS}
              aria-label={t("Add a floor", "Legg til en etasje")}
              className={stepButton}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Apartments/offices: which floor first, then — once that's
          answered — the lift. Without a lift the floor costs extra (same rule
          and floor box as the delivery modal). */}
      {movingLiftApplies(value.homeType) && (
        <>
          <SubHeading>{t("Which floor is it on?", "Hvilken etasje ligger den i?")}</SubHeading>
          {/* The box keeps one fixed, centred width; the surcharge pill sits in
              the column beside it instead of squeezing it when it appears. */}
          <div className="grid w-full grid-cols-[1fr_minmax(0,22rem)_1fr] items-center gap-2">
            <div className="col-start-2">
              <FloorInput
                value={value.floorNumber}
                onChange={(floorNumber) => set({ floorNumber })}
                onBlur={() => setFloorTouched(true)}
                hasError={floorTouched && value.floorNumber === null}
                placeholder={t("e.g. 1 for the ground floor", "f.eks. 1 for bakkeplan")}
                large
              />
            </div>
            {floorSurcharge && (
              <span className="justify-self-start whitespace-nowrap rounded-lg bg-amber-50 px-2.5 py-2 text-sm font-semibold text-amber-700">
                +{floorSurcharge}
              </span>
            )}
          </div>
          <p className="-mt-1 text-center text-xs text-black/45">
            {t(
              "1 is the ground floor, -1 the basement. Without a lift, floors above the 2nd or below the 1st basement add a surcharge.",
              "1. etasje er bakkeplan, -1 er kjeller. Uten heis tilkommer et tillegg for etasjer over 2. og under -1.",
            )}
          </p>

          {value.floorNumber !== null && (
            <>
              <SubHeading>{t("Is there a lift?", "Er det heis?")}</SubHeading>
              <div className="grid grid-cols-2 gap-2">
                <Chip active={value.hasLift === true} onClick={() => set({ hasLift: true })}>
                  {t("Yes", "Ja")}
                </Chip>
                <Chip active={value.hasLift === false} onClick={() => set({ hasLift: false })}>
                  {t("No", "Nei")}
                </Chip>
              </div>
            </>
          )}
        </>
      )}

      <SubHeading>{t("How close can we park?", "Hvor nær kan vi parkere?")}</SubHeading>
      <div className="grid grid-cols-3 gap-2">
        {MOVING_PARKING_OPTIONS.map((p) => {
          const price = parkingPriceLabel(p.code);
          const active = value.parking === p.code;
          return (
            <Chip key={p.code} active={active} onClick={() => set({ parking: p.code })}>
              {locale === "no" ? p.labelNo : p.labelEn}
              {price && <span className={`ml-1.5 font-normal ${active ? "text-white/80" : "text-black/45"}`}>+{price}</span>}
            </Chip>
          );
        })}
      </div>

      <AutoAdvance ready={isReady} onReady={onReady} onRetract={onRetract} />
    </div>
  );
}

"use client";

import { useState } from "react";
import AddressAutocompleteInput from "@/app/_components/Dahsboard/booking/create/AddressAutocompleteInput";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { MovingCatalogOption } from "@/lib/content/getMovingCatalog";
import {
  MOVING_HOME_TYPES,
  MOVING_PARKING_OPTIONS,
  movingLiftApplies,
  movingLiftRequired,
  isMovingEndReady,
  isMovingEndWhereReady,
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
  // No prices on the size tiles, next to the floor box or on the parking
  // pills — the live calculator beside the flow already shows them.
  sizeOptions: MovingCatalogOption[];
  catalogLoading: boolean;
  catalogError: string | null;
};

export function floorsLabel(locale: Locale, n: number) {
  return locale === "no" ? `${n} ${n === 1 ? "etasje" : "etasjer"}` : `${n} ${n === 1 ? "floor" : "floors"}`;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="pt-1 text-center text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{children}</p>;
}

function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`w-full rounded-full border px-4 py-2 text-center text-sm font-semibold transition ${className} ${
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
// apartments/offices which floor + lift in one row, and parking).
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
  catalogLoading,
  catalogError,
  onReady,
  onRetract,
}: DetailsProps) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const set = (patch: Partial<MovingPropertyDraft>) => onChange({ ...value, ...patch });
  const isReady = isMovingEndReady({ address, addressSelected, property: value });
  const [floorTouched, setFloorTouched] = useState(false);
  const liftAsked = movingLiftRequired(value.floorNumber);
  const stepButton =
    "flex h-8 w-8 items-center justify-center rounded-full border border-logoblue/30 bg-white text-lg font-semibold text-logoblue transition hover:border-logoblue disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="flex flex-col gap-3">
      {catalogLoading && <p className="text-sm text-black/50">{t("Loading sizes…", "Laster størrelser…")}</p>}
      {catalogError && <p className="text-sm text-red-600">{catalogError}</p>}

      {/* Size tiles, then (apartments/offices) the floor and lift questions on the
          left; the house preview fills the column on the right beside all of them. */}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid gap-2 md:grid-cols-2">
            {sizeOptions.map((option) => {
              const active = value.sizeOptionCode === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => set({ sizeOptionCode: option.code })}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    active ? "border-logoblue bg-logoblue text-white" : "border-black/8 bg-white text-textColor"
                  }`}
                >
                  {locale === "no" ? option.labelNo : option.labelEn}
                </button>
              );
            })}
          </div>

        {/* Apartments/offices: which floor + lift side by side in one row.
            Without a lift the floor costs extra (same rule and floor box as
            the delivery modal). On the ground floor the lift isn't asked
            (movingLiftRequired): its column animates to zero width and the
            floor box takes the whole row; any other floor eases it back. */}
        {movingLiftApplies(value.homeType) && (
          <div
            className={`grid transition-[grid-template-columns,column-gap] duration-300 ease-in-out ${
              liftAsked ? "grid-cols-[1fr_1fr] gap-x-3" : "grid-cols-[1fr_0fr] gap-x-0"
            }`}
          >
            <div className="flex min-w-0 flex-col gap-2">
              <SubHeading>{t("Which floor?", "Hvilken etasje?")}</SubHeading>
              <FloorInput
                value={value.floorNumber}
                onChange={(floorNumber) => set({ floorNumber })}
                onBlur={() => setFloorTouched(true)}
                hasError={floorTouched && value.floorNumber === null}
                placeholder={t("e.g. 1", "f.eks. 1")}
                large
                stepperLeft
              />
            </div>
            <div
              className={`flex min-w-0 flex-col gap-2 overflow-hidden whitespace-nowrap transition-opacity duration-300 ${
                liftAsked ? "opacity-100" : "opacity-0"
              }`}
              // Off screen: out of the tab order and the accessibility tree.
              inert={!liftAsked}
            >
              <SubHeading>{t("Lift?", "Heis?")}</SubHeading>
              <div className="grid grid-cols-2 gap-2">
                <Chip active={value.hasLift === true} onClick={() => set({ hasLift: true })} className="h-12">
                  {t("Yes", "Ja")}
                </Chip>
                <Chip active={value.hasLift === false} onClick={() => set({ hasLift: false })} className="h-12">
                  {t("No", "Nei")}
                </Chip>
              </div>
            </div>
          </div>
        )}
        </div>

        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-logoblue/5 px-3 py-3">
          <HouseIllustration
            sizeCode={value.sizeOptionCode}
            floors={value.floors}
            homeType={value.homeType}
            floorNumber={movingLiftApplies(value.homeType) ? value.floorNumber : null}
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

      <SubHeading>{t("How close can we park?", "Hvor nær kan vi parkere?")}</SubHeading>
      <div className="grid grid-cols-3 gap-2">
        {MOVING_PARKING_OPTIONS.map((p) => (
          <Chip key={p.code} active={value.parking === p.code} onClick={() => set({ parking: p.code })}>
            {locale === "no" ? p.labelNo : p.labelEn}
          </Chip>
        ))}
      </div>

      <AutoAdvance ready={isReady} onReady={onReady} onRetract={onRetract} />
    </div>
  );
}

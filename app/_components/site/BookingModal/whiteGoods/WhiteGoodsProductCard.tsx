"use client";

import { useMemo } from "react";
import type {
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import {
  WHITE_GOODS_ELECTRONICS_PRODUCTS,
  type WhiteGoodsOptionSeed,
} from "@/lib/content/whiteGoodsElectronics";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { ProductIcon } from "./productIcons";
import { TruckIcon, WrenchIcon, GearIcon } from "./sectionIcons";
import type { DeliveryOptionPreview } from "./deliveryPricePreview";
import { getProductDeliveryType } from "@/lib/products/deliveryTypes";
import { DELIVERY_TYPES } from "@/lib/booking/constants";

// The DB-stored ProductOption/CatalogOption has no field distinguishing a
// mutually-exclusive "type" choice (radio) from a stackable add-on
// (checkbox) — only the seed data module (WHITE_GOODS_ELECTRONICS_PRODUCTS)
// carries that (exclusiveGroup). This component cross-references catalog
// options by code against that same data purely for that metadata + the
// bilingual labels, not for pricing (prices always come from the fetched
// catalog).

type Props = {
  locale: Locale;
  product: CatalogProduct;
  value: SavedProductCard;
  deliveryPreview: { firstStep: DeliveryOptionPreview; indoor: DeliveryOptionPreview };
  onChange: (next: SavedProductCard) => void;
  onRemove: () => void;
};

function seedLabel(locale: Locale, seed: { labelEn: string; labelNo: string }) {
  return locale === "no" ? seed.labelNo : seed.labelEn;
}

function money(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString("nb-NO")} kr` : value;
}

// One selectable row shared by every section below: an icon indicator
// (filled circle for a single-select "radio" group, checkmark square for a
// stackable "checkbox" one), a title + optional description on the left,
// and a price (or "Included") on the right. `bare` drops this row's own
// border/rounding/background — used when a group of rows (a type option
// plus the add-ons it unlocks) shares one outer bordered container instead,
// so the group reads as a single card rather than several stacked ones.
function OptionRow({
  variant,
  selected,
  title,
  description,
  price,
  priceClassName,
  onClick,
  bare,
}: {
  variant: "radio" | "checkbox";
  selected: boolean;
  title: string;
  description?: string;
  price?: string;
  priceClassName?: string;
  onClick: () => void;
  bare?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition",
        bare
          ? (selected ? "bg-logoblue/5" : "hover:bg-black/2")
          : ["rounded-xl border", selected ? "border-logoblue bg-logoblue/5" : "border-black/10 hover:border-black/20"].join(" "),
      ].join(" ")}
    >
      <span className="flex items-start gap-3">
        <span
          className={[
            "mt-0.5 grid h-4 w-4 shrink-0 place-items-center border-2",
            variant === "radio" ? "rounded-full" : "rounded-sm",
            selected ? "border-logoblue bg-logoblue" : "border-black/25 bg-white",
          ].join(" ")}
        >
          {selected && variant === "checkbox" && (
            <span className="text-[10px] leading-none text-white">✓</span>
          )}
        </span>
        <span>
          <span className="block text-sm font-semibold text-black/85">{title}</span>
          {description && <span className="mt-0.5 block text-xs text-black/50">{description}</span>}
        </span>
      </span>
      {price && (
        <span className={["shrink-0 text-sm font-semibold", priceClassName ?? "text-black/70"].join(" ")}>
          {price}
        </span>
      )}
    </button>
  );
}

export function WhiteGoodsProductCard({
  locale,
  product,
  value,
  deliveryPreview,
  onChange,
  onRemove,
}: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  const seedProduct = useMemo(
    () => WHITE_GOODS_ELECTRONICS_PRODUCTS.find((p) => p.code === product.code) ?? null,
    [product],
  );

  const seedByCode = useMemo(() => {
    const map = new Map<string, WhiteGoodsOptionSeed>();
    for (const option of seedProduct?.options ?? []) {
      map.set(option.code, option);
    }
    return map;
  }, [seedProduct]);

  const typeOptions = product.options.filter(
    (o) => o.active && seedByCode.get(o.code)?.exclusiveGroup === "type",
  );

  const selectedTypeCode = typeOptions.find((o) =>
    value.selectedInstallOptionIds.includes(o.id),
  )?.code;

  const stackableInstallOptions = product.options.filter((o) => {
    if (!o.active) return false;
    const seed = seedByCode.get(o.code);
    if (!seed || seed.category !== "install" || seed.exclusiveGroup) return false;
    // TV's 75"-100" mount-on-stand add-on is only relevant alongside those
    // two size-tier type choices.
    if (o.code === "TV_MOUNT_STAND_75_100") {
      return selectedTypeCode === "TV_TABLE_75_100" || selectedTypeCode === "TV_WALL_75_100";
    }
    return true;
  });

  const unpackingOption = product.options.find((o) => o.code === "UNPACKING") ?? null;
  const demontOption = product.options.find((o) => o.code === "DEMONT") ?? null;
  const returnOption = product.options.find(
    (o) => seedByCode.get(o.code)?.category === "return",
  ) ?? null;

  // "Installation only" (no delivery charge — the customer already has the
  // item) is only offered for products that actually have something to
  // install standalone (e.g. not Chest freezer, which has no install types).
  const installOnlyAvailable = !!getProductDeliveryType(
    product.deliveryTypes,
    DELIVERY_TYPES.INSTALL_ONLY,
  )?.enabled;

  const installSelected = value.selectedInstallOptionIds.length > 0;
  const deliveryType = value.deliveryType;
  const showExtras = deliveryType !== "" && !installSelected;
  const showReturn = !!returnOption && deliveryType !== "";

  function setDeliveryType(next: SavedProductCard["deliveryType"]) {
    onChange({
      ...value,
      deliveryType: next,
      selectedInstallOptionIds: [],
      selectedExtraOptionIds: [],
      selectedReturnOptionId: null,
      demontEnabled: false,
    });
  }

  function clearInstallation() {
    onChange({
      ...value,
      selectedInstallOptionIds: [],
    });
  }

  function selectType(optionId: string) {
    const stackableSelected = value.selectedInstallOptionIds.filter((id) =>
      stackableInstallOptions.some((o) => o.id === id),
    );
    onChange({
      ...value,
      // Installation implies carry-in — picking an install type while
      // doorstep delivery (or nothing) is selected switches delivery to
      // carry-in instead of leaving an inconsistent combination. Installation
      // only stays as-is, since the customer already told us there's no
      // delivery for this item.
      deliveryType: value.deliveryType === "INSTALL_ONLY" ? "INSTALL_ONLY" : "INDOOR",
      selectedInstallOptionIds: [optionId, ...stackableSelected],
    });
  }

  function toggleStackableInstall(optionId: string) {
    const has = value.selectedInstallOptionIds.includes(optionId);
    onChange({
      ...value,
      selectedInstallOptionIds: has
        ? value.selectedInstallOptionIds.filter((id) => id !== optionId)
        : [...value.selectedInstallOptionIds, optionId],
    });
  }

  function toggleUnpacking() {
    if (!unpackingOption) return;
    const has = value.selectedExtraOptionIds.includes(unpackingOption.id);
    onChange({
      ...value,
      selectedExtraOptionIds: has
        ? value.selectedExtraOptionIds.filter((id) => id !== unpackingOption.id)
        : [...value.selectedExtraOptionIds, unpackingOption.id],
    });
  }

  function toggleReturn() {
    if (!returnOption) return;
    onChange({
      ...value,
      selectedReturnOptionId:
        value.selectedReturnOptionId === returnOption.id ? null : returnOption.id,
    });
  }

  const productName = seedProduct
    ? seedLabel(locale, { labelEn: seedProduct.nameEn, labelNo: seedProduct.nameNo })
    : product.label;

  return (
    <div className="rounded-2xl border border-black/10 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-logoblue/10">
          <ProductIcon code={product.code} iconKey={product.iconKey} className="h-6 w-6 text-logoblue" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-black/90">
            {t("Configure", "Konfigurer")} {productName}
          </h3>
          <p className="text-sm text-black/50">
            {t("Choose your preferred services and options.", "Velg dine foretrukne tjenester og alternativer.")}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("Remove", "Fjern")}
          className="shrink-0 text-sm text-black/40 hover:text-black/70"
        >
          ×
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black/80">
            <TruckIcon className="h-4 w-4 text-logoblue" />
            {t("Delivery", "Levering")}
          </div>
          <div className="flex flex-col gap-2">
            <OptionRow
              variant="radio"
              selected={deliveryType === "FIRST_STEP"}
              title={
                deliveryPreview.firstStep.isExtra
                  ? t("Extra delivery", "Ekstra levering")
                  : t("Doorstep delivery", "Levering til ytterdør")
              }
              description={t("We deliver to your doorstep.", "Vi leverer til din dør.")}
              price={money(String(deliveryPreview.firstStep.price))}
              onClick={() => setDeliveryType("FIRST_STEP")}
            />
            <OptionRow
              variant="radio"
              selected={deliveryType === "INDOOR"}
              title={
                deliveryPreview.indoor.isExtra
                  ? t("Extra carry-in", "Ekstra innbæring")
                  : t("Carry-in delivery", "Levering med innbæring")
              }
              description={t(
                "We deliver and carry the product inside your home.",
                "Vi leverer og bærer varen inn i hjemmet ditt.",
              )}
              price={money(String(deliveryPreview.indoor.price))}
              onClick={() => setDeliveryType("INDOOR")}
            />
            {installOnlyAvailable && (
              <OptionRow
                variant="radio"
                selected={deliveryType === "INSTALL_ONLY"}
                title={t("Installation only", "Kun montering")}
                description={t(
                  "You already have the item — we just install it.",
                  "Du har allerede varen — vi monterer den bare.",
                )}
                price={t("Included", "Inkludert")}
                priceClassName="text-logoblue"
                onClick={() => setDeliveryType("INSTALL_ONLY")}
              />
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black/80">
            <WrenchIcon className="h-4 w-4 text-logoblue" />
            {t("Installation", "Montering")}
          </div>
          <div className="flex flex-col gap-2">
            <OptionRow
              variant="radio"
              selected={!installSelected}
              title={t("No installation", "Ingen montering")}
              description={t("You handle installation yourself.", "Du monterer selv.")}
              price={t("Included", "Inkludert")}
              priceClassName="text-logoblue"
              onClick={clearInstallation}
            />
            {typeOptions.map((option) => {
              const seed = seedByCode.get(option.code);
              const isSelected = value.selectedInstallOptionIds.includes(option.id);
              const nestedCheckboxes = isSelected ? stackableInstallOptions : [];

              // A type with nothing unlocked renders as a normal standalone
              // row, same as before. A SELECTED type that unlocks add-ons
              // instead renders as one bordered card containing both the
              // radio and its checkboxes (divided by hairlines, not separate
              // boxes) — with several type options, appending every add-on
              // after the whole radio list instead would make it ambiguous
              // which type each checkbox belongs to.
              if (nestedCheckboxes.length === 0) {
                return (
                  <OptionRow
                    key={option.id}
                    variant="radio"
                    selected={isSelected}
                    title={seed ? seedLabel(locale, seed) : option.label}
                    price={money(option.customerPrice)}
                    onClick={() => selectType(option.id)}
                  />
                );
              }

              return (
                <div
                  key={option.id}
                  className="flex flex-col divide-y divide-logoblue/15 overflow-hidden rounded-xl border border-logoblue bg-logoblue/5"
                >
                  <OptionRow
                    variant="radio"
                    selected
                    title={seed ? seedLabel(locale, seed) : option.label}
                    price={money(option.customerPrice)}
                    onClick={() => selectType(option.id)}
                    bare
                  />
                  {nestedCheckboxes.map((stackOption) => {
                    const stackSeed = seedByCode.get(stackOption.code);
                    return (
                      <OptionRow
                        key={stackOption.id}
                        variant="checkbox"
                        selected={value.selectedInstallOptionIds.includes(stackOption.id)}
                        title={stackSeed ? seedLabel(locale, stackSeed) : stackOption.label}
                        price={money(stackOption.customerPrice)}
                        onClick={() => toggleStackableInstall(stackOption.id)}
                        bare
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {(showExtras || showReturn) && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black/80">
              <GearIcon className="h-4 w-4 text-logoblue" />
              {t("Additional services", "Tilleggstjenester")}
            </div>
            <div className="flex flex-col gap-2">
              {showExtras && unpackingOption && (
                <OptionRow
                  variant="checkbox"
                  selected={value.selectedExtraOptionIds.includes(unpackingOption.id)}
                  title={t("Unpack & remove packaging", "Utpakking og kasting av emballasje")}
                  description={t(
                    "We unpack the product and take the packaging with us.",
                    "Vi pakker ut varen og tar med emballasjen.",
                  )}
                  price={money(unpackingOption.customerPrice)}
                  onClick={toggleUnpacking}
                />
              )}
              {showExtras && demontOption && (
                <OptionRow
                  variant="checkbox"
                  selected={value.demontEnabled}
                  title={t("Dismantle old product", "Demontering av gammel vare")}
                  description={t(
                    "We disconnect and remove your old product.",
                    "Vi kobler fra og fjerner den gamle varen din.",
                  )}
                  price={money(demontOption.customerPrice)}
                  onClick={() => onChange({ ...value, demontEnabled: !value.demontEnabled })}
                />
              )}
              {showReturn && returnOption && (
                <OptionRow
                  variant="checkbox"
                  selected={value.selectedReturnOptionId === returnOption.id}
                  title={t("Return old product for recycling", "Retur av gammel vare til gjenvinning")}
                  description={t(
                    "We ensure it's recycled responsibly.",
                    "Vi sørger for at den resirkuleres på en forsvarlig måte.",
                  )}
                  price={money(returnOption.customerPrice)}
                  onClick={toggleReturn}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

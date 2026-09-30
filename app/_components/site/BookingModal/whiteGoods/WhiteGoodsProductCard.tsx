"use client";

import { useMemo, useState } from "react";
import type {
  CatalogOption,
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { deliveryTypeAfterSelectingType } from "@/lib/content/whiteGoodsElectronics";
import type { FurnitureOptionSeed } from "@/lib/content/furnitureCatalog";
import { findWebsiteProductSeed } from "@/lib/content/websiteCatalogs";
import { isAssemblyCompatibleExtraCode } from "@/lib/booking/pricing/websiteAssemblyExtras";
import { isSizeBracketCategory } from "@/lib/booking/pricing/sizeBrackets";
import {
  groupAssemblyOptions,
  groupDismantlingOptions,
  type DismantlingGroup,
} from "./optionGroups";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { ProductIcon } from "./productIcons";
import { buildCardSummaryChips } from "./cardSummaryChips";
import type { DeliveryOptionPreview } from "./deliveryPricePreview";
import { getProductDeliveryType } from "@/lib/products/deliveryTypes";
import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { getVatDisplayAmount, type CustomerType } from "@/lib/booking/pricing/vatDisplayTotal";
import {
  hasExtrasStepContent,
  hasInstallStepContent,
} from "./cardSectionVisibility";

// The DB-stored ProductOption/CatalogOption has no field distinguishing a
// mutually-exclusive "type" choice (radio) from a stackable add-on
// (checkbox) — only the website catalog seed data (white goods + furniture,
// via findWebsiteProductSeed) carries that (exclusiveGroup). This component cross-references catalog
// options by code against that same data purely for that metadata + the
// bilingual labels, not for pricing (prices always come from the fetched
// catalog).

type Props = {
  locale: Locale;
  // Private customers see prices incl. VAT (what they actually pay);
  // business customers see ex-VAT (what they reclaim) — see
  // getVatDisplayAmount.
  customerType: CustomerType;
  product: CatalogProduct;
  value: SavedProductCard;
  deliveryPreview: {
    firstStep: DeliveryOptionPreview;
    indoor: DeliveryOptionPreview;
  };
  onChange: (next: SavedProductCard) => void;
  // The customer can split one product into several differently-configured
  // cards. `variantNumber` (1-based) is set only while the product has more
  // than one card; `onRemove` drops this one; `onAddAnother` is passed to the
  // product's last card only, and renders the "add another" strip below it.
  variantNumber?: number;
  onRemove?: () => void;
  onAddAnother?: () => void;
};

function seedLabel(locale: Locale, seed: { labelEn: string; labelNo: string }) {
  return locale === "no" ? seed.labelNo : seed.labelEn;
}

// One selectable row shared by every section below: a radio circle (single
// select) or checkbox square (stackable), title + optional description on the
// left, and the price (or "Included") on the right.
function OptionRow({
  variant,
  selected,
  title,
  description,
  price,
  priceClassName,
  onClick,
  bare,
  nested,
  disabled,
}: {
  variant: "radio" | "checkbox";
  selected: boolean;
  title: string;
  description?: string;
  price?: string;
  priceClassName?: string;
  onClick: () => void;
  // Drops the row's own border/rounding/background — used when a type option
  // and the add-ons it unlocks share one outer bordered container.
  bare?: boolean;
  // Indents a row that belongs to the row above it (a type's manufacturers).
  nested?: boolean;
  // Shown but not selectable (e.g. unpacking, included in assembly).
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      disabled={disabled}
      className={[
        "flex w-full items-center justify-between gap-3 py-3 text-left transition",
        nested ? "pl-11 pr-4" : "px-4",
        disabled ? "cursor-default opacity-70" : "",
        bare
          ? selected
            ? "bg-logoblue/5"
            : "hover:bg-black/2"
          : [
              "rounded-xl border",
              selected
                ? "border-logoblue/30 bg-logoblue/5"
                : "border-black/10 hover:border-black/20",
            ].join(" "),
      ].join(" ")}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={[
            "grid h-5 w-5 shrink-0 place-items-center border-2",
            variant === "radio" ? "rounded-full" : "rounded-md",
            selected
              ? "border-logoblue bg-logoblue"
              : "border-black/25 bg-white",
          ].join(" ")}
        >
          {selected && variant === "radio" && (
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          )}
          {selected && variant === "checkbox" && (
            <span className="text-[11px] leading-none text-white">✓</span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-black/85">
            {title}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs text-black/50">
              {description}
            </span>
          )}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {price && (
          <span
            className={[
              "whitespace-nowrap text-sm font-semibold",
              priceClassName ?? "text-black/70",
            ].join(" ")}
          >
            {price}
          </span>
        )}
      </span>
    </button>
  );
}

function SectionHeader({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-logoblue text-sm font-semibold text-white">
        {step}
      </span>
      <div>
        <div className="text-sm font-semibold text-black/85">{title}</div>
        <div className="text-xs text-black/50">{subtitle}</div>
      </div>
    </div>
  );
}

export function WhiteGoodsProductCard({
  locale,
  customerType,
  product,
  value,
  deliveryPreview,
  onChange,
  variantNumber,
  onRemove,
  onAddAnother,
}: Props) {
  const [open, setOpen] = useState(true);
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const money = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) ? `${getVatDisplayAmount(n, customerType).toLocaleString("nb-NO")} kr` : raw;
  };

  const seedProduct = useMemo(
    () => findWebsiteProductSeed(product.code),
    [product],
  );

  const seedByCode = useMemo(() => {
    const map = new Map<string, FurnitureOptionSeed>();
    for (const option of seedProduct?.options ?? []) {
      map.set(option.code, option);
    }
    return map;
  }, [seedProduct]);

  const typeOptions = product.options.filter(
    (o) => o.active && seedByCode.get(o.code)?.exclusiveGroup === "type",
  );

  const selectedTypeOption = typeOptions.find((o) =>
    value.selectedInstallOptionIds.includes(o.id),
  );
  const selectedTypeCode = selectedTypeOption?.code;

  const stackableInstallOptions = product.options.filter((o) => {
    if (!o.active) return false;
    const seed = seedByCode.get(o.code);
    if (!seed || seed.category !== "install" || seed.exclusiveGroup)
      return false;
    // TV's 75"-100" mount-on-stand add-on is only relevant alongside those
    // two size-tier type choices.
    if (o.code === "TV_MOUNT_STAND_75_100") {
      return (
        selectedTypeCode === "TV_TABLE_75_100" ||
        selectedTypeCode === "TV_WALL_75_100"
      );
    }
    return true;
  });

  // Size-priced products (Other furniture) get their volume and weight chosen in
  // the "Choose products" tile (WhiteGoodsProductGrid). They live in
  // selectedExtraOptionIds, so changing delivery type below must not clear them.
  const sizeOptionIds = product.options.filter((o) => isSizeBracketCategory(o.category)).map((o) => o.id);

  const unpackingOption =
    product.options.find((o) => o.code === "UNPACKING") ?? null;
  const demontOption = product.options.find((o) => o.code === "DEMONT") ?? null;
  const palletPickupOption =
    product.options.find((o) => o.code === "PALLET_PICKUP") ?? null;
  const returnOption =
    product.options.find(
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

  // Furniture: assembly is a type + manufacturer pick, dismantling comes as
  // paired variants, and dismantling / wall anchoring stay available together
  // with assembly (priced by applyWebsiteAssemblyExtras).
  const isFurniture = product.code.startsWith("FN_");
  const assemblyGroups = groupAssemblyOptions(
    product.options,
    seedByCode,
    locale,
  );
  const dismantlingGroups = groupDismantlingOptions(product.options, locale);
  const anchoringOption =
    product.options.find((o) => o.active && o.code === "WALL_ANCHORING") ??
    null;
  const furnitureAddonsVisible =
    isFurniture &&
    deliveryType !== "" &&
    (!!unpackingOption || dismantlingGroups.length > 0 || !!anchoringOption);

  const showInstallStep = hasInstallStepContent({
    assemblyGroupCount: assemblyGroups.length,
    typeOptionCount: typeOptions.length,
    hasNeedsImplementationNote: !!seedProduct?.needsImplementation,
  });
  const showExtrasStep = hasExtrasStepContent({
    showExtras,
    showReturn,
    furnitureAddonsVisible,
    isFurniture,
    installSelected,
    hasUnpackingOption: !!unpackingOption,
    hasDemontOption: !!demontOption,
    hasPalletPickupOption: !!palletPickupOption,
    dismantlingGroupCount: dismantlingGroups.length,
    hasAnchoringOption: !!anchoringOption,
    hasReturnOption: !!returnOption,
  });
  const extrasStepNumber = showInstallStep ? 3 : 2;

  function setDeliveryType(next: SavedProductCard["deliveryType"]) {
    onChange({
      ...value,
      deliveryType: next,
      selectedInstallOptionIds: [],
      // Changing delivery clears the add-ons, but the item's size/weight
      // describe the item itself and must survive.
      selectedExtraOptionIds: value.selectedExtraOptionIds.filter((id) => sizeOptionIds.includes(id)),
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
    const option = product.options.find((o) => o.id === optionId);
    const seed = option ? seedByCode.get(option.code) : undefined;
    const stackableSelected = value.selectedInstallOptionIds.filter((id) =>
      stackableInstallOptions.some((o) => o.id === id),
    );
    onChange({
      ...value,
      // Installation implies carry-in — picking an install type while
      // doorstep delivery (or nothing) is selected switches delivery to
      // carry-in instead of leaving an inconsistent combination. Installation
      // only stays as-is, and so do standalone options (cooker plug).
      deliveryType: (seed
        ? deliveryTypeAfterSelectingType(seed, value.deliveryType)
        : value.deliveryType) as SavedProductCard["deliveryType"],
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

  function toggleExtraOption(optionId: string) {
    const has = value.selectedExtraOptionIds.includes(optionId);
    onChange({
      ...value,
      selectedExtraOptionIds: has
        ? value.selectedExtraOptionIds.filter((id) => id !== optionId)
        : [...value.selectedExtraOptionIds, optionId],
    });
  }

  // "For disposal" and "careful, for reuse" are alternatives for the same
  // type: choosing one replaces the other, choosing it again clears it.
  function selectDismantling(group: DismantlingGroup, option: CatalogOption) {
    const counterpartId = [group.disposal, group.careful].find(
      (o) => o && o.id !== option.id,
    )?.id;
    const has = value.selectedExtraOptionIds.includes(option.id);
    const rest = value.selectedExtraOptionIds.filter(
      (id) => id !== option.id && id !== counterpartId,
    );
    onChange({
      ...value,
      selectedExtraOptionIds: has ? rest : [...rest, option.id],
    });
  }

  function toggleReturn() {
    if (!returnOption) return;
    onChange({
      ...value,
      selectedReturnOptionId:
        value.selectedReturnOptionId === returnOption.id
          ? null
          : returnOption.id,
    });
  }

  const productName = seedProduct
    ? seedLabel(locale, {
        labelEn: seedProduct.nameEn,
        labelNo: seedProduct.nameNo,
      })
    : product.label;

  const included = t("Included", "Inkludert");

  const selectedTypeSeed = selectedTypeOption
    ? seedByCode.get(selectedTypeOption.code)
    : undefined;
  const addonCount =
    (showExtras
      ? (unpackingOption &&
        value.selectedExtraOptionIds.includes(unpackingOption.id)
          ? 1
          : 0) +
        (value.demontEnabled ? 1 : 0) +
        (palletPickupOption &&
        value.selectedExtraOptionIds.includes(palletPickupOption.id)
          ? 1
          : 0)
      : 0) +
    (showReturn && value.selectedReturnOptionId ? 1 : 0) +
    (isFurniture
      ? product.options.filter(
          (o) =>
            value.selectedExtraOptionIds.includes(o.id) &&
            isAssemblyCompatibleExtraCode(o.code),
        ).length
      : 0) +
    value.selectedInstallOptionIds.filter((id) => id !== selectedTypeOption?.id)
      .length;

  const chips = buildCardSummaryChips({
    locale,
    deliveryType,
    installLabel: selectedTypeOption
      ? selectedTypeSeed
        ? seedLabel(locale, selectedTypeSeed)
        : selectedTypeOption.label
      : null,
    showInstallChip: showInstallStep,
    addonCount,
    sizeInfo: seedProduct?.sizeInfo ?? null,
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      {/* Solid blue title band, so a stack of cards is easy to count. */}
      <div className="flex items-center gap-3 bg-logoblue px-4 py-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
          <ProductIcon
            code={product.code}
            iconKey={product.iconKey}
            className="h-6 w-6 text-white"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            {productName}
            {variantNumber !== undefined && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                #{variantNumber}
              </span>
            )}
            {/* Quantity is changed in "Choose products" only; shown here
                read-only so the card still says how many it is for. */}
            {value.amount > 1 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                {value.amount}×
              </span>
            )}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              {t("Remove", "Fjern")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t("Collapse", "Skjul") : t("Expand", "Vis")}
            className="grid h-8 w-8 place-items-center text-white/70 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={[
                "h-5 w-5 transition-transform duration-300",
                open ? "rotate-180" : "",
              ].join(" ")}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-logoblue/5 px-2.5 py-0.5 text-xs text-black/60"
          >
            {chip}
          </span>
        ))}
      </div>

      {/* Content stays mounted; animating the grid row from 0fr to 1fr grows
          it to its natural height, which a plain height/`open &&` can't. */}
      <div
        className={[
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="mt-4 flex flex-col divide-y divide-black/10 *:py-5 *:first:pt-0 *:last:pb-0">
            <div>
              <SectionHeader
                step={1}
                title={t("Delivery", "Levering")}
                subtitle={t(
                  "How would you like the item delivered?",
                  "Hvordan ønsker du å få varen levert?",
                )}
              />
              <div className="flex flex-col gap-2">
                <OptionRow
                  variant="radio"
                  selected={deliveryType === "FIRST_STEP"}
                  title={
                    deliveryPreview.firstStep.isExtra
                      ? t("Extra delivery", "Ekstra levering")
                      : t("Doorstep delivery", "Levering til ytterdør")
                  }
                  description={t(
                    "We deliver to your doorstep.",
                    "Vi leverer til din dør.",
                  )}
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
                    title={
                      isFurniture
                        ? t("Assembly only", "Kun montering")
                        : t("Installation only", "Kun montering")
                    }
                    description={
                      isFurniture
                        ? t(
                            "You already have the furniture — we just assemble it.",
                            "Du har allerede møblene — vi monterer dem bare.",
                          )
                        : t(
                            "You already have the item — we just install it.",
                            "Du har allerede varen — vi monterer den bare.",
                          )
                    }
                    price={included}
                    priceClassName="text-logoblue"
                    onClick={() => setDeliveryType("INSTALL_ONLY")}
                  />
                )}
              </div>
            </div>

            {showInstallStep && (
            <div>
              <SectionHeader
                step={2}
                title={
                  isFurniture
                    ? t("Assembly", "Montering")
                    : t("Installation", "Montering")
                }
                subtitle={
                  isFurniture
                    ? t(
                        "Should we assemble it for you?",
                        "Skal vi montere den for deg?",
                      )
                    : t(
                        "Should we install it for you?",
                        "Skal vi montere den for deg?",
                      )
                }
              />
              <div className="flex flex-col gap-2">
                <OptionRow
                  variant="radio"
                  selected={!installSelected}
                  title={t("No installation", "Ingen montering")}
                  description={t(
                    "You handle installation yourself.",
                    "Du monterer selv.",
                  )}
                  price={included}
                  priceClassName="text-logoblue"
                  onClick={clearInstallation}
                />
                {assemblyGroups.length > 0
                  ? assemblyGroups.map((group) => {
                      const hasSelection = group.options.some(({ option }) =>
                        value.selectedInstallOptionIds.includes(option.id),
                      );

                      // A type nobody picked yet is one row (from-price); picking
                      // it opens its manufacturers inside one shared container.
                      if (!hasSelection) {
                        return (
                          <OptionRow
                            key={group.key}
                            variant="radio"
                            selected={false}
                            title={group.label}
                            price={`${t("from", "fra")} ${money(String(group.fromPrice))}`}
                            onClick={() =>
                              selectType(group.options[0].option.id)
                            }
                          />
                        );
                      }

                      return (
                        <div
                          key={group.key}
                          className="flex flex-col divide-y divide-logoblue/15 overflow-hidden rounded-xl border border-logoblue/30 bg-logoblue/5"
                        >
                          <OptionRow
                            variant="radio"
                            selected
                            title={group.label}
                            description={t(
                              "Choose the manufacturer:",
                              "Velg produsent:",
                            )}
                            onClick={clearInstallation}
                            bare
                          />
                          {group.options.map(
                            ({ option, manufacturerLabel }) => (
                              <OptionRow
                                key={option.id}
                                variant="radio"
                                selected={value.selectedInstallOptionIds.includes(
                                  option.id,
                                )}
                                title={manufacturerLabel}
                                price={money(option.customerPrice)}
                                onClick={() => selectType(option.id)}
                                bare
                                nested
                              />
                            ),
                          )}
                        </div>
                      );
                    })
                  : typeOptions.map((option) => {
                      const seed = seedByCode.get(option.code);
                      const isSelected =
                        value.selectedInstallOptionIds.includes(option.id);
                      const nestedCheckboxes = isSelected
                        ? stackableInstallOptions
                        : [];

                      // A type with nothing unlocked is a normal standalone row. A
                      // SELECTED type that unlocks add-ons renders as one bordered
                      // card holding both the radio and its checkboxes (hairline
                      // dividers) — with several types, listing every add-on after
                      // the whole radio list would make it ambiguous which type
                      // each checkbox belongs to.
                      if (nestedCheckboxes.length === 0) {
                        return (
                          <OptionRow
                            key={option.id}
                            variant="radio"
                            selected={isSelected}
                            title={
                              seed ? seedLabel(locale, seed) : option.label
                            }
                            price={money(option.customerPrice)}
                            onClick={() => selectType(option.id)}
                          />
                        );
                      }

                      return (
                        <div
                          key={option.id}
                          className="flex flex-col divide-y divide-logoblue/15 overflow-hidden rounded-xl border border-logoblue/30 bg-logoblue/5"
                        >
                          <OptionRow
                            variant="radio"
                            selected
                            title={
                              seed ? seedLabel(locale, seed) : option.label
                            }
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
                                selected={value.selectedInstallOptionIds.includes(
                                  stackOption.id,
                                )}
                                title={
                                  stackSeed
                                    ? seedLabel(locale, stackSeed)
                                    : stackOption.label
                                }
                                price={money(stackOption.customerPrice)}
                                onClick={() =>
                                  toggleStackableInstall(stackOption.id)
                                }
                                bare
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                {seedProduct?.needsImplementation && (
                  <div className="rounded-xl border border-dashed border-black/15 px-4 py-3 text-sm text-black/50">
                    {seedLabel(locale, seedProduct.needsImplementation)}
                  </div>
                )}
              </div>
            </div>
            )}

            {showExtrasStep && (
              <div>
                <SectionHeader
                  step={extrasStepNumber}
                  title={t("Additional services", "Tilleggstjenester")}
                  subtitle={t(
                    "Choose any additional services.",
                    "Velg eventuelle tilleggstjenester.",
                  )}
                />
                <div className="flex flex-col gap-2">
                  {showExtras && unpackingOption && (
                    <OptionRow
                      variant="checkbox"
                      selected={value.selectedExtraOptionIds.includes(
                        unpackingOption.id,
                      )}
                      title={t(
                        "Unpack & remove packaging",
                        "Utpakking og kasting av emballasje",
                      )}
                      description={t(
                        "We unpack the product and take the packaging with us.",
                        "Vi pakker ut varen og tar med emballasjen.",
                      )}
                      price={money(unpackingOption.customerPrice)}
                      onClick={toggleUnpacking}
                    />
                  )}
                  {isFurniture &&
                    !showExtras &&
                    installSelected &&
                    unpackingOption && (
                      <OptionRow
                        variant="checkbox"
                        selected
                        disabled
                        title={t(
                          "Unpack & remove packaging",
                          "Utpakking og kasting av emballasje",
                        )}
                        description={t(
                          "Included in the assembly.",
                          "Inkludert i monteringen.",
                        )}
                        price={included}
                        priceClassName="text-logoblue"
                        onClick={() => {}}
                      />
                    )}
                  {showExtras && demontOption && (
                    <OptionRow
                      variant="checkbox"
                      selected={value.demontEnabled}
                      title={t(
                        "Dismantle old product",
                        "Demontering av gammel vare",
                      )}
                      description={t(
                        "We disconnect and remove your old product.",
                        "Vi kobler fra og fjerner den gamle varen din.",
                      )}
                      price={money(demontOption.customerPrice)}
                      onClick={() =>
                        onChange({
                          ...value,
                          demontEnabled: !value.demontEnabled,
                        })
                      }
                    />
                  )}
                  {showExtras && palletPickupOption && (
                    <OptionRow
                      variant="checkbox"
                      selected={value.selectedExtraOptionIds.includes(
                        palletPickupOption.id,
                      )}
                      title={t("Take the empty pallet", "Ta med tom pall")}
                      description={t(
                        "We take the empty pallet with us.",
                        "Vi tar med oss den tomme pallen.",
                      )}
                      price={money(palletPickupOption.customerPrice)}
                      onClick={() => toggleExtraOption(palletPickupOption.id)}
                    />
                  )}
                  {dismantlingGroups.length > 0 && furnitureAddonsVisible && (
                    <div className="overflow-hidden rounded-xl border border-black/10">
                      <div className="border-b border-black/10 bg-black/2 px-4 py-3">
                        <div className="text-sm font-semibold text-black/85">
                          {t(
                            "Dismantle old furniture",
                            "Demontering av gamle møbler",
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-black/50">
                          {t(
                            "For disposal is quick removal. For reuse keeps the parts intact for reassembly.",
                            "For avhending er rask fjerning. For gjenbruk tas delene vare på for montering.",
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col divide-y divide-black/10">
                        {dismantlingGroups.map((group) => {
                          const groupSelected = [
                            group.disposal,
                            group.careful,
                          ].some(
                            (o) =>
                              !!o &&
                              value.selectedExtraOptionIds.includes(o.id),
                          );
                          return (
                            <div
                              key={group.key}
                              className={[
                                "flex flex-col gap-2 px-4 py-3 transition sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                                groupSelected ? "bg-logoblue/5" : "",
                              ].join(" ")}
                            >
                              <span className="text-sm font-semibold text-black/85">
                                {group.label}
                              </span>
                              <span className="grid grid-cols-2 gap-2 sm:w-80 sm:shrink-0">
                                {[
                                  {
                                    option: group.disposal,
                                    label: t("For disposal", "For avhending"),
                                  },
                                  {
                                    option: group.careful,
                                    label: t("For reuse", "For gjenbruk"),
                                  },
                                ].map(({ option, label }) => {
                                  if (!option) return null;
                                  const isSelected =
                                    value.selectedExtraOptionIds.includes(
                                      option.id,
                                    );
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      aria-pressed={isSelected}
                                      onClick={() =>
                                        selectDismantling(group, option)
                                      }
                                      className={[
                                        "flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition",
                                        isSelected
                                          ? "border-logoblue bg-logoblue text-white"
                                          : "border-black/15 bg-white text-black/80 hover:border-logoblue/50",
                                      ].join(" ")}
                                    >
                                      <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                                        <span>{label}</span>
                                        {isSelected && (
                                          <span className="text-[11px] leading-none">
                                            ✓
                                          </span>
                                        )}
                                      </span>
                                      <span className="whitespace-nowrap text-sm font-semibold">
                                        {money(option.customerPrice)}
                                      </span>
                                    </button>
                                  );
                                })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {anchoringOption && furnitureAddonsVisible && (
                    <OptionRow
                      variant="checkbox"
                      selected={value.selectedExtraOptionIds.includes(
                        anchoringOption.id,
                      )}
                      title={t(
                        "Wall anchoring / anti-tip securing",
                        "Veggforankring / veltesikring",
                      )}
                      price={money(anchoringOption.customerPrice)}
                      onClick={() => toggleExtraOption(anchoringOption.id)}
                    />
                  )}
                  {showReturn && returnOption && (
                    <OptionRow
                      variant="checkbox"
                      selected={
                        value.selectedReturnOptionId === returnOption.id
                      }
                      title={t(
                        "Return old product for recycling",
                        "Retur av gammel vare til gjenvinning",
                      )}
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
      </div>
      </div>
      {onAddAnother && (
        <button
          type="button"
          onClick={onAddAnother}
          className="flex w-full items-center justify-center gap-2 border-t border-dashed border-logoblue/30 bg-logoblue/5 px-4 py-3 text-sm font-semibold text-logoblue transition hover:bg-logoblue/10"
        >
          <span aria-hidden="true" className="text-base leading-none">
            +
          </span>
          {t(
            `Add another ${productName} with different options`,
            `Legg til en ny ${productName} med andre valg`,
          )}
        </button>
      )}
    </div>
  );
}

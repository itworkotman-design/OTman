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

export function WhiteGoodsProductCard({
  locale,
  product,
  value,
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

  const installOnlyEnabled = seedProduct?.deliveryTypes.installOnlyEnabled ?? false;

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

  const installSelected = value.selectedInstallOptionIds.length > 0;
  const deliveryType = value.deliveryType;
  // Doorstep delivery has no install "type" choices at all in the source
  // data; unpacking/dismantling/return are available directly (no
  // installSelected gate applies since one can never be selected there).
  const showTypeChoices =
    (deliveryType === "INDOOR" || deliveryType === "INSTALL_ONLY") && typeOptions.length > 0;
  const showExtras = deliveryType !== "" && !installSelected;

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

  function selectType(optionId: string) {
    const stackableSelected = value.selectedInstallOptionIds.filter((id) =>
      stackableInstallOptions.some((o) => o.id === id),
    );
    onChange({
      ...value,
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ProductIcon code={product.code} iconKey={product.iconKey} className="h-6 w-6 text-logoblue" />
          <p className="text-sm font-semibold text-black/80">{productName}</p>
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

      <div className="mt-4 flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-black/50">
            {t("Delivery", "Levering")}
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={deliveryType === "FIRST_STEP"}
              onChange={() => setDeliveryType("FIRST_STEP")}
            />
            {t("Delivery to doorstep", "Levering til ytterdør")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={deliveryType === "INDOOR"}
              onChange={() => setDeliveryType("INDOOR")}
            />
            {t("Delivery with carry-in", "Levering med innbæring")}
          </label>
          {installOnlyEnabled && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={deliveryType === "INSTALL_ONLY"}
                onChange={() => setDeliveryType("INSTALL_ONLY")}
              />
              {t("Installation only", "Kun montering")}
            </label>
          )}
        </fieldset>

        {showTypeChoices && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-black/50">
              {t("Installation type", "Monteringstype")}
            </legend>
            {typeOptions.map((option) => {
              const seed = seedByCode.get(option.code);
              return (
                <label key={option.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={value.selectedInstallOptionIds.includes(option.id)}
                      onChange={() => selectType(option.id)}
                    />
                    {seed ? seedLabel(locale, seed) : option.label}
                  </span>
                  <span className="text-black/50">{money(option.customerPrice)}</span>
                </label>
              );
            })}
            {installSelected &&
              stackableInstallOptions.map((option) => {
                const seed = seedByCode.get(option.code);
                return (
                  <label
                    key={option.id}
                    className="ml-5 flex items-center justify-between gap-2 text-sm text-black/70"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={value.selectedInstallOptionIds.includes(option.id)}
                        onChange={() => toggleStackableInstall(option.id)}
                      />
                      {seed ? seedLabel(locale, seed) : option.label}
                    </span>
                    <span className="text-black/50">{money(option.customerPrice)}</span>
                  </label>
                );
              })}
          </fieldset>
        )}

        {showExtras && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-black/50">
              {t("Add-ons", "Tilleggsvalg")}
            </legend>
            {unpackingOption && (
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value.selectedExtraOptionIds.includes(unpackingOption.id)}
                    onChange={toggleUnpacking}
                  />
                  {t("Unpacking and disposal of packaging", "Utpakking og kasting av emballasje")}
                </span>
                <span className="text-black/50">{money(unpackingOption.customerPrice)}</span>
              </label>
            )}
            {demontOption && (
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value.demontEnabled}
                    onChange={() => onChange({ ...value, demontEnabled: !value.demontEnabled })}
                  />
                  {t("Dismantling old product", "Demontering av gammel vare")}
                </span>
                <span className="text-black/50">{money(demontOption.customerPrice)}</span>
              </label>
            )}
          </fieldset>
        )}

        {returnOption && deliveryType !== "" && (
          <label className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.selectedReturnOptionId === returnOption.id}
                onChange={toggleReturn}
              />
              {t("Return old product for recycling", "Retur av gammel vare til gjenvinning")}
            </span>
            <span className="text-black/50">{money(returnOption.customerPrice)}</span>
          </label>
        )}
      </div>
    </div>
  );
}

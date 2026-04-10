"use client";

import { useEffect, useMemo } from "react";
import type { DeliveryType } from "@/lib/booking/pricing/types";
import type {
  SavedProductCard,
  CatalogProduct,
  CatalogSpecialOption,
} from "./_types/productCard";
import { DELIVERY_TYPES, OPTION_CODES } from "@/lib/booking/constants";
import {
  normalizedUpper,
  isInstallOption,
  isReturnOption,
  isXtraOption,
  isExtraCheckboxOption,
  showsInstallOptions,
  showsReturnOptions,
  showsExtraCheckboxes,
} from "@/lib/booking/pricing/rules";

type Props = {
  cardId: number;
  displayIndex?: number;
  value: SavedProductCard;
  catalogProducts: CatalogProduct[];
  catalogSpecialOptions: CatalogSpecialOption[];
  loading?: boolean;
  error?: string | null;
  onChange: (value: SavedProductCard) => void;
  onRemove?: (cardId: number) => void;
  disableRemove?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
};

export function ProductCardNew({
  cardId,
  displayIndex,
  value,
  catalogProducts,
  catalogSpecialOptions,
  loading,
  error,
  onChange,
  onRemove,
  disableRemove,
  isExpanded,
  onToggle,
}: Props) {
  const selectedProduct = useMemo(
    () => catalogProducts.find((p) => p.id === value.productId) ?? null,
    [catalogProducts, value.productId],
  );

  const options = selectedProduct?.options ?? [];

  const categorizedInstallOptions = options.filter((o) =>
    isInstallOption(o.category, o.code),
  );

  const installOptions =
    !selectedProduct?.allowDeliveryTypes && categorizedInstallOptions.length === 0
      ? options.filter(
          (o) =>
            o.active &&
            !isReturnOption(o.category, o.code) &&
            !isXtraOption(o.category, o.code) &&
            !isExtraCheckboxOption(o.code),
        )
      : categorizedInstallOptions;
  const installSectionLabel =
    !selectedProduct?.allowDeliveryTypes && categorizedInstallOptions.length === 0
      ? "Velg"
      : "Installasjonsmuligheter";

  const productExtraOptions = options.filter(
    (o) =>
      isExtraCheckboxOption(o.code) &&
      normalizedUpper(o.code) !== OPTION_CODES.DEMONT,
  );

  const demontOption =
    options.find((o) => normalizedUpper(o.code) === OPTION_CODES.DEMONT) ??
    null;

  const specialExtraServiceOptions = catalogSpecialOptions.filter(
    (o) => o.active && o.type === "extra_service",
  );

  const extraOptions = [...productExtraOptions, ...specialExtraServiceOptions];

  const returnOptions = catalogSpecialOptions.filter(
    (o) => o.active && o.type === "return",
  );

  const isPalletProduct = selectedProduct?.productType === "PALLET";
  const supportsDeliveryTypes = !!selectedProduct?.allowDeliveryTypes;
  const supportsQuantity = !!selectedProduct?.allowQuantity || isPalletProduct;
  const supportsInstallOptions = !!selectedProduct?.allowInstallOptions;
  const supportsReturnOptions = !!selectedProduct?.allowReturnOptions;
  const supportsExtraServices = !!selectedProduct?.allowExtraServices;
  const supportsDemont = !!selectedProduct?.allowDemont;
  const supportsHoursInput = !!selectedProduct?.allowHoursInput;

  const showInstallOptions =
    !!selectedProduct &&
    supportsInstallOptions &&
    (!supportsDeliveryTypes || showsInstallOptions(value.deliveryType));
  const showReturnOptions =
    !!selectedProduct &&
    supportsReturnOptions &&
    (!supportsDeliveryTypes || showsReturnOptions(value.deliveryType));
  const showExtras =
    !!selectedProduct &&
    supportsExtraServices &&
    (!supportsDeliveryTypes || showsExtraCheckboxes(value.deliveryType)) &&
    value.selectedInstallOptionIds.length === 0;
  const showDemont =
    !!selectedProduct &&
    supportsDemont &&
    (!supportsDeliveryTypes || showsExtraCheckboxes(value.deliveryType)) &&
    value.selectedInstallOptionIds.length === 0 &&
    !!demontOption;

  const showDeliveryType = !!value.productId && supportsDeliveryTypes;
  const showAmount = !!value.productId && supportsQuantity;
  const showHoursInput = !!value.productId && supportsHoursInput;

  useEffect(() => {
    if (!selectedProduct) return;

    const nextDeliveryType = supportsDeliveryTypes ? value.deliveryType : "";
    const nextValue: Partial<SavedProductCard> = {};
    const hasLegacyDemontSelection =
      !!demontOption &&
      value.selectedExtraOptionIds.includes(demontOption.id);

    if (hasLegacyDemontSelection) {
      nextValue.selectedExtraOptionIds = value.selectedExtraOptionIds.filter(
        (id) => id !== demontOption!.id,
      );

      if (supportsDemont) {
        nextValue.demontEnabled = true;
      }
    }

    if (!supportsDeliveryTypes && value.deliveryType) {
      nextValue.deliveryType = "";
    }

    if (
      (!supportsInstallOptions ||
        (supportsDeliveryTypes && !showsInstallOptions(nextDeliveryType))) &&
        value.selectedInstallOptionIds.length > 0) {
      nextValue.selectedInstallOptionIds = [];
    }

    if (
      (!supportsExtraServices ||
        (supportsDeliveryTypes && !showsExtraCheckboxes(nextDeliveryType))) &&
        value.selectedExtraOptionIds.length > 0) {
      nextValue.selectedExtraOptionIds = [];
    }

    if (
      value.selectedInstallOptionIds.length > 0 &&
      value.selectedExtraOptionIds.length > 0
    ) {
      nextValue.selectedExtraOptionIds = [];
    }

    if (
      (!supportsReturnOptions ||
        (supportsDeliveryTypes && !showsReturnOptions(nextDeliveryType))) &&
        value.selectedReturnOptionId) {
      nextValue.selectedReturnOptionId = null;
    }

    if ((!supportsDemont ||
        (supportsDeliveryTypes && !showsExtraCheckboxes(nextDeliveryType)) ||
        value.selectedInstallOptionIds.length > 0 ||
        !demontOption) &&
        value.demontEnabled) {
      nextValue.demontEnabled = false;
    }

    if (!supportsQuantity && value.amount !== 1) {
      nextValue.amount = 1;
    }

    if (value.peopleCount !== 1) {
      nextValue.peopleCount = 1;
    }

    if (!supportsHoursInput && value.hoursInput !== 1) {
      nextValue.hoursInput = 1;
    }

    if (Object.keys(nextValue).length > 0) {
      onChange({
        ...value,
        ...nextValue,
      });
    }
  }, [
    demontOption,
    onChange,
    selectedProduct,
    supportsDeliveryTypes,
    supportsDemont,
    supportsExtraServices,
    supportsHoursInput,
    supportsInstallOptions,
    supportsQuantity,
    supportsReturnOptions,
    value,
  ]);

  function update(partial: Partial<SavedProductCard>) {
    onChange({
      ...value,
      ...partial,
    });
  }

  function handleProductSelect(newProductId: string | null) {
    onChange({
      ...value,
      productId: newProductId,
      deliveryType: "",
      amount: 1,
      peopleCount: 1,
      hoursInput: 1,
      selectedInstallOptionIds: [],
      selectedExtraOptionIds: [],
      selectedReturnOptionId: null,
      demontEnabled: false,
      selectedTimeOptionIds: [],
      extraTimeHours: 0.5,
      extraPalletEnabled: false,
      extraPalletQty: 1,
      etterEnabled: false,
      etterQty: 1,
    });
  }

  function toggleOption(
    optionId: string,
    field: "selectedInstallOptionIds" | "selectedExtraOptionIds",
  ) {
    const current = value[field];
    const exists = current.includes(optionId);

    update({
      [field]: exists
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
      ...(field === "selectedInstallOptionIds" && !exists
        ? { demontEnabled: false }
        : {}),
    });
  }

  const shownCardNumber = displayIndex ?? cardId + 1;
  const productLabel = selectedProduct?.label ?? "Velg";

  return (
    <div className="customContainer relative w-full mb-4">
      <button
        type="button"
        onClick={() => onRemove?.(cardId)}
        disabled={disableRemove}
        className={
          "absolute top-3 right-3 text-white text-xs font-bold px-2 py-1 rounded-2xl " +
          (disableRemove
            ? "cursor-not-allowed"
            : "bg-red-500/20 hover:bg-red-600 cursor-pointer")
        }
      >
        X
      </button>

      <button
        type="button"
        onClick={onToggle}
        className="items-center flex-1 text-left w-full pt-6 cursor-pointer"
      >
        <div className="flex pb-2 mb-4">
          <div className="w-6 h-6 bg-logoblue text-white font-semibold flex items-center justify-center rounded-2xl mr-2">
            <span>{shownCardNumber}</span>
          </div>
          <h1 className="items-center font-semibold text-logoblue text-md">
            {productLabel}
          </h1>
        </div>
      </button>

      {isExpanded && (
        <div>
          {loading && (
            <p className="text-sm opacity-70 mb-3">Loading catalog...</p>
          )}
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <h1 className="font-semibold mb-2 text-lg text-textcolor">
            Velg produkt
          </h1>
          <select
            className="customInput w-full"
            value={value.productId ?? ""}
            onChange={(e) => handleProductSelect(e.target.value || null)}
            disabled={loading}
          >
            <option value="" disabled>
              Choose
            </option>
            {catalogProducts
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
          </select>

          {showDeliveryType && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Velg leveringstype
              </h1>
              <select
                className="customInput w-full"
                value={value.deliveryType}
                onChange={(e) =>
                  update({
                    deliveryType: e.target.value as DeliveryType,
                    selectedInstallOptionIds: [],
                    selectedExtraOptionIds: [],
                    selectedReturnOptionId: null,
                    demontEnabled: false,
                  })
                }
              >
                <option value="" disabled>
                  Velg
                </option>
                <option value={DELIVERY_TYPES.FIRST_STEP}>Første trinn</option>
                <option value={DELIVERY_TYPES.INDOOR}>Innbæring</option>
                <option value={DELIVERY_TYPES.INSTALL_ONLY}>
                  Kun Installasjon/Montering
                </option>
                <option value={DELIVERY_TYPES.RETURN_ONLY}>Kun retur</option>
              </select>
            </>
          )}

          {showInstallOptions && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                {installSectionLabel}
              </h1>
              {installOptions.length === 0 ? (
                <p className="text-sm opacity-70">
                  Ingen installasjonsalternativer for dette produktet
                </p>
              ) : (
                installOptions.map((opt) => (
                  <label key={opt.id} className="block my-1">
                    <input
                      className="inline mr-2"
                      type="checkbox"
                      checked={value.selectedInstallOptionIds.includes(opt.id)}
                      onChange={() =>
                        toggleOption(opt.id, "selectedInstallOptionIds")
                      }
                    />
                    <span className="inline">
                      {opt.description || opt.label || opt.code}
                    </span>
                  </label>
                ))
              )}
            </>
          )}

          {showExtras && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Utpakking / Demontering
              </h1>
              {extraOptions.length === 0 ? (
                <p className="text-sm opacity-70">
                  No utpakking / demontering options.
                </p>
              ) : (
                extraOptions.map((opt) => (
                  <label key={opt.id} className="block my-1">
                    <input
                      className="inline mr-2"
                      type="checkbox"
                      checked={value.selectedExtraOptionIds.includes(opt.id)}
                      onChange={() =>
                        toggleOption(opt.id, "selectedExtraOptionIds")
                      }
                    />
                    <span className="inline">
                      {opt.description || opt.label || opt.code}
                    </span>
                  </label>
                ))
              )}
            </>
          )}

          {showDemont && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Demont
              </h1>
              <label className="block my-1">
                <input
                  className="inline mr-2"
                  type="checkbox"
                  checked={value.demontEnabled}
                  onChange={() =>
                    update({
                      demontEnabled: !value.demontEnabled,
                    })
                  }
                />
                <span className="inline">
                  {demontOption?.description ||
                    demontOption?.label ||
                    demontOption?.code ||
                    "Demont"}
                </span>
              </label>
            </>
          )}

          {showReturnOptions && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Return
              </h1>
              {returnOptions.length === 0 ? (
                <p className="text-sm opacity-70">
                  No return options available.
                </p>
              ) : (
                returnOptions.map((opt) => (
                  <label key={opt.id} className="block my-1">
                    <input
                      className="inline mr-2"
                      type="radio"
                      checked={value.selectedReturnOptionId === opt.id}
                      onChange={() =>
                        update({
                          selectedReturnOptionId:
                            value.selectedReturnOptionId === opt.id
                              ? null
                              : opt.id,
                        })
                      }
                    />
                    <span className="inline">
                      {opt.description || opt.label || opt.code}
                    </span>
                  </label>
                ))
              )}
            </>
          )}

          {showAmount && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                {isPalletProduct ? "Pallet quantity" : "Product amount"}
              </h1>
              <input
                type="number"
                min={1}
                value={value.amount}
                onChange={(e) =>
                  update({
                    amount: Number(e.target.value) || 1,
                  })
                }
                className="customInput w-full"
              />
            </>
          )}

          {showHoursInput && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Hours input
              </h1>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={value.hoursInput}
                onChange={(e) =>
                  update({
                    hoursInput: Math.max(0.5, Number(e.target.value) || 0.5),
                  })
                }
                className="customInput w-full"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

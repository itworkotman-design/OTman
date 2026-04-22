"use client";

import { useEffect, useMemo } from "react";
import type { DeliveryType } from "@/lib/booking/pricing/types";
import type {
  SavedProductCard,
  CatalogProduct,
  CatalogSpecialOption,
} from "./_types/productCard";
import { OPTION_CODES } from "@/lib/booking/constants";
import { getProductDeliveryTypeLabel } from "@/lib/products/deliveryTypes";
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
  const sortedActiveProducts = useMemo(
    () =>
      catalogProducts
        .filter((product) => product.active)
        .toSorted((left, right) => left.label.localeCompare(right.label, "no")),
    [catalogProducts],
  );

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
      ? "Choose"
      : "Installation";

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
  const customSections = selectedProduct?.customSections ?? [];
  const deliveryTypes = selectedProduct?.deliveryTypes ?? [];
  const supportsDeliveryTypes = !!selectedProduct?.allowDeliveryTypes;
  const supportsQuantity = !!selectedProduct?.allowQuantity || isPalletProduct;
  const supportsInstallOptions = !!selectedProduct?.allowInstallOptions;
  const supportsReturnOptions = !!selectedProduct?.allowReturnOptions;
  const supportsExtraServices = !!selectedProduct?.allowExtraServices;
  const supportsDemont = !!selectedProduct?.allowDemont;
  const supportsHoursInput = !!selectedProduct?.allowHoursInput;
  const supportsModelNumber = !!selectedProduct?.allowModelNumber;

  const showInstallOptions =
    !!selectedProduct &&
    supportsInstallOptions &&
    (!supportsDeliveryTypes ||
      showsInstallOptions(value.deliveryType) ||
      value.selectedInstallOptionIds.length > 0);
  const showReturnOptions =
    !!selectedProduct &&
    supportsReturnOptions &&
    (!supportsDeliveryTypes ||
      showsReturnOptions(value.deliveryType) ||
      !!value.selectedReturnOptionId);
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
  const showModelNumber = !!value.productId && supportsModelNumber;

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
      supportsDeliveryTypes &&
      value.deliveryType &&
      !deliveryTypes.some((item) => item.key === value.deliveryType)
    ) {
      nextValue.deliveryType = "";
    }

    if (
      (!supportsInstallOptions ||
        (supportsDeliveryTypes &&
          !showsInstallOptions(nextDeliveryType) &&
          nextDeliveryType !== "")) &&
      value.selectedInstallOptionIds.length > 0
    ) {
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
        (supportsDeliveryTypes &&
          !showsReturnOptions(nextDeliveryType) &&
          nextDeliveryType !== "")) &&
      value.selectedReturnOptionId
    ) {
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
    } else if (supportsQuantity && value.amount < 1) {
      nextValue.amount = 1;
    }

    if (value.peopleCount !== 1) {
      nextValue.peopleCount = 1;
    }

    if (!supportsHoursInput && value.hoursInput !== 1) {
      nextValue.hoursInput = 1;
    }

    if (!supportsModelNumber && value.modelNumber.trim()) {
      nextValue.modelNumber = "";
    }

    const validCustomSectionSelections = value.customSectionSelections.filter(
      (selection) => {
        const section = customSections.find((item) => item.id === selection.sectionId);
        if (!section) return false;
        return true;
      },
    );

    const normalizedCustomSectionSelections = validCustomSectionSelections.map(
      (selection) => {
        const section = customSections.find((item) => item.id === selection.sectionId);

        return {
          ...selection,
          optionIds: (() => {
            const validOptionIds =
              section?.options
                .filter((option) => selection.optionIds.includes(option.id))
                .map((option) => option.id) ?? [];

            return section?.allowMultiple === false
              ? validOptionIds.slice(0, 1)
              : validOptionIds;
          })(),
        };
      },
    );

    if (
      JSON.stringify(normalizedCustomSectionSelections) !==
      JSON.stringify(value.customSectionSelections)
    ) {
      nextValue.customSectionSelections = normalizedCustomSectionSelections;
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
    supportsModelNumber,
    supportsQuantity,
    supportsReturnOptions,
    value,
    customSections,
    deliveryTypes,
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
      modelNumber: "",
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
      customSectionSelections: [],
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

  function getSelectedCustomSectionOptionIds(sectionId: string) {
    return (
      value.customSectionSelections.find((selection) => selection.sectionId === sectionId)
        ?.optionIds ?? []
    );
  }

  function toggleCustomSectionOption(sectionId: string, optionId: string) {
    const section = customSections.find((item) => item.id === sectionId);
    const existingSelection = value.customSectionSelections.find(
      (selection) => selection.sectionId === sectionId,
    );
    const currentOptionIds = existingSelection?.optionIds ?? [];
    const nextOptionIds =
      section?.allowMultiple === false
        ? [optionId]
        : currentOptionIds.includes(optionId)
          ? currentOptionIds.filter((id) => id !== optionId)
          : [...currentOptionIds, optionId];

    if (!existingSelection && nextOptionIds.length > 0) {
      update({
        customSectionSelections: [
          ...value.customSectionSelections,
          {
            sectionId,
            optionIds: nextOptionIds,
          },
        ],
      });
      return;
    }

    update({
      customSectionSelections:
        nextOptionIds.length === 0
          ? value.customSectionSelections.filter(
              (selection) => selection.sectionId !== sectionId,
            )
          : value.customSectionSelections.map((selection) =>
              selection.sectionId === sectionId
                ? {
                    ...selection,
                    optionIds: nextOptionIds,
                  }
                : selection,
            ),
    });
  }

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
            Choose product
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
            {sortedActiveProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
          </select>

          {showModelNumber && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Model number
              </h1>
              <input
                type="text"
                value={value.modelNumber}
                onChange={(e) =>
                  update({
                    modelNumber: e.target.value,
                  })
                }
                className="customInput w-full"
                placeholder="Optional"
              />
            </>
          )}

          {showDeliveryType && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Choose delivery type
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
                {deliveryTypes.map((deliveryType) => (
                  <option key={deliveryType.key} value={deliveryType.key}>
                    {getProductDeliveryTypeLabel(
                      deliveryTypes,
                      deliveryType.key,
                    )}
                  </option>
                ))}
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

          {customSections.map((section) => (
            <div key={section.id}>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                {section.title || "Custom section"}
              </h1>
              <div className="space-y-1">
                {section.options.map((option) => (
                  <label key={option.id} className="block my-1">
                    <input
                      className="inline mr-2"
                      type={section.allowMultiple ? "checkbox" : "radio"}
                      name={`custom-section-${value.cardId}-${section.id}`}
                      checked={getSelectedCustomSectionOptionIds(section.id).includes(
                        option.id,
                      )}
                      onChange={() =>
                        toggleCustomSectionOption(section.id, option.id)
                      }
                    />
                    <span className="inline">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

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
                    amount: Math.max(1, Number(e.target.value) || 1),
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

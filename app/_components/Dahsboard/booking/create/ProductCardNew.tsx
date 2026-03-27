"use client";
import { useMemo } from "react";
import type { DeliveryType } from "@/lib/booking/pricing/types";
import type { SavedProductCard, CatalogProduct } from "./_types/productCard";
import {
  DELIVERY_TYPES,
  OPTION_CODES,
  OPTION_CATEGORIES,
} from "@/lib/booking/constants";

type Props = {
  cardId: number;
  displayIndex?: number;
  value: SavedProductCard;
  catalogProducts: CatalogProduct[];
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

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isReturnOption(
  category: string | null | undefined,
  code: string | null | undefined,
) {
  const c = normalized(category);
  const x = normalized(code);

  return (
    c === OPTION_CATEGORIES.RETURN ||
    c === OPTION_CATEGORIES.RETURN ||
    x.includes(OPTION_CATEGORIES.RETURN) ||
    x.includes(OPTION_CATEGORIES.RETURN)
  );
}

function isXtraOption(
  category: string | null | undefined,
  code: string | null | undefined,
) {
  const c = normalized(category);
  const x = normalized(code);

  return c === OPTION_CATEGORIES.XTRA || x.includes(OPTION_CATEGORIES.XTRA);
}

function isInstallOption(
  category: string | null | undefined,
  code: string | null | undefined,
) {
  const c = normalized(category);

  if (isReturnOption(category, code)) return false;
  if (isXtraOption(category, code)) return false;

  return c === OPTION_CATEGORIES.INSTALL;
}

function isExtraOption(
  category: string | null | undefined,
  code: string | null | undefined,
) {
  const c = normalized(category);

  if (isReturnOption(category, code)) return false;
  if (isXtraOption(category, code)) return false;

  return c === "extra";
}

const installOptions = options.filter((o) =>isInstallOption(o.category, o.code),);

const extraOptions = options.filter((o) => {
  const code = (o.code ?? "").trim().toUpperCase();
  return code === OPTION_CODES.UNPACKING || code === OPTION_CODES.DEMONT;
});

const returnOptions = options.filter((o) => isReturnOption(o.category, o.code));


  const showDeliveryType = !!value.productId;
  const showAmount = !!value.productId;

  const showInstallOptions =
    value.deliveryType === DELIVERY_TYPES.INDOOR ||
    value.deliveryType === DELIVERY_TYPES.INSTALL_ONLY;

  const showReturnOptions =
    value.deliveryType === DELIVERY_TYPES.INDOOR ||
    value.deliveryType === DELIVERY_TYPES.INSTALL_ONLY ||
    value.deliveryType === DELIVERY_TYPES.RETURN_ONLY;

  const showExtras = value.deliveryType === DELIVERY_TYPES.INDOOR;

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
                Installasjonsmuligheter
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
                      {opt.description || opt.label}
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
                <p className="text-sm opacity-70">No extra services.</p>
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
                      {opt.description || opt.label}
                    </span>
                  </label>
                ))
              )}
            </>
          )}

          {showReturnOptions && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Return
              </h1>
              {returnOptions.length === 0 ? (
                <p className="text-sm opacity-70">
                  No return options for this product.
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
                      {opt.description || opt.label}
                    </span>
                  </label>
                ))
              )}
            </>
          )}

          {showAmount && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Product amount
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
        </div>
      )}
    </div>
  );
}

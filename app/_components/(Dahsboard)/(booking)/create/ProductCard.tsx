"use client";

import { useEffect, useMemo, useState } from "react";
import { PRODUCTS } from "@/lib/products";
import { getActiveOptions, getPriceDetails } from "@/lib/priceOptions";
import { PRICE_ITEMS } from "@/lib/pricing";

// ============================================================================
// TYPES
// ============================================================================

export type DeliveryType =
  | ""
  | "Første trinn"
  | "Innbæring"
  | "Kun Installasjon/Montering"
  | "Kun retur";

export type LineItem = {
  key: string; // PRICE_ITEMS.key
  qty: number; // 0.5, 1, 2, ...
};

export type ProductCardChangePayload = {
  items: LineItem[];
  deliveryType: DeliveryType;
};

type Props = {
  cardId: number;
  displayIndex?: number; // optional; if passed, use it in UI instead of cardId+1
  onChange: (payload: ProductCardChangePayload) => void;
  onProductChange?: (productId: string | null) => void;
  onRemove?: (cardId: number) => void;
  disableRemove?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ProductCard({
  cardId,
  displayIndex,
  onChange,
  onProductChange,
  onRemove,
  disableRemove,
  isExpanded,
  onToggle,
  
}: Props) {
  const [productId, setProductId] = useState<string | null>(null);

  // Default flow
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("");
  const [selectedInstallOptionIds, setSelectedInstallOptionIds] = useState<string[]>([]);
  const [returnOptionId, setReturnOptionId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(1);

  // Innbæring extras
  const [selectedExtraOptionIds, setSelectedExtraOptionIds] = useState<string[]>([]);
  const [demontEnabled, setDemontEnabled] = useState(false);

  // Special: PALLET
  const [extraPalletEnabled, setExtraPalletEnabled] = useState(false);
  const [extraPalletQty, setExtraPalletQty] = useState<number>(1);

  // Special: ETTER
  const [etterEnabled, setEtterEnabled] = useState(false);
  const [etterQty, setEtterQty] = useState<number>(1);

  // Special: TIME (multiple checkboxes + hours)
  const [selectedTimeOptionIds, setSelectedTimeOptionIds] = useState<string[]>([]);
  const [extraTimeHours, setExtraTimeHours] = useState<number>(0.5); // starts at 0.5h

  // Options
  const options = useMemo(() => getActiveOptions(productId), [productId]);
  const installOptions = useMemo(() => options.filter((o) => o.kind === "install"), [options]);
  const returnOptions = useMemo(() => options.filter((o) => o.kind === "return"), [options]);
  const extraOptions = useMemo(() => options.filter((o) => o.kind === "extra"), [options]);

  // Demontering is modeled as a "return" option but must be checkbox
  const demontOption = useMemo(
    () => returnOptions.find((o) => o.id === "global_demont"),
    [returnOptions]
  );
  const returnTripOptions = useMemo(
    () => returnOptions.filter((o) => o.id !== "global_demont"),
    [returnOptions]
  );

  // Modes
  const isPALLET = productId === "PALLET";
  const isETTER = productId === "ETTER";
  const isTIME = productId === "TIME";

  // Hide delivery type + return + amount for PALLET/ETTER/TIME
  const hideDeliveryAndReturn = isPALLET || isETTER || isTIME;

  function keyFromCode(code: string) {
    return PRICE_ITEMS.find((i) => i.code === code)?.key ?? null;
  }

  function clampInt(v: number, min: number) {
    const n = Number.isFinite(v) ? Math.floor(v) : min;
    return Math.max(min, n);
  }

  function clampHalfHour(v: number) {
    const rounded = Math.round(v / 0.5) * 0.5;
    return Math.max(0.5, rounded);
  }

  // Reset per-product fields when product changes
  useEffect(() => {
    setDeliveryType("");
    setSelectedInstallOptionIds([]);
    setReturnOptionId(null);

    setSelectedExtraOptionIds([]);
    setDemontEnabled(false);

    setAmount(1);

    setExtraPalletEnabled(false);
    setExtraPalletQty(1);

    setEtterEnabled(false);
    setEtterQty(1);

    setSelectedTimeOptionIds([]);
    setExtraTimeHours(0.5);
  }, [productId]);

  function buildItems(): LineItem[] {
    const items: LineItem[] = [];
    const amt = clampInt(amount, 1);

    // PALLET
    if (isPALLET) {
      const opt = installOptions[0]; // expects one install option for PALLET
      if (opt && extraPalletEnabled) {
        items.push({ key: opt.priceKey, qty: clampInt(extraPalletQty, 1) });
      }
      return items;
    }

    // ETTER
    if (isETTER) {
      const opt = installOptions[0]; // expects one install option for ETTER
      if (opt && etterEnabled) {
        items.push({ key: opt.priceKey, qty: clampInt(etterQty, 1) });
      }
      return items;
    }

    // TIME
    if (isTIME) {
      const hours = clampHalfHour(extraTimeHours);
      const qty = hours; // 0.5 => half price
      for (const optId of selectedTimeOptionIds) {
        const opt = installOptions.find((o) => o.id === optId);
        if (!opt) continue;
        items.push({ key: opt.priceKey, qty });
      }
      return items;
    }

    // DEFAULT / OTHER
    // For Innbæring: show full service list (install + return + extras + demontering checkbox)
    const showFullServiceList = deliveryType === "Innbæring";

    // Delivery price itself (ORDER-LEVEL)
    if (deliveryType === "Første trinn") {
      const k = keyFromCode("DELIVERY");
      if (k) items.push({ key: k, qty: 1 });
    }

    if (deliveryType === "Innbæring") {
      const k = keyFromCode("INDOOR");
      if (k) items.push({ key: k, qty: 1 });
    }

    // Base install fee (ORDER-LEVEL)
    if (deliveryType === "Kun Installasjon/Montering") {
      const k = keyFromCode("MONTERING");
      if (k) items.push({ key: k, qty: 1 });
    }

    // Install options:
    // - shown for Kun Installasjon/Montering
    // - also shown for Innbaering
    if (deliveryType === "Kun Installasjon/Montering" || showFullServiceList) {
    for (const optId of selectedInstallOptionIds) {
      const opt = installOptions.find((o) => o.id === optId);
      if (!opt) continue;
      items.push({ key: opt.priceKey, qty: amt });
      }
    } 

    // Demontering checkbox (global_demont)
    if (showFullServiceList && demontEnabled && demontOption) {
      items.push({ key: demontOption.priceKey, qty: amt });
    }

    // Extra services (kind: "extra") (global_unpacking etc.)
    if (showFullServiceList) {
      for (const optId of selectedExtraOptionIds) {
        const opt = extraOptions.find((o) => o.id === optId);
        if (!opt) continue;
        items.push({ key: opt.priceKey, qty: amt });
      }
    }

    // Return trip options (radio) – exclude global_demont
    if (returnOptionId) {
      const opt = returnTripOptions.find((o) => o.id === returnOptionId);
      if (opt) items.push({ key: opt.priceKey, qty: amt });
    }

    return items;
  }

  // Notify parent
  useEffect(() => {
    onChange({ items: buildItems(), deliveryType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [productId, deliveryType, selectedInstallOptionIds, returnOptionId, amount, selectedExtraOptionIds, demontEnabled, extraPalletEnabled, extraPalletQty, etterEnabled, etterQty, selectedTimeOptionIds, extraTimeHours,]);

  function handleProductSelect(newProductId: string | null) {
    setProductId(newProductId);
    onProductChange?.(newProductId);
  }

  const shownCardNumber = displayIndex ?? cardId + 1;

  //Title for the cards - selected item
  const productLabel =
  productId
    ? PRODUCTS.find((p) => p.id === productId)?.label ?? "Velg"
    : "Velg";

  return (
    <div className="relative w-full px-8 pb-8 mt-4 rounded-2xl border">
      {/* REMOVE BUTTON */}
      <button type="button" onClick={() => onRemove?.(cardId)} disabled={disableRemove} className={"absolute top-3 right-3 text-white text-xs font-bold px-2 py-1 rounded-2xl " +(disableRemove ? " cursor-not-allowed" : "bg-red-500/20 hover:bg-red-600 cursor-pointer")}>X</button>
      <button type="button" onClick={onToggle} className="items-center flex-1 text-left w-full pt-8 cursor-pointer">
        <div className="flex pb-2 mb-4">
          <div className="w-6 h-6 bg-logoblue text-white font-semibold flex items-center justify-center rounded-2xl mr-2">
            <span>{shownCardNumber}</span>
          </div>
          <h1 className="items-center font-semibold text-logoblue text-md">{productLabel}</h1>
        </div>
      </button>
      
      {isExpanded && (
  <div>
    <div>
        {/* Product Selection */}
        <h1 className="font-semibold mb-2 text-lg text-textcolor">Velg produkt</h1>
        <select
          className="w-full py-2 px-2 rounded-xl border"
          value={productId ?? ""}
          onChange={(e) => handleProductSelect(e.target.value || null)}
        >
          <option value="" disabled>
            Choose
          </option>
          {PRODUCTS.filter((p) => p.active).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Delivery Type (hidden for PALLET/ETTER/TIME) */}
        {!hideDeliveryAndReturn && (
          <>
            <h1 className="font-semibold text-lg text-textcolor my-2">Velg leveringstype</h1>
            <select
              className="w-full py-2 px-2 rounded-xl border"
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
              disabled={!productId}
            >
              <option value="" disabled>
                Velg
              </option>
              <option value="Første trinn">Første trinn</option>
              <option value="Innbæring">Innbæring</option>
              <option value="Kun Installasjon/Montering">Kun Installasjon/Montering</option>
              <option value="Kun retur">Kun retur</option>
            </select>
          </>
        )}

        {/* PALLET */}
        {isPALLET && (
          <>
            <h1 className="font-bold my-2">Extra pall</h1>
            <label className="block">
              <input
                className="inline mr-2"
                type="checkbox"
                checked={extraPalletEnabled}
                onChange={(e) => setExtraPalletEnabled(e.target.checked)}
              />
              <span className="inline">Levering av extra pall</span>
            </label>

            {extraPalletEnabled && (
              <>
                <h1 className="font-bold my-2">Antall ekstra paller</h1>
                <input
                  type="number"
                  min={1}
                  value={extraPalletQty}
                  onChange={(e) => setExtraPalletQty(Number(e.target.value) || 1)}
                  className="w-full py-2 px-2 rounded-xl border"
                />
              </>
            )}
          </>
        )}

        {/* ETTER */}
        {isETTER && (
          <>
            <h1 className="font-bold my-2">Ettermontering</h1>
            <label className="block">
              <input
                className="inline mr-2"
                type="checkbox"
                checked={etterEnabled}
                onChange={(e) => setEtterEnabled(e.target.checked)}
              />
              <span className="inline">Snekker/ Rørlegger (Timearbeid)</span>
            </label>

            {etterEnabled && (
              <>
                <h1 className="font-bold my-2">Mengde</h1>
                <input
                  type="number"
                  min={1}
                  value={etterQty}
                  onChange={(e) => setEtterQty(Number(e.target.value) || 1)}
                  className="w-full py-2 px-2 rounded-xl border"
                />
              </>
            )}
          </>
        )}

        {/* TIME */}
        {isTIME && (
          <>
            <h1 className="font-bold my-2">Timepris</h1>

            {installOptions.length === 0 ? (
              <p className="text-sm opacity-70">Ingen tidsalternativer for dette produktet.</p>
            ) : (
              installOptions.map((opt) => {
                const priceDetails = getPriceDetails(opt.priceKey);
                return (
                  <label key={opt.id} className="block">
                    <input
                      className="inline mr-2"
                      type="checkbox"
                      checked={selectedTimeOptionIds.includes(opt.id)}
                      onChange={(e) => {
                        setSelectedTimeOptionIds((prev) =>
                          e.target.checked ? [...prev, opt.id] : prev.filter((x) => x !== opt.id)
                        );
                      }}
                    />
                    <span className="inline">{priceDetails?.label ?? "Unknown option"}</span>
                  </label>
                );
              })
            )}

            <h1 className="font-bold my-2">Mengde av EXTRA tid</h1>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={extraTimeHours}
              onChange={(e) => setExtraTimeHours(Number(e.target.value) || 0.5)}
              className="w-full py-2 px-2 rounded-xl border"
            />
          </>
        )}

        {/* INSTALL OPTIONS:
            show for Kun Installasjon/Montering AND Innbæring
        */}
        {!hideDeliveryAndReturn &&
          (deliveryType === "Kun Installasjon/Montering" || deliveryType === "Innbæring") && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">Installasjonsmuligheter</h1>

              {installOptions.length === 0 ? (
                <p className="text-sm opacity-70">Ingen installasjonsalternativer for dette produktet</p>
              ) : (
                installOptions.map((opt) => {
                  const priceDetails = getPriceDetails(opt.priceKey);
                  return (
                    <label key={opt.id} className="block">
                      <input
                        className="inline mr-2"
                        type="checkbox"
                        checked={selectedInstallOptionIds.includes(opt.id)}
                        onChange={(e) => {
                          setSelectedInstallOptionIds((prev) =>
                            e.target.checked ? [...prev, opt.id] : prev.filter((x) => x !== opt.id)
                          );
                        }}
                      />
                      <span className="inline">{priceDetails?.label ?? "Unknown option"}</span>
                    </label>
                  );
                })
              )}
            </>
          )}

        {/* EXTRAS + DEMONTERING (only for Innbæring) */}
        {!hideDeliveryAndReturn && deliveryType === "Innbæring" && (
          <>
            <h1 className="font-semibold text-lg text-textcolor my-2">Utpakking / Demontering</h1>

            {demontOption && (
              <label className="block">
                <input
                  className="inline mr-2"
                  type="checkbox"
                  checked={demontEnabled}
                  onChange={(e) => setDemontEnabled(e.target.checked)}
                />
                <span className="inline">
                  {getPriceDetails(demontOption.priceKey)?.label ?? "Demontering"}
                </span>
              </label>
            )}

            {extraOptions.length === 0 ? (
              <p className="text-sm opacity-70">No extra services.</p>
            ) : (
              extraOptions.map((opt) => (
                <label key={opt.id} className="block">
                  <input
                    className="inline mr-2"
                    type="checkbox"
                    checked={selectedExtraOptionIds.includes(opt.id)}
                    onChange={(e) => {
                      setSelectedExtraOptionIds((prev) =>
                        e.target.checked ? [...prev, opt.id] : prev.filter((x) => x !== opt.id)
                      );
                    }}
                  />
                  <span className="inline">
                    {getPriceDetails(opt.priceKey)?.label ?? "Unknown option"}
                  </span>
                </label>
              ))
            )}
          </>
        )}

        {/* RETURN (radio) – hidden for PALLET/ETTER/TIME; demontering excluded */}
        {!hideDeliveryAndReturn && (
          <>
            <h1 className="font-semibold text-lg text-textcolor my-2">Return</h1>
            {returnTripOptions.length === 0 ? (
              <p className="text-sm opacity-70">No return options for this product.</p>
            ) : (
              returnTripOptions.map((opt) => {
                const priceDetails = getPriceDetails(opt.priceKey);
                return (
                  <label key={opt.id} className="block my-1">
                    <input
                      className="inline mr-2"
                      type="checkbox"
                      checked={returnOptionId === opt.id}
                      onChange={() =>
                        setReturnOptionId((prev) => (prev === opt.id ? null : opt.id))
                      }
                    />
                    <span className="inline">{priceDetails?.label ?? "Unknown option"}</span>
                  </label>
                );
              })
            )}
          </>
        )}

        {/* Product amount (hidden for PALLET/ETTER/TIME) */}
        {!hideDeliveryAndReturn && (
          <>
            <h1 className="font-semibold text-lg text-textcolor my-2">Product amount</h1>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 1)}
              className="w-full py-2 px-2 rounded-xl border"
            />
          </>
        )}
      </div>
    
  </div>
)}
   </div>   
  );
}

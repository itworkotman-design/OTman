"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { getDataset, type Dataset } from "@/lib/getDataset";

export type DeliveryType =
  | ""
  | "Første trinn"
  | "Innbæring"
  | "Kun Installasjon/Montering"
  | "Kun retur";

export type LineItem = {
  key: string;
  qty: number;
  priceOverride?: number;
};

export type ProductCardChangePayload = {
  items: LineItem[];
  deliveryType: DeliveryType;
  amount: number;
};

type Props = {
  cardId: number;
  displayIndex?: number;
  onChange: (payload: ProductCardChangePayload) => void;
  onProductChange?: (productId: string | null) => void;
  onRemove?: (cardId: number) => void;
  disableRemove?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  dataset?: Dataset;
  initialProductId?: string | null;
  initialDeliveryType?: DeliveryType;
  initialItems?: LineItem[];
};

/**
 * Reverse-engineers saved LineItem[] back into UI state.
 * Used when opening an existing order to pre-populate the card.
 * Matches item keys against known delivery/install/return/extra price keys
 * to reconstruct deliveryType, selected options, amount, and special product states.
 */

function extractFromItems(
  items: LineItem[],
  priceItems: { code: string; key: string }[],
  options: { id: string; priceKey: string; kind: string }[],
) {
  const findKey = (code: string) =>
    priceItems.find((p) => p.code === code)?.key;

  const deliveryKey = findKey("DELIVERY");
  const indoorKey = findKey("INDOOR");
  const monteringKey = findKey("MONTERING");
  const returnKey = findKey("RETURN");
  const xtraKey = findKey("XTRA");

  const keys = items.map((i) => i.key);

  let deliveryType: DeliveryType = "";
  if (deliveryKey && keys.includes(deliveryKey)) deliveryType = "Første trinn";
  if (indoorKey && keys.includes(indoorKey)) deliveryType = "Innbæring";
  if (monteringKey && keys.includes(monteringKey))
    deliveryType = "Kun Installasjon/Montering";
  if (returnKey && keys.includes(returnKey)) deliveryType = "Kun retur";

  const baseKeys = new Set(
    [deliveryKey, indoorKey, monteringKey, returnKey, xtraKey].filter(Boolean),
  );

  const installOptionIds = options
    .filter((o) => o.kind === "install" && keys.includes(o.priceKey))
    .map((o) => o.id);

  const extraOptionIds = options
    .filter((o) => o.kind === "extra" && keys.includes(o.priceKey))
    .map((o) => o.id);

  const returnOption = options.find(
    (o) =>
      o.kind === "return" &&
      o.id !== "global_demont" &&
      keys.includes(o.priceKey),
  );

  const demontOption = options.find(
    (o) => o.id === "global_demont" && keys.includes(o.priceKey),
  );

  // Amount is inferred from XTRA qty + 1 (since XTRA = extra items beyond the first)
  const xtraItem = items.find((i) => i.key === xtraKey);
  const amount = xtraItem ? xtraItem.qty + 1 : 1;

  // PALLET special product state
  const palletOpt = options.find((o) => o.kind === "install");
  const extraPalletEnabled = !!(palletOpt && keys.includes(palletOpt.priceKey));
  const extraPalletQty =
    items.find((i) => i.key === palletOpt?.priceKey)?.qty ?? 1;

  // ETTER special product state
  const etterOpt = options.find((o) => o.kind === "install");
  const etterEnabled = !!(etterOpt && keys.includes(etterOpt.priceKey));
  const etterQty = items.find((i) => i.key === etterOpt?.priceKey)?.qty ?? 1;

  // TIME special product state
  const selectedTimeOptionIds = options
    .filter((o) => o.kind === "install" && keys.includes(o.priceKey))
    .map((o) => o.id);

  return {
    deliveryType,
    installOptionIds,
    extraOptionIds,
    returnOptionId: returnOption?.id ?? null,
    demontEnabled: !!demontOption,
    amount,
    extraPalletEnabled,
    extraPalletQty,
    etterEnabled,
    etterQty,
    selectedTimeOptionIds,
  };
}

export function ProductCard({
  cardId,
  displayIndex,
  onChange,
  onProductChange,
  onRemove,
  disableRemove,
  isExpanded,
  onToggle,
  dataset = "default",
  initialProductId,
  initialDeliveryType,
  initialItems,
}: Props) {
  const { products, priceItems, getActiveOptions, getPriceDetails } =
    getDataset(dataset);

  /**
   * Computes initial UI state from saved LineItems on first render.
   * Returns null if no initialItems are provided (i.e. new order).
   */
  const seeded = (() => {
    if (!initialItems?.length) return null;
    return extractFromItems(
      initialItems,
      priceItems,
      getActiveOptions(initialProductId ?? null),
    );
  })();

  console.log("initialItems", initialItems);
  console.log("seeded", seeded);
  console.log(
    "priceItems INDOOR key",
    priceItems.find((p) => p.code === "INDOOR")?.key,
  );
  console.log("seeded.deliveryType", seeded?.deliveryType);
  console.log(
    "initialItems keys",
    initialItems?.map((i) => i.key),
  );

  const [productId, setProductId] = useState<string | null>(
    initialProductId ?? null,
  );
  // Then use seeded directly in useState:
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(
    seeded?.deliveryType ?? initialDeliveryType ?? "",
  );
  const [selectedInstallOptionIds, setSelectedInstallOptionIds] = useState<
    string[]
  >(seeded?.installOptionIds ?? []);
  const [returnOptionId, setReturnOptionId] = useState<string | null>(
    seeded?.returnOptionId ?? null,
  );
  const [amount, setAmount] = useState<number>(seeded?.amount ?? 1);
  const [selectedExtraOptionIds, setSelectedExtraOptionIds] = useState<
    string[]
  >(seeded?.extraOptionIds ?? []);
  const [demontEnabled, setDemontEnabled] = useState(
    seeded?.demontEnabled ?? false,
  );
  const [extraPalletEnabled, setExtraPalletEnabled] = useState(
    seeded?.extraPalletEnabled ?? false,
  );
  const [extraPalletQty, setExtraPalletQty] = useState<number>(
    seeded?.extraPalletQty ?? 1,
  );
  const [etterEnabled, setEtterEnabled] = useState(
    seeded?.etterEnabled ?? false,
  );
  const [etterQty, setEtterQty] = useState<number>(seeded?.etterQty ?? 1);
  const [selectedTimeOptionIds, setSelectedTimeOptionIds] = useState<string[]>(
    seeded?.selectedTimeOptionIds ?? [],
  );
  const [extraTimeHours, setExtraTimeHours] = useState<number>(0.5);

  const options = useMemo(
    () => getActiveOptions(productId),
    [productId, getActiveOptions],
  );
  const installOptions = useMemo(
    () => options.filter((o) => o.kind === "install"),
    [options],
  );
  const returnOptions = useMemo(
    () => options.filter((o) => o.kind === "return"),
    [options],
  );
  const extraOptions = useMemo(
    () => options.filter((o) => o.kind === "extra"),
    [options],
  );
  const demontOption = useMemo(
    () => returnOptions.find((o) => o.id === "global_demont"),
    [returnOptions],
  );
  const returnTripOptions = useMemo(
    () => returnOptions.filter((o) => o.id !== "global_demont"),
    [returnOptions],
  );

  const isPALLET = productId === "PALLET";
  const isETTER = productId === "ETTER";
  const isTIME = productId === "TIME";
  const hideDeliveryAndReturn = isPALLET || isETTER || isTIME;

  /**
   * Resets all card state when the user selects a different product.
   * Skips reset on initial mount and when reverting to the seeded product
   * to avoid wiping pre-populated values from an existing order.
   */
  const prevProductId = useRef<string | null | undefined>(
    initialProductId ?? null,
  );
  useEffect(() => {
    if (prevProductId.current === productId) return;
    prevProductId.current = productId;
    if (productId === (initialProductId ?? null)) return;

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
  }, [productId, initialProductId]);

  /**
   * Resets product selection when the dataset changes (e.g. switching
   * between default and power pricing), since product IDs differ between datasets.
   */
  const prevDataset = useRef(dataset);
  useEffect(() => {
    if (prevDataset.current === dataset) return;
    prevDataset.current = dataset;
    setProductId(null);
    onProductChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  /**
   * Looks up the price item key for a given product code (e.g. "INDOOR", "DELIVERY").
   * Returns null if the code is not found in the current dataset's price items.
   */
  function keyFromCode(code: string) {
    return priceItems.find((i) => i.code === code)?.key ?? null;
  }

  /**
   * Clamps a number to a minimum integer value.
   * Used to prevent invalid quantities (e.g. 0 or negative amounts).
   */
  function clampInt(v: number, min: number) {
    const n = Number.isFinite(v) ? Math.floor(v) : min;
    return Math.max(min, n);
  }

  /**
   * Rounds a number to the nearest 0.5 with a minimum of 0.5.
   * Used for TIME product hour inputs (e.g. 0.5, 1.0, 1.5).
   */
  function clampHalfHour(v: number) {
    const rounded = Math.round(v / 0.5) * 0.5;
    return Math.max(0.5, rounded);
  }

  /**
   * Builds the LineItem[] array from current UI state.
   * This is what gets passed to the parent OrderForm and ultimately
   * saved to the order and used by the calculator for pricing.
   * Handles all product types: PALLET, ETTER, TIME, and default delivery flow.
   */
  function buildItems(): LineItem[] {
    const items: LineItem[] = [];
    const amt = clampInt(amount, 1);

    if (isPALLET) {
      const opt = installOptions[0];
      if (opt && extraPalletEnabled)
        items.push({ key: opt.priceKey, qty: clampInt(extraPalletQty, 1) });
      return items;
    }

    if (isETTER) {
      const opt = installOptions[0];
      if (opt && etterEnabled)
        items.push({ key: opt.priceKey, qty: clampInt(etterQty, 1) });
      return items;
    }

    if (isTIME) {
      const hours = clampHalfHour(extraTimeHours);
      for (const optId of selectedTimeOptionIds) {
        const opt = installOptions.find((o) => o.id === optId);
        if (opt) items.push({ key: opt.priceKey, qty: hours });
      }
      return items;
    }

    const showFullServiceList = deliveryType === "Innbæring";

    if (deliveryType === "Første trinn") {
      const k = keyFromCode("DELIVERY");
      if (k) items.push({ key: k, qty: 1 });
      if (amt > 1) {
        const xtra = keyFromCode("XTRA");
        if (xtra) items.push({ key: xtra, qty: amt - 1 });
      }
    }

    if (deliveryType === "Innbæring") {
      const k = keyFromCode("INDOOR");
      if (k) items.push({ key: k, qty: 1 });
      if (amt > 1) {
        const xtra = keyFromCode("XTRA");
        if (xtra) items.push({ key: xtra, qty: amt - 1 });
      }
    }

    if (deliveryType === "Kun Installasjon/Montering") {
      const k = keyFromCode("MONTERING");
      if (k) items.push({ key: k, qty: 1 });
    }

    if (deliveryType === "Kun retur") {
      const k = keyFromCode("RETURN");
      if (k) items.push({ key: k, qty: 1 });
      if (returnOptionId) {
        const opt = returnTripOptions.find((o) => o.id === returnOptionId);
        if (opt) items.push({ key: opt.priceKey, qty: amt });
      }
      return items;
    }

    if (deliveryType === "Kun Installasjon/Montering" || showFullServiceList) {
      for (const optId of selectedInstallOptionIds) {
        const opt = installOptions.find((o) => o.id === optId);
        if (opt) items.push({ key: opt.priceKey, qty: amt });
      }
    }

    if (showFullServiceList && demontEnabled && demontOption)
      items.push({ key: demontOption.priceKey, qty: amt });

    if (showFullServiceList) {
      for (const optId of selectedExtraOptionIds) {
        const opt = extraOptions.find((o) => o.id === optId);
        if (opt) items.push({ key: opt.priceKey, qty: amt });
      }
    }

    if (returnOptionId) {
      const opt = returnTripOptions.find((o) => o.id === returnOptionId);
      if (opt) items.push({ key: opt.priceKey, qty: amt });
    }

    return items;
  }

  /**
   * Notifies the parent OrderForm whenever any pricing-relevant state changes.
   * Triggers recalculation of the calculator total on every selection change.
   */
  useEffect(() => {
    onChange({
      items: buildItems(),
      deliveryType,
      amount: clampInt(amount, 1),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    productId,
    deliveryType,
    selectedInstallOptionIds,
    returnOptionId,
    amount,
    selectedExtraOptionIds,
    demontEnabled,
    extraPalletEnabled,
    extraPalletQty,
    etterEnabled,
    etterQty,
    selectedTimeOptionIds,
    extraTimeHours,
  ]);

  /**
   * Updates both local productId state and notifies the parent
   * of the product change via the onProductChange callback.
   */
  function handleProductSelect(newProductId: string | null) {
    setProductId(newProductId);
    onProductChange?.(newProductId);
  }

  const shownCardNumber = displayIndex ?? cardId + 1;
  const productLabel = productId
    ? (products.find((p) => p.id === productId)?.label ?? "Velg")
    : "Velg";

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
          <h1 className="font-semibold mb-2 text-lg text-textcolor">
            Velg produkt
          </h1>
          <select
            className="customInput w-full"
            value={productId ?? ""}
            onChange={(e) => handleProductSelect(e.target.value || null)}
          >
            <option value="" disabled>
              Choose
            </option>
            {products
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
          </select>

          {!hideDeliveryAndReturn && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Velg leveringstype
              </h1>
              <select
                className="customInput w-full"
                value={deliveryType}
                onChange={(e) =>
                  setDeliveryType(e.target.value as DeliveryType)
                }
                disabled={!productId}
              >
                <option value="" disabled>
                  Velg
                </option>
                <option value="Første trinn">Første trinn</option>
                <option value="Innbæring">Innbæring</option>
                <option value="Kun Installasjon/Montering">
                  Kun Installasjon/Montering
                </option>
                <option value="Kun retur">Kun retur</option>
              </select>
            </>
          )}

          {isPALLET && (
            <>
              <h1 className="font-bold my-2">Extra pall</h1>
              <label className="block">
                <input
                  className="customInput w-full"
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
                    onChange={(e) =>
                      setExtraPalletQty(Number(e.target.value) || 1)
                    }
                    className="customInput w-full"
                  />
                </>
              )}
            </>
          )}

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
                    className="customInput w-full"
                  />
                </>
              )}
            </>
          )}

          {isTIME && (
            <>
              <h1 className="font-bold my-2">Timepris</h1>
              {installOptions.length === 0 ? (
                <p className="text-sm opacity-70">
                  Ingen tidsalternativer for dette produktet.
                </p>
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
                            e.target.checked
                              ? [...prev, opt.id]
                              : prev.filter((x) => x !== opt.id),
                          );
                        }}
                      />
                      <span className="inline">
                        {priceDetails?.label ?? "Unknown option"}
                      </span>
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
                onChange={(e) =>
                  setExtraTimeHours(Number(e.target.value) || 0.5)
                }
                className="customInput w-full"
              />
            </>
          )}

          {!hideDeliveryAndReturn &&
            (deliveryType === "Kun Installasjon/Montering" ||
              deliveryType === "Innbæring") && (
              <>
                <h1 className="font-semibold text-lg text-textcolor my-2">
                  Installasjonsmuligheter
                </h1>
                {installOptions.length === 0 ? (
                  <p className="text-sm opacity-70">
                    Ingen installasjonsalternativer for dette produktet
                  </p>
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
                              e.target.checked
                                ? [...prev, opt.id]
                                : prev.filter((x) => x !== opt.id),
                            );
                          }}
                        />
                        <span className="inline">
                          {priceDetails?.label ?? "Unknown option"}
                        </span>
                      </label>
                    );
                  })
                )}
              </>
            )}

          {!hideDeliveryAndReturn && deliveryType === "Innbæring" && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Utpakking / Demontering
              </h1>
              {demontOption && (
                <label className="block">
                  <input
                    className="inline mr-2"
                    type="checkbox"
                    checked={demontEnabled}
                    onChange={(e) => setDemontEnabled(e.target.checked)}
                  />
                  <span className="inline">
                    {getPriceDetails(demontOption.priceKey)?.label ??
                      "Demontering"}
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
                          e.target.checked
                            ? [...prev, opt.id]
                            : prev.filter((x) => x !== opt.id),
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

          {!hideDeliveryAndReturn && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Return
              </h1>
              {returnTripOptions.length === 0 ? (
                <p className="text-sm opacity-70">
                  No return options for this product.
                </p>
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
                          setReturnOptionId((prev) =>
                            prev === opt.id ? null : opt.id,
                          )
                        }
                      />
                      <span className="inline">
                        {priceDetails?.label ?? "Unknown option"}
                      </span>
                    </label>
                  );
                })
              )}
            </>
          )}

          {!hideDeliveryAndReturn && (
            <>
              <h1 className="font-semibold text-lg text-textcolor my-2">
                Product amount
              </h1>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 1)}
                className="customInput w-full"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

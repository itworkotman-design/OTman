"use client";

import { useEffect, useMemo, useState } from "react";
import { PRODUCTS } from "@/lib/products";
import { PRICE_OPTIONS } from "@/lib/priceOptions";
import { PRICE_ITEMS } from "@/lib/pricing";

type Props = {
  cardId: number;
  onChange: (keys: string[]) => void; // pricing.ts item.key[]
};

function getActiveOptions(productId: string | null) {
  if (!productId) return [];
  return PRICE_OPTIONS.filter((o) => o.productId === productId && o.active);
}

export function ProductCard({ cardId, onChange }: Props) {
  const [productId, setProductId] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<"" | "First step" | "Installation">("");
  const [selectedInstallOptionIds, setSelectedInstallOptionIds] = useState<string[]>([]);
  const [returnOptionId, setReturnOptionId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(1);

  const options = useMemo(() => getActiveOptions(productId), [productId]);
  const installOptions = useMemo(() => options.filter((o) => o.kind === "install"), [options]);
  const returnOptions = useMemo(() => options.filter((o) => o.kind === "return"), [options]);

  // helper: for global (non product-specific) services if you need them later
  function keyFromCode(code: string) {
    return PRICE_ITEMS.find((i: { code: string; }) => i.code === code)?.key ?? null;
  }

  // Reset dependent selections when product changes
  useEffect(() => {
    setDeliveryType("");
    setSelectedInstallOptionIds([]);
    setReturnOptionId(null);
    setAmount(1);
  }, [productId]);

  function buildPriceKeys(): string[] {
    const keys: string[] = [];

    // Example: if "First step" has a global price code in pricing.ts
    if (deliveryType === "First step") {
      const k = keyFromCode("DELIVERY"); // adjust if your code differs
      if (k) keys.push(k);
    }

    // Installation options (product-specific) → use priceKey directly
    if (deliveryType === "Installation") {
      for (const optId of selectedInstallOptionIds) {
        const opt = installOptions.find((o) => o.id === optId);
        if (!opt) continue;

        for (let i = 0; i < amount; i++) keys.push(opt.priceKey);
      }
    }

    // Return option (single) → use priceKey directly
    if (returnOptionId) {
      const opt = returnOptions.find((o) => o.id === returnOptionId);
      if (opt) keys.push(opt.priceKey);
    }

    return keys;
  }

  // Send keys to parent whenever selections change
  useEffect(() => {
    onChange(buildPriceKeys());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, deliveryType, selectedInstallOptionIds, returnOptionId, amount]);

  return (
    <div className="w-full px-8 py-8 mt-4 rounded-2xl border">
      {/* Head */}
      <div className="flex pb-2 mb-4 border-b">
        <div className="w-6 h-6 bg-gray-200 flex items-center justify-center rounded-2xl mr-2">
          <span>{cardId + 1}</span>
        </div>
        <h1 className="items-center">Chosen Product</h1>
      </div>

      {/* Body */}
      <div>
        <h1 className="font-bold mb-2">Choose product</h1>
        <select
          className="w-full py-2 px-2 rounded-xl border"
          value={productId ?? ""}
          onChange={(e) => setProductId(e.target.value || null)}
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

        <h1 className="font-bold my-2">Choose delivery type</h1>
        <select
          className="w-full py-2 px-2 rounded-xl border"
          value={deliveryType}
          onChange={(e) => setDeliveryType(e.target.value as never)}
          disabled={!productId}
        >
          <option value="" disabled>
            Choose
          </option>
          <option value="First step">First step</option>
          <option value="Installation">Installation</option>
        </select>

        {/* Installation options */}
        {deliveryType === "Installation" && (
          <>
            <h1 className="font-bold my-2">Installation options</h1>

            {installOptions.length === 0 ? (
              <p className="text-sm opacity-70">No installation options for this product.</p>
            ) : (
              installOptions.map((opt) => (
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
                  <span className="inline">{opt.optionLabel}</span>
                </label>
              ))
            )}
          </>
        )}

        {/* Return */}
        <h1 className="font-bold my-2">Return</h1>
        {returnOptions.length === 0 ? (
          <p className="text-sm opacity-70">No return options for this product.</p>
        ) : (
          returnOptions.map((opt) => (
            <label key={opt.id} className="block my-1">
              <input
                className="inline mr-2"
                type="radio"
                name={`return-${cardId}`}
                checked={returnOptionId === opt.id}
                onChange={() => setReturnOptionId(opt.id)}
              />
              <span className="inline">{opt.optionLabel}</span>
            </label>
          ))
        )}

        {/* Amount */}
        <h1 className="font-bold my-2">Product amount</h1>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 1)}
          className="w-full py-2 px-2 rounded-xl border"
        />
      </div>
    </div>
  );
}

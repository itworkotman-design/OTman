"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import type {
  CalculatorAdjustments,
  PriceLookup,
  ProductBreakdown,
} from "@/lib/booking/pricing/types";


function formatNOK(n: number) {
  return `${n.toFixed(2)} NOK`;
}

function formatQty(qty: number) {
  const rounded = Math.round(qty * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

type Props = {
  productBreakdowns: ProductBreakdown[];
  priceLookup: PriceLookup;
  adminView?: boolean;
  onPriceChange?: (exVat: number, subcontractorPrice: number) => void;
  initialRabatt?: number;
  initialLeggTil?: number;
  initialSubcontractorMinus?: number;
  initialSubcontractorPlus?: number;
  onAdjustmentsChange?: (adjustments: CalculatorAdjustments) => void;
  sidebarMode?: boolean;
};

export function CalculatorDisplayNew({
  productBreakdowns,
  priceLookup,
  adminView = false,
  onPriceChange,
  initialRabatt,
  initialLeggTil,
  initialSubcontractorMinus,
  initialSubcontractorPlus,
  onAdjustmentsChange,
  sidebarMode = false,
}: Props) {
  const [rabatt, setRabatt] = useState(
    initialRabatt != null && initialRabatt !== 0 ? String(initialRabatt) : "",
  );
  const [leggTil, setLeggTil] = useState(
    initialLeggTil != null && initialLeggTil !== 0
      ? String(initialLeggTil)
      : "",
  );
  const [subcontractorMinus, setSubcontractorMinus] = useState(
    initialSubcontractorMinus != null && initialSubcontractorMinus !== 0
      ? String(initialSubcontractorMinus)
      : "",
  );
  const [subcontractorPlus, setSubcontractorPlus] = useState(
    initialSubcontractorPlus != null && initialSubcontractorPlus !== 0
      ? String(initialSubcontractorPlus)
      : "",
  );

  const adjustments = useMemo(
    () => ({
      rabatt,
      leggTil,
      subcontractorMinus,
      subcontractorPlus,
    }),
    [rabatt, leggTil, subcontractorMinus, subcontractorPlus],
  );

  const result = useMemo(
    () =>
      calculateBookingPricing({
        productBreakdowns,
        priceLookup,
        adjustments,
      }),
    [productBreakdowns, priceLookup, adjustments],
  );

  useEffect(() => {
    onPriceChange?.(result.totals.totalExVat, result.totals.subcontractorTotal);
    onAdjustmentsChange?.(adjustments);
  }, [result, adjustments, onPriceChange, onAdjustmentsChange]);

  return (
    <section
      className={[
        "w-full customContainer rounded-2xl px-4 bg-mainPrimary",
        sidebarMode ? "max-h-[calc(100vh-10rem)] overflow-y-auto" : "",
      ].join(" ")}
    >
      <div className="border-b-2 border-lineSecondary py-4">
        {result.breakdowns.length === 0 ? (
          <p className="text-sm opacity-30">No products selected.</p>
        ) : (
          result.breakdowns.map((product, productIdx) => (
            <div key={productIdx} className="mb-4 last:mb-0">
              <h1 className="font-bold text-md mb-2">{product.productName}</h1>

              {product.lines.length === 0 ? (
                <p className="text-sm opacity-30 ml-2">
                  No services selected for this product.
                </p>
              ) : (
                product.lines.map((line, idx) => (
                  <div key={idx} className="priceRow ml-2">
                    <h1 className="text-sm">
                      {line.qty > 1 && (
                        <span className="opacity-70 mr-1">
                          x{formatQty(line.qty)}
                        </span>
                      )}

                      {line.code && (
                        <span className="text-logoblue mr-1">
                          ({line.code})
                        </span>
                      )}

                      {line.label}
                    </h1>

                    <p className="font-semibold text-sm whitespace-nowrap">
                      {line.lineTotal} NOK
                    </p>
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </div>

      <div className="pb-4">
        <div className="priceRow">
          <h1 className="font-bold text-2xl">Total</h1>
          <p className="font-bold text-2xl">
            {formatNOK(result.totals.totalExVat)}
          </p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">VAT (25%)</h1>
          <p className="font-semibold">{formatNOK(result.totals.vat)}</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">Total incl. VAT</h1>
          <p className="font-semibold">
            {formatNOK(result.totals.totalIncVat)}
          </p>
        </div>

        {adminView && (
          <div className="mt-8 space-y-4">
            <div className="lg:flex items-center">
              <h1 className="whitespace-nowrap">Discount (ex VAT):</h1>
              <input
                type="text"
                value={rabatt}
                onChange={(e) => setRabatt(e.target.value)}
                className="customInput w-full ml-2 h-8"
                placeholder="e.g. 500"
              />
            </div>

            <div className="lg:flex items-center">
              <h1 className="whitespace-nowrap">Extra (ex VAT):</h1>
              <input
                type="text"
                value={leggTil}
                onChange={(e) => setLeggTil(e.target.value)}
                className="customInput w-full ml-2 h-8"
                placeholder="e.g. 300"
              />
            </div>

            <div className="lg:flex items-center">
              <h1 className="whitespace-nowrap">Subcontractor minus:</h1>
              <input
                type="text"
                value={subcontractorMinus}
                onChange={(e) => setSubcontractorMinus(e.target.value)}
                className="customInput w-full ml-2 h-8"
                placeholder="e.g. 200"
              />
            </div>

            <div className="lg:flex items-center">
              <h1 className="whitespace-nowrap">Subcontractor plus:</h1>
              <input
                type="text"
                value={subcontractorPlus}
                onChange={(e) => setSubcontractorPlus(e.target.value)}
                className="customInput w-full ml-2 h-8"
                placeholder="e.g. 200"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

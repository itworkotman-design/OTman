"use client";

import { useEffect, useMemo } from "react";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import type {
  CalculatorAdjustments,
  PriceLookup,
  ProductBreakdown,
} from "@/lib/booking/pricing/types";

function roundPriceRule(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatNOK(n: number) {
  return `${Math.round(n)} NOK`;
}

function formatSumNOK(n: number) {
  return roundPriceRule(n).toFixed(2);
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
  rabatt?: string;
  leggTil?: string;
  subcontractorMinus?: string;
  subcontractorPlus?: string;
  onAdjustmentsChange?: (adjustments: CalculatorAdjustments) => void;
  sidebarMode?: boolean;
};

export function CalculatorDisplayNew({
  productBreakdowns,
  priceLookup,
  adminView = false,
  onPriceChange,
  rabatt = "",
  leggTil = "",
  subcontractorMinus = "",
  subcontractorPlus = "",
  onAdjustmentsChange,
  sidebarMode = false,
}: Props) {
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
    onPriceChange?.(
      roundPriceRule(result.totals.totalExVat),
      roundPriceRule(result.totals.subcontractorTotal),
    );
  }, [result, onPriceChange]);

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
              <h1 className="font-bold text-md mb-2">
                {product.productName}
                {product.productModelNumber ? (
                  <span className="ml-1 text-sm font-normal text-gray-500">
                    ({product.productModelNumber})
                  </span>
                ) : null}
              </h1>

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
                      {formatNOK(line.lineTotal)}
                    </p>
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </div>

      <div className="pb-4">
        {result.totals.discount !== 0 && (
          <div className="priceRow">
            <h1 className="text-md">Rabatt</h1>
            <p className="font-semibold">
              -{formatSumNOK(result.totals.discount)} NOK
            </p>
          </div>
        )}

        {result.totals.extra !== 0 && (
          <div className="priceRow">
            <h1 className="text-md">Ekstra</h1>
            <p className="font-semibold">
              {result.totals.extra > 0 ? "+" : ""}
              {formatSumNOK(result.totals.extra)} NOK
            </p>
          </div>
        )}

        <div className="priceRow">
          <h1 className="font-bold text-2xl">Total</h1>
          <p className="font-bold text-2xl">
            {formatSumNOK(result.totals.totalExVat)} NOK
          </p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">VAT (25%)</h1>
          <p className="font-semibold">
            {formatSumNOK(result.totals.vat)} NOK
          </p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">Total incl. VAT</h1>
          <p className="font-semibold">
            {formatSumNOK(result.totals.totalIncVat)} NOK
          </p>
        </div>

        {adminView && (
          <div className="mt-8 space-y-4">
            <div className="lg:flex items-center">
              <h1 className="whitespace-nowrap">Discount (ex VAT):</h1>
              <input
                type="text"
                value={rabatt}
                onChange={(e) =>
                  onAdjustmentsChange?.({
                    ...adjustments,
                    rabatt: e.target.value,
                  })
                }
                className="customInput w-full ml-2 h-8"
                placeholder="e.g. 500"
              />
            </div>

            <div className="lg:flex items-center">
              <h1 className="whitespace-nowrap">Extra (ex VAT):</h1>
              <input
                type="text"
                value={leggTil}
                onChange={(e) =>
                  onAdjustmentsChange?.({
                    ...adjustments,
                    leggTil: e.target.value,
                  })
                }
                className="customInput w-full ml-2 h-8"
                placeholder="e.g. 300"
              />
            </div>

            <div className="lg:flex items-center">
              <h1 className="whitespace-nowrap">Subcontractor minus:</h1>
              <input
                type="text"
                value={subcontractorMinus}
                onChange={(e) =>
                  onAdjustmentsChange?.({
                    ...adjustments,
                    subcontractorMinus: e.target.value,
                  })
                }
                className="customInput w-full ml-2 h-8"
                placeholder="e.g. 200"
              />
            </div>

            <div className="lg:flex items-center">
              <h1 className="whitespace-nowrap">Subcontractor plus:</h1>
              <input
                type="text"
                value={subcontractorPlus}
                onChange={(e) =>
                  onAdjustmentsChange?.({
                    ...adjustments,
                    subcontractorPlus: e.target.value,
                  })
                }
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

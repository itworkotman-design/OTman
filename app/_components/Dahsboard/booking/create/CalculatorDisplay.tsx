"use client";

import { useEffect, useMemo, useRef } from "react";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import type {
  CalculatorAdjustments,
  PriceLookup,
  ProductBreakdown,
} from "@/lib/booking/pricing/types";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

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
  forcedTotalExVat?: number;
  forcedSubcontractorTotal?: number;
  adminView?: boolean;
  onPriceChange?: (exVat: number, subcontractorPrice: number) => void;
  rabatt?: string;
  leggTil?: string;
  subcontractorMinus?: string;
  subcontractorPlus?: string;
  onAdjustmentsChange?: (adjustments: CalculatorAdjustments) => void;
  sidebarMode?: boolean;
  locale?: BookingUiLocale;
  hideWordpressImportWarnings?: boolean;
};

export function CalculatorDisplayNew({
  productBreakdowns,
  priceLookup,
  forcedTotalExVat,
  forcedSubcontractorTotal,
  adminView = false,
  onPriceChange,
  rabatt = "",
  leggTil = "",
  subcontractorMinus = "",
  subcontractorPlus = "",
  onAdjustmentsChange,
  sidebarMode = false,
  locale = "en",
  hideWordpressImportWarnings,
}: Props) {
  const t = (text: string) => bookingText(locale, text);
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
const displayTotals = useMemo(() => {
  if (forcedTotalExVat == null && forcedSubcontractorTotal == null) return result.totals;

  const totalExVat = roundPriceRule(forcedTotalExVat ?? result.totals.totalExVat);
  const vat = roundPriceRule(totalExVat * 0.25);
  const totalIncVat = roundPriceRule(totalExVat + vat);
  const subcontractorTotal = roundPriceRule(forcedSubcontractorTotal ?? result.totals.subcontractorTotal);

  return { ...result.totals, totalExVat, vat, totalIncVat, subcontractorTotal };
}, [forcedSubcontractorTotal, forcedTotalExVat, result.totals]);

const onPriceChangeRef = useRef(onPriceChange);

useEffect(() => {
    onPriceChangeRef.current = onPriceChange;
  });

const lastReportedRef = useRef<{ exVat: number; sub: number } | null>(null);

useEffect(() => {
  const exVat = roundPriceRule(result.totals.totalExVat);
  const sub = roundPriceRule(result.totals.subcontractorTotal);

  if (lastReportedRef.current?.exVat === exVat && lastReportedRef.current?.sub === sub) return;

  lastReportedRef.current = { exVat, sub };
  onPriceChangeRef.current?.(exVat, sub);
}, [result.totals.totalExVat, result.totals.subcontractorTotal]);

  return (
    <section className={["w-full customContainer rounded-2xl px-4 bg-mainPrimary", sidebarMode ? "max-h-[calc(100vh-10rem)] overflow-y-auto" : ""].join(" ")}>
      <div className="border-b-2 border-lineSecondary py-4">
        {result.breakdowns.length === 0 ? (
          <p className="text-sm opacity-30">{t("No products selected.")}</p>
        ) : (
          result.breakdowns.map((product, productIdx) => (
            <div
              key={productIdx}
              className={[
                "mb-4 last:mb-0",
                product.readOnly && !hideWordpressImportWarnings ? "rounded-lg border border-gray-300 bg-gray-100 p-3 text-gray-600" : "",
              ].join(" ")}
            >
              <h1 className="font-bold text-md mb-2">
                {product.productName}
                {product.productModelNumber ? <span className="ml-1 text-sm font-normal text-gray-500">({product.productModelNumber})</span> : null}
              </h1>
              {product.comment && !hideWordpressImportWarnings ? <p className="mb-2 text-sm font-semibold text-gray-600">{product.comment}</p> : null}

              {product.lines.length === 0 ? (
                <p className="text-sm opacity-30 ml-2">{t("No services selected for this product.")}</p>
              ) : (
                product.lines.map((line, idx) => (
                  <div key={idx} className="priceRow ml-2">
                    <h1 className="text-sm">
                      {line.qty > 1 && <span className="opacity-70 mr-1">x{formatQty(line.qty)}</span>}

                      {line.code && <span className="text-logoblue mr-1">({line.code})</span>}

                      {line.label}
                    </h1>

                    <p className="font-semibold text-sm whitespace-nowrap">{formatNOK(line.lineTotal)}</p>
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
            <h1 className="text-md">{t("Discount")}</h1>
            <p className="font-semibold">-{formatSumNOK(result.totals.discount)} NOK</p>
          </div>
        )}

        {result.totals.extra !== 0 && (
          <div className="priceRow">
            <h1 className="text-md">{t("Extra")}</h1>
            <p className="font-semibold">
              {result.totals.extra > 0 ? "+" : ""}
              {formatSumNOK(result.totals.extra)} NOK
            </p>
          </div>
        )}

        {result.totals.subcontractorMinus !== 0 && (
          <div className="priceRow">
            <h1 className="text-md">{t("Subcontractor minus")}</h1>
            <p className="font-semibold">-{formatSumNOK(result.totals.subcontractorMinus)} NOK</p>
          </div>
        )}

        {result.totals.subcontractorPlus !== 0 && (
          <div className="priceRow">
            <h1 className="text-md">{t("Subcontractor plus")}</h1>
            <p className="font-semibold">+{formatSumNOK(result.totals.subcontractorPlus)} NOK</p>
          </div>
        )}

        <div className="priceRow">
          <h1 className="font-bold text-2xl">{t("Total")}</h1>
          <p className="font-bold text-2xl">{formatSumNOK(displayTotals.totalExVat)} NOK</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">{t("VAT (25%)")}</h1>
          <p className="font-semibold">{formatSumNOK(displayTotals.vat)} NOK</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">{t("Total incl. VAT")}</h1>
          <p className="font-semibold">{formatSumNOK(displayTotals.totalIncVat)} NOK</p>
        </div>

        {adminView && (
          <div className="mt-8 space-y-4">
            <div className="lg:flex items-center">
              <h1 className="whitespace-nowrap">{t("Discount (ex VAT)")}:</h1>
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
              <h1 className="whitespace-nowrap">{t("Extra (ex VAT)")}:</h1>
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
              <h1 className="whitespace-nowrap">{t("Subcontractor minus")}:</h1>
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
              <h1 className="whitespace-nowrap">{t("Subcontractor plus")}:</h1>
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

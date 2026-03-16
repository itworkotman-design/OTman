"use client";

import { useEffect, useMemo, useState } from "react";
import type { LineItem } from "@/app/_components/Dahsboard/booking/create/ProductCard";
import { PRICE_ITEMS_DEFAULT } from "@/lib/prices_default/pricingDefault";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseNOK(input: string) {
  const s = input.replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatNOK(n: number) {
  return `${n.toFixed(2)} NOK`;
}

function formatQty(qty: number) {
  const rounded = Math.round(qty * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

// ============================================================================
// TYPES
// ============================================================================

type ProductBreakdown = {
  productName: string;
  items: LineItem[];
};

type Props = {
  total: number;
  subcontractorTotal: number;
  productBreakdowns: ProductBreakdown[];
  adminView?: boolean;
  onPriceChange?: (exVat: number, subcontractorPrice: number) => void;
  // ← NEW: controlled initial values
  initialRabatt?: number;
  initialLeggTil?: number;
  initialSubcontractorMinus?: number;
  initialSubcontractorPlus?: number;
  // ← NEW: callback so parent can read current adjustment strings
  onAdjustmentsChange?: (adjustments: {
    rabatt: string;
    leggTil: string;
    subcontractorMinus: string;
    subcontractorPlus: string;
  }) => void;
};

// ============================================================================
// COMPONENT
// ============================================================================

export function CalculatorDisplay({
  total,
  subcontractorTotal,
  productBreakdowns,
  adminView = false,
  onPriceChange,
  initialRabatt,
  initialLeggTil,
  initialSubcontractorMinus,
  initialSubcontractorPlus,
  onAdjustmentsChange,
}: Props) {
  const [rabatt, setRabatt] = useState(
  initialRabatt != null && initialRabatt !== 0 ? String(initialRabatt) : ""
);
const [leggTil, setLegTil] = useState(
  initialLeggTil != null && initialLeggTil !== 0 ? String(initialLeggTil) : ""
);
const [subcontractorMinus, setSubcontractorMinus] = useState(
  initialSubcontractorMinus != null && initialSubcontractorMinus !== 0
    ? String(initialSubcontractorMinus)
    : ""
);
const [subcontractorPlus, setSubcontractorPlus] = useState(
  initialSubcontractorPlus != null && initialSubcontractorPlus !== 0
    ? String(initialSubcontractorPlus)
    : ""
);

  const discount = useMemo(() => parseNOK(rabatt), [rabatt]);
  const plus = useMemo(() => parseNOK(leggTil), [leggTil]);
  const subMinus = useMemo(() => parseNOK(subcontractorMinus), [subcontractorMinus]);
  const subPlus = useMemo(() => parseNOK(subcontractorPlus), [subcontractorPlus]);

  const totalExVat = Math.max(0, total - discount + plus);
  const vat = totalExVat * 0.25;
  const totalIncVat = totalExVat + vat;
  const subcontractorPrice = Math.max(0, subcontractorTotal - subMinus + subPlus);

  useEffect(() => {
    onPriceChange?.(totalExVat, subcontractorPrice);
    onAdjustmentsChange?.({ rabatt, leggTil, subcontractorMinus, subcontractorPlus });
  }, [totalExVat, subcontractorPrice, rabatt, leggTil, subcontractorMinus, subcontractorPlus, onPriceChange, onAdjustmentsChange]);

  return (
    <section className="w-full customContainer rounded-2xl px-4 max-h-[calc(100vh-9rem)] overflow-y-auto bg-mainPrimary ">
      {/* TOP SECTION - Product breakdowns */}
      <div className="border-b-2 border-lineSecondary py-4">
        {productBreakdowns.length === 0 ? (
          <p className="text-sm opacity-30">No products selected.</p>
        ) : (
          productBreakdowns.map((product, productIdx) => {
            // Group by key, carrying priceOverride through
            const grouped = new Map<string, { qty: number; priceOverride?: number }>();
            for (const it of product.items) {
              const existing = grouped.get(it.key);
              grouped.set(it.key, {
                qty: (existing?.qty ?? 0) + it.qty,
                priceOverride:
                  it.priceOverride !== undefined
                    ? it.priceOverride
                    : existing?.priceOverride,
              });
            }

            // Convert grouped keys to price items
            const lines = Array.from(grouped.entries())
              .map(([key, { qty, priceOverride }]) => {
                const item = PRICE_ITEMS_DEFAULT.find((i) => i.key === key);
                if (!item) return null;
                return { item, qty, priceOverride };
              })
              .filter((x): x is NonNullable<typeof x> => x !== null);

            return (
              <div key={productIdx} className="mb-4 last:mb-0">
                <h1 className="font-bold text-md mb-2">{product.productName}</h1>

                {lines.length === 0 ? (
                  <p className="text-sm opacity-30 ml-2">No services selected for this product.</p>
                ) : (
                  lines.map(({ item, qty, priceOverride }) => {
                    const price =
                      priceOverride !== undefined ? priceOverride : item.customerPrice;
                    const lineTotal = price * qty;

                    return (
                      <div key={item.key} className="priceRow ml-2">
                        <h1 className="text-sm">
                          {qty > 1 && (
                            <span className="opacity-70 mr-1">x{formatQty(qty)}</span>
                          )}
                          {item.label} <span className="text-logoblue">({item.code})</span>
                        </h1>

                        <p className="font-semibold text-sm whitespace-nowrap">
                          {lineTotal} NOK
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })
        )}
      </div>

      {/* BOTTOM SECTION - Totals and adjustments */}
      
      <div className="pb-4">
        <div className="priceRow">
          <h1 className="font-bold text-2xl">Total</h1>
          <p className="font-bold text-2xl">{formatNOK(totalExVat)}</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">MVA (25%)</h1>
          <p className="font-semibold">{formatNOK(vat)}</p>
        </div>

        <div className="priceRow">
          <h1 className="text-md">Total inkl. MVA</h1>
          <p className="font-semibold">{formatNOK(totalIncVat)}</p>
        </div>
        {adminView && (
        <div id="editModeCalculator">
          <div className="mt-8 lg:flex items-center">
            <h1 className="whitespace-nowrap">Rabatt (uten MVA): </h1>
            <input
              id="rabattInput"
              type="text"
              value={rabatt}
              onChange={(e) => setRabatt(e.target.value)}
              className="customInput w-full ml-2 h-8"
              placeholder="f.eks. 500"
            />
            <button
              id="btnBrukRabatt"
              type="button"
              disabled={!rabatt.trim()}
              className="ml-2 customButtonDefault h-8 lg:mt-0 w-full lg:w-auto"
            >
              Bruk rabatt
            </button>
          </div>

          <div className="mt-4 lg:flex items-center">
            <h1 className="whitespace-nowrap">Ekstra (uten MVA): </h1>
            <input
              id="ekstraRabattInput"
              type="text"
              value={leggTil}
              onChange={(e) => setLegTil(e.target.value)}
              className="customInput w-full ml-3 h-8"
              placeholder="f.eks. 300"
            />
            <button
              id="btnLeggTil"
              type="button"
              disabled={!leggTil.trim()}
              className="ml-2 customButtonDefault h-8 mt-2 lg:mt-0 w-full lg:w-auto "
            >
              Legg til
            </button>
          </div>

          <div className="mt-8 lg:flex justify-evenly">
            <button
              id="btnSummary"
              type="button"
              className="customButtonDefault w-full"
            >
              Summary
            </button>
            <button
              id="btnSubcontractorSummary"
              type="button"
              className="customButtonDefault w-full mt-4 lg:mt-0"
            >
              Subcontractor Summary
            </button>
          </div>

          <div className="mt-8 lg:flex items-center">
            <h1 className="whitespace-nowrap">Subcontractor minus: </h1>
            <input
              value={subcontractorMinus}
              onChange={(e) => setSubcontractorMinus(e.target.value)}
              id="subcontractorMinusInput"
              type="text"
              className="customInput w-full ml-2 h-8"
              placeholder="f.eks. 200"
            />
            <button
              type="button"
              disabled={!leggTil.trim()}
              className="ml-2 customButtonDefault h-8 mt-2 lg:mt-0 w-full lg:w-auto"
            >
              Legg til
            </button>
          </div>

          <div className="mt-8 lg:flex items-center">
            <h1 className="whitespace-nowrap">Subcontractor plus: </h1>
            <input
              value={subcontractorPlus}
              onChange={(e) => setSubcontractorPlus(e.target.value)}
              id="subcontractorPlusInput"
              type="text"
              className="customInput w-full ml-5 h-8"
              placeholder="f.eks. 200"
            />
            <button
              type="button"
              disabled={!leggTil.trim()}
              className="ml-2 customButtonDefault h-8 disabled:opacity-60 mt-2 lg:mt-0 w-full lg:w-auto"
            >
              Legg til
            </button>
          </div>

          <div id="existingOrderId" className="mt-8">
            <h1 className="text-xl font-semibold">Bestiller: POWER Skullerud</h1>
            <p>Ordre-ID: 13288</p>
          </div>
        </div>)}
      </div>
    </section>
  );
}
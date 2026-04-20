"use client";

import React from "react";
import { CalculatorDisplayNew } from "@/app/_components/Dahsboard/booking/create/CalculatorDisplay";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";

type Props = {
  calcOpen: boolean;
  setCalcOpen: React.Dispatch<React.SetStateAction<boolean>>;
  productBreakdowns: ReturnType<typeof buildProductBreakdowns>;
  priceLookup: ReturnType<typeof buildPriceLookup>;
  adminView: boolean;
  onPriceChange: (exVat: number, subPrice: number) => void;
  rabatt?: string;
  leggTil?: string;
  subcontractorMinus?: string;
  subcontractorPlus?: string;
  onAdjustmentsChange: (adj: {
    rabatt: string;
    leggTil: string;
    subcontractorMinus: string;
    subcontractorPlus: string;
  }) => void;
  sidebarMode?: boolean;
};

export default function BookingCalculatorPanel({
  calcOpen,
  setCalcOpen,
  productBreakdowns,
  priceLookup,
  adminView,
  onPriceChange,
  rabatt,
  leggTil,
  subcontractorMinus,
  subcontractorPlus,
  onAdjustmentsChange,
  sidebarMode = false,
}: Props) {
  return (
    <>
      <div className="lg:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40">
        {!calcOpen ? (
          <button
            type="button"
            onClick={() => setCalcOpen(true)}
            className="h-80 w-10 rounded-l-full bg-white shadow-xl border border-black/10 flex items-center justify-center"
            aria-label="Open calculator"
          >
            <span className="[writing-mode:vertical-rl] rotate-180 text-md font-semibold text-logoblue">
              Calculator
            </span>
          </button>
        ) : (
          <div className="flex max-h-[85vh] w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setCalcOpen(false)}
              className="rounded-4xl bg-logoblue text-sm font-semibold w-[80] h-[40] text-white text-center ml-auto mr-2 mt-2 shrink-0"
              aria-label="Close calculator"
            >
              Close
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <CalculatorDisplayNew
                productBreakdowns={productBreakdowns}
                priceLookup={priceLookup}
                adminView={adminView}
                onPriceChange={onPriceChange}
                rabatt={rabatt}
                leggTil={leggTil}
                subcontractorMinus={subcontractorMinus}
                subcontractorPlus={subcontractorPlus}
                onAdjustmentsChange={onAdjustmentsChange}
                sidebarMode={false}
              />
            </div>
          </div>
        )}
      </div>

      <div className="hidden lg:block w-full">
        <CalculatorDisplayNew
          productBreakdowns={productBreakdowns}
          priceLookup={priceLookup}
          adminView={adminView}
          onPriceChange={onPriceChange}
          rabatt={rabatt}
          leggTil={leggTil}
          subcontractorMinus={subcontractorMinus}
          subcontractorPlus={subcontractorPlus}
          onAdjustmentsChange={onAdjustmentsChange}
          sidebarMode={sidebarMode}
        />
      </div>
    </>
  );
}

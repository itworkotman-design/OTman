"use client";

import React from "react";
import {
  CalculatorDisplayNew,
  SubcontractorCalculatorDisplay,
} from "@/app/_components/Dahsboard/booking/create/CalculatorDisplay";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { bookingText, type BookingUiLocale } from "@/lib/booking/bookingUiText";

type Props = {
  calcOpen: boolean;
  setCalcOpen: React.Dispatch<React.SetStateAction<boolean>>;
  productBreakdowns: ReturnType<typeof buildProductBreakdowns>;
  priceLookup: ReturnType<typeof buildPriceLookup>;
  forcedTotalExVat?: number;
  forcedSubcontractorTotal?: number;
  adminView: boolean;
  onPriceChange: (exVat: number, subPrice: number) => void;
  rabatt?: string;
  leggTil?: string;
  subcontractorMinus?: string;
  subcontractorPlus?: string;
  onAdjustmentsChange: (adj: { rabatt: string; leggTil: string; subcontractorMinus: string; subcontractorPlus: string }) => void;
  onToggleCustomerNulled?: (cardId: number, lineKey: string, nulled: boolean) => void;
  onToggleSubcontractorNulled?: (cardId: number, lineKey: string, nulled: boolean) => void;
  onToggleCustomerOrderExtraNulled?: (lineKey: string, nulled: boolean) => void;
  onToggleSubcontractorOrderExtraNulled?: (lineKey: string, nulled: boolean) => void;
  priceUpdateAvailable?: boolean;
  priceUpdateStoredTotalExVat?: number;
  priceUpdateCurrentTotalExVat?: number;
  onUseCurrentPrices?: () => void;
  sidebarMode?: boolean;
  locale?: BookingUiLocale;
};

export default function BookingCalculatorPanel({
  calcOpen,
  setCalcOpen,
  productBreakdowns,
  priceLookup,
  forcedTotalExVat,
  forcedSubcontractorTotal,
  adminView,
  onPriceChange,
  rabatt,
  leggTil,
  subcontractorMinus,
  subcontractorPlus,
  onAdjustmentsChange,
  onToggleCustomerNulled,
  onToggleSubcontractorNulled,
  onToggleCustomerOrderExtraNulled,
  onToggleSubcontractorOrderExtraNulled,
  priceUpdateAvailable = false,
  priceUpdateStoredTotalExVat,
  priceUpdateCurrentTotalExVat,
  onUseCurrentPrices,
  sidebarMode = false,
  locale = "en",
}: Props) {
  const t = (text: string) => bookingText(locale, text);
  const formatPrice = (value: number) => `${Math.round(value)} NOK`;

  function handleSubcontractorAdjustmentsChange(
    nextMinus: string,
    nextPlus: string,
  ) {
    onAdjustmentsChange({
      rabatt: rabatt ?? "",
      leggTil: leggTil ?? "",
      subcontractorMinus: nextMinus,
      subcontractorPlus: nextPlus,
    });
  }
  const priceUpdateNotice = priceUpdateAvailable ? (
    <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
      <p className="font-semibold">{locale === "nb" ? "Dette bestillinger har endret pris." : "Hey, this order changed prices."}</p>
      {priceUpdateStoredTotalExVat != null && priceUpdateCurrentTotalExVat != null ? (
        <p className="mt-1">
          {locale === "nb" ? "Gammel total" : "Old total"}: {formatPrice(priceUpdateStoredTotalExVat)} · {locale === "nb" ? "Ny total" : "New total"}:{" "}
          {formatPrice(priceUpdateCurrentTotalExVat)}
        </p>
      ) : null}
      <button
        type="button"
        className="mt-2 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
        onClick={onUseCurrentPrices}
      >
        {t("Use new price")}
      </button>
    </div>
  ) : null;

  return (
    <>
      <div className="lg:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40">
        {!calcOpen ? (
          <button
            type="button"
            onClick={() => setCalcOpen(true)}
            className="h-80 w-10 rounded-l-full bg-white shadow-xl border border-black/10 flex items-center justify-center"
            aria-label={locale === "nb" ? "Åpne kalkulator" : "Open calculator"}
          >
            <span className="[writing-mode:vertical-rl] rotate-180 text-md font-semibold text-logoblue">{t("Calculator")}</span>
          </button>
        ) : (
          <div className="flex max-h-[85vh] w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setCalcOpen(false)}
              className="rounded-4xl bg-logoblue text-sm font-semibold w-[80] h-[40] text-white text-center ml-auto mr-2 mt-2 shrink-0"
              aria-label={locale === "nb" ? "Lukk kalkulator" : "Close calculator"}
            >
              {t("Close")}
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {priceUpdateNotice}
              <CalculatorDisplayNew
                productBreakdowns={productBreakdowns}
                priceLookup={priceLookup}
                forcedTotalExVat={forcedTotalExVat}
                forcedSubcontractorTotal={forcedSubcontractorTotal}
                adminView={adminView}
                onPriceChange={onPriceChange}
                rabatt={rabatt}
                leggTil={leggTil}
                subcontractorMinus={subcontractorMinus}
                subcontractorPlus={subcontractorPlus}
                onAdjustmentsChange={onAdjustmentsChange}
                onToggleLineNulled={onToggleCustomerNulled}
                onToggleOrderExtraLineNulled={onToggleCustomerOrderExtraNulled}
                sidebarMode={false}
                locale={locale}
              />
              {adminView && (
                <SubcontractorCalculatorDisplay
                  productBreakdowns={productBreakdowns}
                  priceLookup={priceLookup}
                  rabatt={rabatt}
                  subcontractorMinus={subcontractorMinus}
                  subcontractorPlus={subcontractorPlus}
                  onSubcontractorAdjustmentsChange={handleSubcontractorAdjustmentsChange}
                  onToggleLineNulled={onToggleSubcontractorNulled}
                  onToggleOrderExtraLineNulled={onToggleSubcontractorOrderExtraNulled}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="hidden lg:block w-full">
        {priceUpdateNotice}
        <CalculatorDisplayNew
          productBreakdowns={productBreakdowns}
          priceLookup={priceLookup}
          adminView={adminView}
          onPriceChange={onPriceChange}
          forcedTotalExVat={forcedTotalExVat}
          forcedSubcontractorTotal={forcedSubcontractorTotal}
          rabatt={rabatt}
          leggTil={leggTil}
          subcontractorMinus={subcontractorMinus}
          subcontractorPlus={subcontractorPlus}
          onAdjustmentsChange={onAdjustmentsChange}
          onToggleLineNulled={onToggleCustomerNulled}
          onToggleOrderExtraLineNulled={onToggleCustomerOrderExtraNulled}
          sidebarMode={sidebarMode}
          locale={locale}
        />
        {adminView && (
          <SubcontractorCalculatorDisplay
            productBreakdowns={productBreakdowns}
            priceLookup={priceLookup}
            rabatt={rabatt}
            subcontractorMinus={subcontractorMinus}
            subcontractorPlus={subcontractorPlus}
            onSubcontractorAdjustmentsChange={handleSubcontractorAdjustmentsChange}
            onToggleLineNulled={onToggleSubcontractorNulled}
            onToggleOrderExtraLineNulled={onToggleSubcontractorOrderExtraNulled}
          />
        )}
      </div>
    </>
  );
}

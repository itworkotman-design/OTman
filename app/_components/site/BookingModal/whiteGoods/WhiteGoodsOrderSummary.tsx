"use client";

import { Fragment, type ReactNode } from "react";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { WhiteGoodsLineCategory } from "@/lib/content/whiteGoodsLineCategory";
import { ProductIcon } from "./productIcons";
import { HoverTip } from "./InfoHint";
import {
  websiteCustomerPrice,
  websiteCustomerTotalDisplay,
  websiteVatBreakdown,
  type CustomerType,
} from "@/lib/booking/pricing/websiteVat";

export type OrderSummaryLine = {
  label: string;
  price: number;
  qty: number;
  category: WhiteGoodsLineCategory;
  // A free line shows no price at all instead of "Included" (installation
  // only when another item is delivered — see websiteInstallOnlyVisit.ts).
  blankWhenFree?: boolean;
};

export type OrderSummaryProduct = {
  cardId: number;
  name: string;
  // Shown under the name — Other furniture's product label, under the
  // customer's own name for the item.
  subtitle: string | null;
  code: string;
  iconKey: string | null;
  qty: number;
  total: number;
  lines: OrderSummaryLine[];
};

// Charges that aren't tied to a specific product card — floor surcharge,
// long-distance delivery, express delivery, etc. (see
// buildWhiteGoodsCalculatorBreakdowns / buildCalculatorBreakdownsWithOrderExtras).
export type OrderSummaryExtraLine = {
  label: string;
  price: number;
  qty: number;
};

type Props = {
  locale: Locale;
  products: OrderSummaryProduct[];
  orderExtras?: OrderSummaryExtraLine[];
  // The order's totals: ex. VAT as priced, and incl. VAT summed per line
  // (websiteCustomerTotals) — what a private customer pays.
  totalExVat: number;
  totalIncVat: number;
  // Answered once as the modal's first step (CustomerTypeStep) — no toggle
  // here anymore, just used to pick which VAT total leads.
  customerType: CustomerType;
  // Replaces the card's own total and "final price may vary" note, inside the
  // same card — the review page passes its VAT breakdown + highlighted total.
  totalFooter?: ReactNode;
  // The moving flow has no products to choose and its price doesn't depend
  // on the address, so it drops the "Choose a product…" empty hint and the
  // "final price may vary based on your address…" note.
  hideProductHints?: boolean;
};

function formatKr(n: number) {
  return `${n.toLocaleString("nb-NO")} kr`;
}

export function WhiteGoodsOrderSummary({
  locale,
  products,
  orderExtras = [],
  totalExVat,
  totalIncVat,
  customerType,
  totalFooter,
  hideProductHints = false,
}: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const vatDisplay = websiteCustomerTotalDisplay({ totalExVat, totalIncVat, customerType });
  // Every price is stored ex. VAT; a private customer sees each line incl.
  // VAT (rounded per line), and a product's total is the sum of its lines.
  const shown = (amountExVat: number) => websiteCustomerPrice(amountExVat, customerType);
  const vatBreakdown = websiteVatBreakdown({ totalExVat, totalIncVat });
  const primaryLabel =
    vatDisplay.primary === "incVat" ? t("Total incl. VAT", "Totalt inkl. mva") : t("Total ex. VAT", "Totalt eks. mva");

  return (
    <div className="@container rounded-2xl border border-black/10 bg-white p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-logoblue">{t("Order summary", "Ordreoppsummering")}</h3>

      {/* On large screens the card sits sticky beside the steps; a long order
          would push the total below the modal's fold, so the lines scroll
          inside the card and the title + total stay in view. The cap is the
          modal's 92vh minus its header/padding and this card's own chrome.
          The scroll area reaches into the card's right padding (-mr-6) so the
          scrollbar sits in that white space, while the rows keep the card's
          content width (100cqw of the @container card) and the prices stay
          put, whatever the browser's scrollbar width. */}
      <div className="lg:-mr-6 lg:max-h-[max(10rem,calc(92vh-22rem))] lg:overflow-y-auto">
      <div className="lg:w-[100cqw]">
      {products.length === 0 ? (
        !hideProductHints && (
          <p className="mt-3 text-sm text-black/50">{t("Choose a product to see pricing here.", "Velg et produkt for å se pris her.")}</p>
        )
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {products.map((product) => (
            <div key={product.cardId}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-logoblue/10">
                  <ProductIcon code={product.code} iconKey={product.iconKey} className="h-6 w-6 text-logoblue" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-black/85">{product.name}</p>
                  <p className="text-sm text-black/50">
                    {product.subtitle ? `${product.subtitle} · ` : ""}
                    {t("Qty", "Antall")}: {product.qty}
                  </p>
                </div>
                <p className="shrink-0 whitespace-nowrap text-base font-semibold text-black/85">
                  {formatKr(product.lines.reduce((sum, line) => sum + shown(line.price), 0))}
                </p>
              </div>

              {product.lines.length > 0 && (
                // One grid per product: the quantity and price columns are `auto`,
                // so each sizes to its widest cell across every line and all rows
                // share the same right edges — no hard-coded widths.
                <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2 pl-1 text-sm">
                  {product.lines.map((line, index) => (
                    <Fragment key={index}>
                      <span className="flex items-center gap-2 text-black/60">
                        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-logoblue" />
                        {line.label}
                      </span>
                      <span className="justify-self-end whitespace-nowrap">
                        {line.qty > 1 && (
                          <span className="rounded-full bg-logoblue/10 px-1.5 py-0.5 text-xs font-semibold text-logoblue">
                            {line.qty}×
                          </span>
                        )}
                      </span>
                      <span
                        className={[
                          "whitespace-nowrap text-right tabular-nums",
                          line.price === 0 ? "font-semibold text-logoblue" : "font-medium text-black/70",
                        ].join(" ")}
                      >
                        {line.price === 0
                          ? line.blankWhenFree
                            ? null
                            : t("Included", "Inkludert")
                          : formatKr(shown(line.price))}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {orderExtras.length > 0 && (
        <div className="mt-4 border-t border-black/10 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
            {t("Order extras", "Tillegg til ordren")}
          </p>
          <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2 pl-1 text-sm">
            {orderExtras.map((line, index) => (
              <Fragment key={index}>
                <span className="flex items-center gap-2 text-black/60">
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-logoblue" />
                  {line.label}
                </span>
                <span className="justify-self-end whitespace-nowrap">
                  {line.qty > 1 && (
                    <span className="rounded-full bg-logoblue/10 px-1.5 py-0.5 text-xs font-semibold text-logoblue">
                      {line.qty}×
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap text-right font-medium tabular-nums text-black/70">
                  {formatKr(shown(line.price))}
                </span>
              </Fragment>
            ))}
          </div>
        </div>
      )}
      </div>
      </div>

      {totalFooter ? (
        <div className="mt-4 border-t border-black/10 pt-4">{totalFooter}</div>
      ) : (
        <div className="mt-4 flex flex-col gap-1 border-t border-black/10 pt-3 text-sm text-black/60">
          {/* The VAT rows, so a private customer sees the price includes VAT.
              A business customer's lead total is the ex. VAT one, so its
              subtotal row would just repeat it. */}
          {vatDisplay.primary === "incVat" && (
            <div className="flex justify-between">
              <span>{t("Subtotal (ex. VAT)", "Delsum (eks. mva)")}</span>
              <span className="tabular-nums">{formatKr(vatBreakdown.exVat)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t("VAT (25%)", "MVA (25%)")}</span>
            <span className="tabular-nums">{formatKr(vatBreakdown.vat)}</span>
          </div>
          {vatDisplay.primary === "exVat" && (
            <div className="flex justify-between">
              <span>{t("Total incl. VAT", "Totalt inkl. mva")}</span>
              <span className="tabular-nums">{formatKr(vatBreakdown.incVat)}</span>
            </div>
          )}
          {/* The price note shows while the total row is hovered (HoverTip). */}
          <div className="group/tip relative mt-1 flex items-center justify-between">
            <span className="text-base font-semibold text-logoblue">{primaryLabel}</span>
            {!hideProductHints && (
              <HoverTip
                label={t(
                  "The final price may vary based on your address and any additional items.",
                  "Den endelige prisen kan variere basert på adressen din og eventuelle tilleggsvalg.",
                )}
              />
            )}
            <span className="text-lg font-semibold tabular-nums text-logoblue">{formatKr(vatDisplay.primaryAmount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Fragment } from "react";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { WhiteGoodsLineCategory } from "@/lib/content/whiteGoodsLineCategory";
import { ProductIcon } from "./productIcons";
import { getVatDisplayTotal, type CustomerType } from "@/lib/booking/pricing/vatDisplayTotal";
import { CustomerTypeToggle } from "./CustomerTypeToggle";

export type OrderSummaryLine = {
  label: string;
  price: number;
  qty: number;
  category: WhiteGoodsLineCategory;
};

export type OrderSummaryProduct = {
  cardId: number;
  name: string;
  code: string;
  iconKey: string | null;
  qty: number;
  total: number;
  lines: OrderSummaryLine[];
};

type Props = {
  locale: Locale;
  products: OrderSummaryProduct[];
  totalExVat: number;
  totalIncVat: number;
  customerType: CustomerType;
  onCustomerTypeChange: (customerType: CustomerType) => void;
};

function formatKr(n: number) {
  return `${n.toLocaleString("nb-NO")} kr`;
}

export function WhiteGoodsOrderSummary({
  locale,
  products,
  totalExVat,
  totalIncVat,
  customerType,
  onCustomerTypeChange,
}: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const vatDisplay = getVatDisplayTotal({ totalExVat, totalIncVat, customerType });
  const secondaryLabel =
    vatDisplay.primary === "incVat" ? t("ex. VAT", "eks. mva") : t("incl. VAT", "inkl. mva");

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-logoblue">{t("Order summary", "Ordreoppsummering")}</h3>
        <CustomerTypeToggle locale={locale} value={customerType} onChange={onCustomerTypeChange} />
      </div>

      {products.length === 0 ? (
        <p className="mt-3 text-sm text-black/50">{t("Choose a product to see pricing here.", "Velg et produkt for å se pris her.")}</p>
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
                    {t("Qty", "Antall")}: {product.qty}
                  </p>
                </div>
                <p className="shrink-0 whitespace-nowrap text-base font-semibold text-black/85">{formatKr(product.total)}</p>
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
                        {line.price === 0 ? t("Included", "Inkludert") : formatKr(line.price)}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-black/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-logoblue">{t("Total", "Totalt")}</span>
          <span className="text-lg font-semibold text-logoblue">{formatKr(vatDisplay.primaryAmount)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-end">
          <span className="text-xs text-black/45">
            {formatKr(vatDisplay.secondaryAmount)} {secondaryLabel}
          </span>
        </div>
      </div>

      <p className="mt-3 rounded-lg bg-logoblue/5 p-3 text-sm text-black/60">
        {t(
          "The final price may vary based on your address and any additional items.",
          "Den endelige prisen kan variere basert på adressen din og eventuelle tilleggsvalg.",
        )}
      </p>
    </div>
  );
}

"use client";

import type { Locale } from "@/lib/content/ServiceWindowContent";
import type { WhiteGoodsLineCategory } from "@/lib/content/whiteGoodsLineCategory";
import { ProductIcon } from "./productIcons";
import { CalculatorIcon, TruckIcon, WrenchIcon, GearIcon } from "./sectionIcons";

export type OrderSummaryLine = {
  label: string;
  price: number;
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
  totalIncVat: number;
};

function formatKr(n: number) {
  return `${n.toLocaleString("nb-NO")} kr`;
}

function LineIcon({ category, className }: { category: WhiteGoodsLineCategory; className?: string }) {
  if (category === "delivery") return <TruckIcon className={className} />;
  if (category === "install") return <WrenchIcon className={className} />;
  return <GearIcon className={className} />;
}

export function WhiteGoodsOrderSummary({ locale, products, totalIncVat }: Props) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-logoblue">{t("Order summary", "Ordreoppsummering")}</h3>

      {products.length === 0 ? (
        <p className="mt-3 text-sm text-black/50">{t("Choose a product to see pricing here.", "Velg et produkt for å se pris her.")}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {products.map((product) => (
            <div key={product.cardId}>
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-logoblue/10">
                  <ProductIcon code={product.code} iconKey={product.iconKey} className="h-5 w-5 text-logoblue" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-black/85">{product.name}</p>
                  <p className="text-xs text-black/50">
                    {t("Qty", "Antall")}: {product.qty}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-black/85">{formatKr(product.total)}</p>
              </div>

              {product.lines.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5 pl-1">
                  {product.lines.map((line, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-black/60">
                        <LineIcon category={line.category} className="h-3.5 w-3.5 text-logoblue/70" />
                        {line.label}
                      </span>
                      <span className={line.price === 0 ? "font-semibold text-logoblue" : "font-medium text-black/70"}>
                        {line.price === 0 ? t("Included", "Inkludert") : formatKr(line.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-3">
        <span className="text-sm font-semibold text-logoblue">{t("Total", "Totalt")}</span>
        <span className="text-sm font-semibold text-logoblue">{formatKr(totalIncVat)}</span>
      </div>

      <p className="mt-3 rounded-lg bg-logoblue/5 p-2.5 text-xs text-black/60">
        {t(
          "The final price may vary based on your address and any additional items.",
          "Den endelige prisen kan variere basert på adressen din og eventuelle tilleggsvalg.",
        )}
      </p>
    </div>
  );
}

"use client";

import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { findWebsiteProductSeed } from "@/lib/content/websiteCatalogs";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { ProductIcon } from "./productIcons";

type Props = {
  locale: Locale;
  products: CatalogProduct[];
  quantities: Record<string, number>;
  onChangeQuantity: (productId: string, amount: number) => void;
};

export function productLabel(locale: Locale, product: CatalogProduct) {
  const seed = findWebsiteProductSeed(product.code);
  if (!seed) return product.label;
  return locale === "no" ? seed.nameNo : seed.nameEn;
}

export function WhiteGoodsProductGrid({ locale, products, quantities, onChangeQuantity }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {products.map((product) => {
        const qty = quantities[product.id] ?? 0;
        const selected = qty > 0;

        return (
          <div
            key={product.id}
            className={[
              "flex flex-col gap-2 rounded-2xl border p-3 transition",
              selected ? "border-logoblue bg-logoblue/5" : "border-black/10",
            ].join(" ")}
          >
            <div className="relative">
              <ProductIcon
                code={product.code}
                iconKey={product.iconKey}
                className="h-8 w-8 text-logoblue"
              />
              {selected && (
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-logoblue text-[11px] font-semibold text-white">
                  {qty}
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-black/80">{productLabel(locale, product)}</p>

            <div className="mt-auto flex items-center justify-between">
              <button
                type="button"
                aria-label={locale === "no" ? "Reduser antall" : "Decrease quantity"}
                disabled={qty <= 0}
                onClick={() => onChangeQuantity(product.id, qty - 1)}
                className="grid h-7 w-7 place-items-center rounded-full border border-black/15 text-sm disabled:pointer-events-none disabled:opacity-30"
              >
                −
              </button>
              <span className="text-sm font-semibold">{qty}</span>
              <button
                type="button"
                aria-label={locale === "no" ? "Øk antall" : "Increase quantity"}
                onClick={() => onChangeQuantity(product.id, qty + 1)}
                className="grid h-7 w-7 place-items-center rounded-full border border-black/15 text-sm"
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

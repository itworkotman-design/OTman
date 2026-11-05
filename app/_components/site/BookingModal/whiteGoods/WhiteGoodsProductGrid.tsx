"use client";

import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { findWebsiteProductSeed } from "@/lib/content/websiteCatalogs";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { formatSizeInfoChip } from "./cardSummaryChips";
import { ProductIcon } from "./productIcons";
import { InfoHint } from "./InfoHint";

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

// Products with a static max-weight/dimensions spec (parcel/pallet catalog)
// show it in an InfoHint next to the tile's product name.

export function WhiteGoodsProductGrid({
  locale,
  products,
  quantities,
  onChangeQuantity,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {products.map((product) => {
        const qty = quantities[product.id] ?? 0;
        const selected = qty > 0;
        const sizeInfoLabel = formatSizeInfoChip(locale, findWebsiteProductSeed(product.code)?.sizeInfo ?? null);

        return (
          <div
            key={product.id}
            className={[
              "flex flex-col rounded-2xl border transition",
              selected ? "border-logoblue bg-logoblue/5" : "border-black/10",
            ].join(" ")}
          >
            <div className="flex flex-1 flex-col gap-2 p-3">
              {/* Icon on the left, the quantity (only once picked) top right. */}
              <div className="flex items-center justify-between gap-2">
                <ProductIcon
                  code={product.code}
                  iconKey={product.iconKey}
                  className="h-8 w-8 shrink-0 text-logoblue"
                />
                {selected && (
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-logoblue px-1.5 text-xs font-semibold text-white">
                    {qty}
                  </span>
                )}
              </div>

              <p className="flex items-center gap-1 text-sm font-medium text-black/80">
                {productLabel(locale, product)}
                {sizeInfoLabel && <InfoHint label={sizeInfoLabel} />}
              </p>
            </div>

            {/* Full-width −/+ halves split by a divider, like the calculator's
                Discount/Extra footer (AddAdjustmentLineButtons). The bottom
                radius (16px minus the 1px border) clips the hover fill. */}
            <div className="grid grid-cols-2 overflow-hidden rounded-b-[15px] border-t border-inherit">
              <button
                type="button"
                aria-label={locale === "no" ? "Reduser antall" : "Decrease quantity"}
                disabled={qty <= 0}
                onClick={() => onChangeQuantity(product.id, qty - 1)}
                className="py-2.5 text-lg font-semibold leading-none text-logoblue transition-colors hover:bg-black/5 active:bg-black/10 disabled:pointer-events-none disabled:opacity-30"
              >
                −
              </button>
              <button
                type="button"
                aria-label={locale === "no" ? "Øk antall" : "Increase quantity"}
                onClick={() => onChangeQuantity(product.id, qty + 1)}
                className="border-l border-inherit py-2.5 text-lg font-semibold leading-none text-logoblue transition-colors hover:bg-black/5 active:bg-black/10"
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

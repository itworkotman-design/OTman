"use client";

import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { findWebsiteProductSeed } from "@/lib/content/websiteCatalogs";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { formatSizeInfoChip } from "./cardSummaryChips";
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

// Small "?" badge next to a tile's product name for products with a static
// max-weight/dimensions spec (parcel/pallet catalog) — hover (or focus, for
// keyboard/touch) reveals the spec in a bubble, same reveal-on-hover pattern
// used by the archive's row actions.
function SizeInfoBadge({ label }: { label: string }) {
  return (
    <span
      tabIndex={0}
      className="group/spec relative inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-black/20 text-[9px] font-semibold leading-none text-black/50 outline-none focus-visible:border-logoblue focus-visible:text-logoblue"
    >
      ?
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-40 -translate-x-1/2 rounded-lg bg-black/85 px-2 py-1 text-center text-[11px] font-normal leading-snug text-white opacity-0 transition-opacity duration-150 group-hover/spec:opacity-100 group-focus-visible/spec:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

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
              "flex flex-col gap-2 rounded-2xl border p-3 transition",
              selected ? "border-logoblue bg-logoblue/5" : "border-black/10",
            ].join(" ")}
          >
            {/* Icon on the left, quantity stepper on the right, so the stepper
                doesn't take a row of its own. */}
            <div className="flex items-center justify-between gap-2">
              <ProductIcon
                code={product.code}
                iconKey={product.iconKey}
                className="h-8 w-8 shrink-0 text-logoblue"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={locale === "no" ? "Reduser antall" : "Decrease quantity"}
                  disabled={qty <= 0}
                  onClick={() => onChangeQuantity(product.id, qty - 1)}
                  className="grid h-7 w-7 place-items-center rounded-full border border-black/15 text-sm disabled:pointer-events-none disabled:opacity-30"
                >
                  −
                </button>
                <span className="min-w-4 text-center text-sm font-semibold">{qty}</span>
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

            <p className="flex items-center gap-1 text-sm font-medium text-black/80">
              {productLabel(locale, product)}
              {sizeInfoLabel && <SizeInfoBadge label={sizeInfoLabel} />}
            </p>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { CatalogProduct } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { findWebsiteProductSeed } from "@/lib/content/websiteCatalogs";
import { SIZE_VOLUME_CATEGORY, SIZE_WEIGHT_CATEGORY } from "@/lib/booking/pricing/sizeBrackets";
import type { SizeDimensionsCm } from "@/lib/booking/pricing/sizeDimensions";
import type { Locale } from "@/lib/content/ServiceWindowContent";
import { ProductIcon } from "./productIcons";
import { SizeBracketPicker } from "./SizeBracketPicker";
import { getTileKeyframes, type TileBox } from "./tileMotion";

const TILE_MOTION_MS = 300;

type Props = {
  locale: Locale;
  products: CatalogProduct[];
  quantities: Record<string, number>;
  onChangeQuantity: (productId: string, amount: number) => void;
  // Size-priced products (Other furniture): the size-bracket option ids chosen
  // per product id, and the handler for picking one.
  sizeSelections?: Record<string, string[]>;
  onSelectSizeBracket?: (product: CatalogProduct, optionId: string) => void;
  // ...and the width/height/length chosen so far per product id, from which the
  // volume (and its bracket) is calculated.
  sizeDimensions?: Record<string, Partial<SizeDimensionsCm> | null>;
  onSelectSizeDimension?: (product: CatalogProduct, axis: keyof SizeDimensionsCm, valueCm: number) => void;
  // ...and the free-text name of what the item is, per product id.
  itemNames?: Record<string, string>;
  onChangeItemName?: (product: CatalogProduct, name: string) => void;
};

export function productLabel(locale: Locale, product: CatalogProduct) {
  const seed = findWebsiteProductSeed(product.code);
  if (!seed) return product.label;
  return locale === "no" ? seed.nameNo : seed.nameEn;
}

export function WhiteGoodsProductGrid({
  locale,
  products,
  quantities,
  onChangeQuantity,
  sizeSelections = {},
  onSelectSizeBracket,
  sizeDimensions = {},
  onSelectSizeDimension,
  itemNames = {},
  onChangeItemName,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  // Where every tile was just before the selection changed (see tileMotion.ts).
  const boxesBefore = useRef<Map<string, TileBox> | null>(null);

  const measureTiles = useCallback(() => {
    const boxes = new Map<string, TileBox>();
    gridRef.current?.querySelectorAll<HTMLElement>("[data-tile-id]").forEach((el) => {
      boxes.set(el.dataset.tileId ?? "", { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth });
    });
    return boxes;
  }, []);

  const changeQuantity = (productId: string, amount: number) => {
    boxesBefore.current = measureTiles();
    onChangeQuantity(productId, amount);
  };

  // A tile growing to the full row (or shrinking back) reflows the grid at once,
  // which reads as a snap. Play each tile from where it was to where it is now.
  const layoutKey = products
    .filter((p) => (quantities[p.id] ?? 0) > 0)
    .map((p) => p.id)
    .join(",");
  useLayoutEffect(() => {
    const before = boxesBefore.current;
    boxesBefore.current = null;
    if (!before || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gridRef.current?.querySelectorAll<HTMLElement>("[data-tile-id]").forEach((el) => {
      const prev = before.get(el.dataset.tileId ?? "");
      if (!prev || typeof el.animate !== "function") return;
      const frames = getTileKeyframes(prev, { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth });
      if (frames) el.animate(frames, { duration: TILE_MOTION_MS, easing: "ease-in-out" });
    });
  }, [layoutKey]);

  return (
    <div ref={gridRef} className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {products.map((product) => {
        const qty = quantities[product.id] ?? 0;
        const selected = qty > 0;
        const asksForSize =
          !!onSelectSizeBracket &&
          !!onSelectSizeDimension &&
          !!onChangeItemName &&
          product.options.some((o) => o.active && (o.category === SIZE_VOLUME_CATEGORY || o.category === SIZE_WEIGHT_CATEGORY));
        const expanded = selected && asksForSize;

        return (
          <div
            key={product.id}
            data-tile-id={product.id}
            className={[
              "flex flex-col gap-2 rounded-2xl border p-3 transition",
              selected ? "border-logoblue bg-logoblue/5" : "border-black/10",
              // A size-priced product grows to the full row once selected, to
              // make room for its size and weight choices.
              expanded ? "col-span-full" : "",
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
                  onClick={() => changeQuantity(product.id, qty - 1)}
                  className="grid h-7 w-7 place-items-center rounded-full border border-black/15 text-sm disabled:pointer-events-none disabled:opacity-30"
                >
                  −
                </button>
                <span className="min-w-4 text-center text-sm font-semibold">{qty}</span>
                <button
                  type="button"
                  aria-label={locale === "no" ? "Øk antall" : "Increase quantity"}
                  onClick={() => changeQuantity(product.id, qty + 1)}
                  className="grid h-7 w-7 place-items-center rounded-full border border-black/15 text-sm"
                >
                  +
                </button>
              </div>
            </div>

            <p className="text-sm font-medium text-black/80">{productLabel(locale, product)}</p>

            {/* Grows open (grid-rows 0fr -> 1fr, which a plain height cannot
                animate) when the product is selected. The picker stays mounted
                so it animates closed as well; `invisible` (which switches only
                once the fade ends) keeps its fields out of the tab order while
                it is closed. */}
            {asksForSize && (
              <div
                className={[
                  "grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out",
                  expanded ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
                ].join(" ")}
                aria-hidden={!expanded}
              >
                <div className="overflow-hidden">
                  <SizeBracketPicker
                    locale={locale}
                    product={product}
                    selectedIds={sizeSelections[product.id] ?? []}
                    dimensions={sizeDimensions[product.id] ?? null}
                    itemName={itemNames[product.id] ?? ""}
                    onSelect={onSelectSizeBracket}
                    onSelectDimension={onSelectSizeDimension}
                    onChangeItemName={onChangeItemName}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import type {
  CatalogOption,
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { PriceListChargeSetting, PriceListSettings, WeightClassPricing } from "@/lib/products/priceListSettings";
import { DEFAULT_WEIGHT_CLASS, heaviestWeightClass, type WeightClass } from "@/lib/products/weightClass";
import { isReturnOption } from "@/lib/booking/pricing/rules";
import { applyNulledLineKeys, type BuiltOrderItem } from "@/lib/orders/buildOrderItemsFromCards";
import type { ProductBreakdown } from "@/lib/booking/pricing/types";

// Website only: weight classes (light/medium/heavy — lib/products/weightClass.ts)
// price the no-lift floor surcharge and the return, when the price list has
// weightClassPricing (PriceListSettings). The floor surcharge is one rate per
// chargeable floor, taken from the order's heaviest item; the return is
// priced per item at that item's own class. A product without a class counts
// as LIGHT; a picked assembly type with its own class (Outdoor chair, Lounge
// set) overrides the product's. Each item is priced by its own price list's
// class prices (CatalogProduct.weightClassPricing — white goods' light differs
// from furniture's), falling back to the order's settings. Kept out of the
// shared pricing code, like the other website layers, so the dashboard
// booking flow is unaffected.

export function cardWeightClass(card: SavedProductCard, product: CatalogProduct | undefined): WeightClass {
  if (!product) return DEFAULT_WEIGHT_CLASS;
  const pickedTypeClasses = card.selectedInstallOptionIds
    .map((id) => product.options.find((option) => option.id === id)?.weightClass)
    .filter((weightClass): weightClass is WeightClass => !!weightClass);
  if (pickedTypeClasses.length > 0) return heaviestWeightClass(pickedTypeClasses);
  return product.weightClass ?? DEFAULT_WEIGHT_CLASS;
}

export function orderWeightClass(cards: SavedProductCard[], catalogProducts: CatalogProduct[]): WeightClass {
  return heaviestWeightClass(
    cards
      .filter((card) => card.productId)
      .map((card) => cardWeightClass(card, catalogProducts.find((product) => product.id === card.productId))),
  );
}

// The item's own list's class prices, else the order's.
function pricingFor(product: CatalogProduct, settings: PriceListSettings): WeightClassPricing | null {
  return product.weightClassPricing ?? settings.weightClassPricing;
}

function usesWeightClasses(settings: PriceListSettings, catalogProducts: CatalogProduct[]) {
  return !!settings.weightClassPricing || catalogProducts.some((product) => product.weightClassPricing);
}

// The floor surcharge rate for this order: the highest rate among its items,
// each at its own class on its own list — with one list, simply the heaviest
// item's class. The list's flat floorSurcharge when there's no weight class
// pricing; an order with no priced item yet shows the light rate.
export function websiteFloorSurchargeSetting(
  settings: PriceListSettings,
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
): PriceListChargeSetting {
  if (!usesWeightClasses(settings, catalogProducts)) return settings.floorSurcharge;

  const rates = cards.flatMap((card) => {
    const product = catalogProducts.find((p) => p.id === card.productId);
    const pricing = product ? pricingFor(product, settings) : null;
    return pricing ? [pricing.floorSurcharge[cardWeightClass(card, product)]] : [];
  });
  if (rates.length === 0) return settings.weightClassPricing?.floorSurcharge[DEFAULT_WEIGHT_CLASS] ?? settings.floorSurcharge;
  return rates.reduce((highest, rate) => (Number(rate.price) > Number(highest.price) ? rate : highest));
}

function returnPriceFor(settings: PriceListSettings, card: SavedProductCard | undefined, catalogProducts: CatalogProduct[]) {
  if (!card) return null;
  const product = catalogProducts.find((p) => p.id === card.productId);
  const pricing = product ? pricingFor(product, settings) : null;
  if (!product || !pricing) return null;
  const setting = pricing.returnPrice[cardWeightClass(card, product)];
  return { product, customer: Number(setting.price) || 0, subcontractor: Number(setting.subcontractorPrice) || 0 };
}

// The return price a card shows on its return row: the item's class price on
// its own list (what applyWebsiteWeightClassReturnPrices charges), else the
// option's own price.
export function websiteReturnDisplayPrice(
  card: SavedProductCard,
  product: CatalogProduct,
  returnOption: CatalogOption,
): string {
  if (!product.weightClassPricing) return returnOption.customerPrice;
  return product.weightClassPricing.returnPrice[cardWeightClass(card, product)].price;
}

function isProductReturnOption(product: CatalogProduct, optionId: string | null) {
  const option = product.options.find((o) => o.id === optionId);
  return !!option && isReturnOption(option.category, option.code);
}

// Prices each card's return option at its class's return price. A return
// already given its own price (a return-only card's 0) keeps it.
export function applyWebsiteWeightClassReturnPrices(
  breakdowns: ProductBreakdown[],
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  settings: PriceListSettings,
): ProductBreakdown[] {
  if (!usesWeightClasses(settings, catalogProducts)) return breakdowns;

  return breakdowns.map((breakdown) => {
    const price = returnPriceFor(settings, cards.find((card) => card.cardId === breakdown.cardId), catalogProducts);
    if (!price) return breakdown;
    return {
      ...breakdown,
      items: breakdown.items.map((item) =>
        item.kind === "productOption" && item.priceOverride === undefined && isProductReturnOption(price.product, item.productOptionId)
          ? { ...item, priceOverride: price.customer, subcontractorPriceOverride: price.subcontractor }
          : item,
      ),
    };
  });
}

// The same price on the stored return lines, so they add up to the order's
// priced total. "Set to 0" choices are reapplied after, so a nulled line
// stays 0.
export function applyWebsiteWeightClassReturnOrderItems(
  items: BuiltOrderItem[],
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  settings: PriceListSettings,
): BuiltOrderItem[] {
  if (!usesWeightClasses(settings, catalogProducts)) return items;

  const priced = items.map((item) => {
    if (item.itemType !== "RETURN_OPTION") return item;
    const price = returnPriceFor(settings, cards.find((card) => card.cardId === item.cardId), catalogProducts);
    if (!price || !isProductReturnOption(price.product, item.optionId)) return item;
    return {
      ...item,
      customerPriceCents: Math.round(price.customer * 100),
      subcontractorPriceCents: Math.round(price.subcontractor * 100),
    };
  });
  return applyNulledLineKeys(priced, cards);
}

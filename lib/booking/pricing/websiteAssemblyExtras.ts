import type {
  CatalogOption,
  CatalogProduct,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { ProductBreakdown } from "@/lib/booking/pricing/types";
import type { BuiltOrderItem } from "@/lib/orders/buildOrderItemsFromCards";
import { getProductDeliveryTypeLabel } from "@/lib/products/deliveryTypes";

// Website furniture flow only. Dismantling old furniture and wall anchoring are
// paid extras that can be booked together with assembly — but the shared
// pricing (fromProductCards / buildOrderItemsFromCards, also used by the
// dashboard booking flow) drops every "extra" option as soon as an install
// (assembly) option is selected, because on the dashboard those extras are
// hidden under installation. So on the website these are priced by this
// separate layer, applied by the website flow and order route, and the shared
// code stays untouched. Only these extras are affected: unpacking stays dropped
// (it is included in assembly) and white goods, whose UI never offers extras
// under installation, are unchanged.

const ASSEMBLY_COMPATIBLE_EXTRA = /^(DISMANTLE_|WALL_ANCHORING$)/;

export function isAssemblyCompatibleExtraCode(code: string): boolean {
  return ASSEMBLY_COMPATIBLE_EXTRA.test(code);
}

type AssemblyExtra = {
  card: SavedProductCard;
  product: CatalogProduct;
  option: CatalogOption;
  qty: number;
};

function getAssemblyExtras(cards: SavedProductCard[], catalogProducts: CatalogProduct[]): AssemblyExtra[] {
  const extras: AssemblyExtra[] = [];

  for (const card of cards) {
    if (card.selectedInstallOptionIds.length === 0) continue;

    const product = catalogProducts.find((p) => p.id === card.productId);
    if (!product) continue;

    // Same gate the shared pricing uses for extras (minus its "no install" part).
    const deliveryTypeConfig = product.allowDeliveryTypes
      ? (product.deliveryTypes.find((dt) => dt.key === card.deliveryType) ?? null)
      : null;
    const allowsExtras = deliveryTypeConfig ? deliveryTypeConfig.allowExtraServices : product.allowExtraServices;
    if (!allowsExtras) continue;

    const qty = product.allowQuantity ? Math.max(1, card.amount || 1) : 1;

    for (const optionId of card.selectedExtraOptionIds) {
      const option = product.options.find((o) => o.id === optionId);
      if (option && option.active && isAssemblyCompatibleExtraCode(option.code)) {
        extras.push({ card, product, option, qty });
      }
    }
  }

  return extras;
}

// Adds the extras the shared pricing skipped to each card's pricing breakdown.
export function applyWebsiteAssemblyExtras(
  breakdowns: ProductBreakdown[],
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
): ProductBreakdown[] {
  const extras = getAssemblyExtras(cards, catalogProducts);
  if (extras.length === 0) return breakdowns;

  return breakdowns.map((breakdown) => {
    const own = extras.filter((e) => e.card.cardId === breakdown.cardId);
    if (own.length === 0) return breakdown;

    return {
      ...breakdown,
      items: [
        ...breakdown.items,
        ...own.map((e) => ({
          kind: "productOption" as const,
          productOptionId: e.option.id,
          qty: e.qty,
        })),
      ],
    };
  });
}

function toCents(value: string | undefined) {
  const n = Number(value ?? "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// The same extras as saved order lines, to append to buildOrderItemsFromCards'
// output so the stored lines add up to the stored price.
export function buildWebsiteAssemblyExtraOrderItems(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
): BuiltOrderItem[] {
  return getAssemblyExtras(cards, catalogProducts).map(({ card, product, option, qty }) => ({
    cardId: card.cardId,
    productId: product.id,
    productCode: product.code,
    productName: product.label,
    deliveryType: card.deliveryType ? getProductDeliveryTypeLabel(product.deliveryTypes, card.deliveryType) : null,
    itemType: "EXTRA_OPTION" as const,
    optionId: option.id,
    optionCode: option.code,
    optionLabel: option.label,
    quantity: qty,
    customerPriceCents: toCents(option.effectiveCustomerPrice ?? option.customerPrice),
    subcontractorPriceCents: toCents(option.subcontractorPrice),
    rawData: option,
  }));
}

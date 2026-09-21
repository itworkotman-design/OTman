import type {
  CatalogProduct,
  CatalogSpecialOption,
  SavedProductCard,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { OPTION_CODES } from "@/lib/booking/constants";
import { findAutomaticXtraSpecialOption } from "@/lib/booking/pricing/sharedDeliveryLogic";
import { isDeliveryTypeWithExtraAmount } from "@/lib/booking/pricing/rules";
import type { ProductBreakdown } from "@/lib/booking/pricing/types";
import type { BuiltOrderItem } from "@/lib/orders/buildOrderItemsFromCards";
import {
  getProductDeliveryTypeCode,
  getProductDeliveryTypeLabel,
  getProductDeliveryTypePrice,
} from "@/lib/products/deliveryTypes";

// Website white-goods flow only. Units beyond the first of a doorstep/carry-in
// delivery pay that delivery type's own xtraPrice. The shared pricing code
// (fromProductCards / buildOrderItemsFromCards, also used by the dashboard
// booking flow) only charges them through a global XTRA special option, which
// the white-goods catalog doesn't have — so without this, raising the quantity
// left the delivery price unchanged. Kept as its own module, applied by the
// white-goods flow and order route, so the shared code stays untouched. When
// a catalog *does* have an XTRA option the shared code already charges it, so
// this adds nothing (no double charge).

type ExtraUnitCharge = {
  cardId: number;
  product: CatalogProduct;
  deliveryType: SavedProductCard["deliveryType"];
  label: string;
  code: string;
  qty: number;
  unitPrice: number;
  subcontractorUnitPrice: number;
};

function getExtraUnitCharges(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
): ExtraUnitCharge[] {
  const charges: ExtraUnitCharge[] = [];

  for (const card of cards) {
    const product = catalogProducts.find((p) => p.id === card.productId);
    if (!product || !product.allowQuantity || !product.allowDeliveryTypes) continue;
    if (product.productType !== "PHYSICAL") continue;
    if (!card.deliveryType || !isDeliveryTypeWithExtraAmount(card.deliveryType)) continue;

    const qty = Math.max(1, card.amount || 1) - 1;
    if (qty <= 0) continue;

    if (findAutomaticXtraSpecialOption({ catalogSpecialOptions, deliveryType: card.deliveryType })) continue;

    const unitPrice = getProductDeliveryTypePrice({
      deliveryTypes: product.deliveryTypes,
      key: card.deliveryType,
      useXtraPrice: true,
    });
    if (unitPrice <= 0) continue;

    charges.push({
      cardId: card.cardId,
      product,
      deliveryType: card.deliveryType,
      label: getProductDeliveryTypeLabel(product.deliveryTypes, card.deliveryType) ?? "",
      code: getProductDeliveryTypeCode(product.deliveryTypes, card.deliveryType) || OPTION_CODES.XTRA,
      qty,
      unitPrice,
      subcontractorUnitPrice: getProductDeliveryTypePrice({
        deliveryTypes: product.deliveryTypes,
        key: card.deliveryType,
        useXtraPrice: true,
        subcontractor: true,
      }),
    });
  }

  return charges;
}

// Appends the extra-unit charge to each affected card's pricing breakdown.
export function applyWhiteGoodsExtraUnitCharges(
  breakdowns: ProductBreakdown[],
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
): ProductBreakdown[] {
  const charges = getExtraUnitCharges(cards, catalogProducts, catalogSpecialOptions);
  if (charges.length === 0) return breakdowns;

  return breakdowns.map((breakdown) => {
    const charge = charges.find((c) => c.cardId === breakdown.cardId);
    if (!charge) return breakdown;

    return {
      ...breakdown,
      items: [
        ...breakdown.items,
        {
          kind: "customPrice" as const,
          code: charge.code,
          label: charge.label,
          qty: charge.qty,
          unitPrice: charge.unitPrice,
          subcontractorUnitPrice: charge.subcontractorUnitPrice,
        },
      ],
    };
  });
}

// The same charge as saved order lines, to append to buildOrderItemsFromCards'
// output so the stored lines add up to the stored price.
export function buildWhiteGoodsExtraUnitOrderItems(
  cards: SavedProductCard[],
  catalogProducts: CatalogProduct[],
  catalogSpecialOptions: CatalogSpecialOption[],
): BuiltOrderItem[] {
  return getExtraUnitCharges(cards, catalogProducts, catalogSpecialOptions).map((charge) => ({
    cardId: charge.cardId,
    productId: charge.product.id,
    productCode: charge.product.code,
    productName: charge.product.label,
    deliveryType: charge.label,
    itemType: "EXTRA_OPTION" as const,
    optionId: null,
    optionCode: charge.code,
    optionLabel: charge.label,
    quantity: charge.qty,
    customerPriceCents: Math.round(charge.unitPrice * 100),
    subcontractorPriceCents: Math.round(charge.subcontractorUnitPrice * 100),
    rawData: { source: "white_goods_extra_unit" },
  }));
}

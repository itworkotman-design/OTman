// The products on a customer's order, for the "Varer og tjenester" tiles on
// "My order": one per product card (the order's PRODUCT_CARD lines), with
// what the tile needs to pick its icon (ProductIcon: code + Product.iconKey),
// and under it the card's delivery type and its own services (the card's
// install / extra / return lines).

// Catch-all products the customer names themselves (the name is the card's
// modelNumber).
const NAMED_BY_CUSTOMER = new Set(["FN_OTHER_FURNITURE"]);

const SERVICE_ITEM_TYPES = new Set(["INSTALL_OPTION", "EXTRA_OPTION", "RETURN_OPTION"]);
// Lines that price the delivery itself, not a service the customer chose.
const DELIVERY_PRICE_SOURCES = new Set(["delivery_type_price", "white_goods_extra_unit", "auto_delivery_price", "auto_delivery_price_xtra"]);

export type CustomerOrderProduct = {
  cardId: number;
  code: string;
  iconKey: string | null;
  // The catalog (English) name — localize when showing it.
  name: string;
  itemName: string | null;
  count: number;
  // The delivery type's (English) label, null when the product has none.
  deliveryType: string | null;
  // The card's services' (English) labels, once each.
  services: string[];
};

type OrderItemRow = {
  cardId: number;
  itemType: string;
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  deliveryType: string | null;
  optionLabel: string | null;
  quantity: number;
  rawData: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function customerOrderProducts(items: OrderItemRow[], products: { id: string; iconKey: string | null }[]): CustomerOrderProduct[] {
  const iconKeys = new Map(products.map((product) => [product.id, product.iconKey]));

  const servicesByCard = new Map<number, string[]>();
  for (const item of items) {
    if (!SERVICE_ITEM_TYPES.has(item.itemType)) continue;
    const source = record(item.rawData).source;
    if (typeof source === "string" && DELIVERY_PRICE_SOURCES.has(source)) continue;
    const label = item.optionLabel?.trim();
    if (!label) continue;
    const services = servicesByCard.get(item.cardId) ?? [];
    if (!services.includes(label)) services.push(label);
    servicesByCard.set(item.cardId, services);
  }

  return items
    .filter((item) => item.itemType === "PRODUCT_CARD")
    .sort((a, b) => a.cardId - b.cardId)
    .map((item) => {
      const code = item.productCode ?? "";
      const modelNumber = record(item.rawData).modelNumber;
      const typedName = typeof modelNumber === "string" ? modelNumber.trim() : "";
      return {
        cardId: item.cardId,
        code,
        iconKey: (item.productId && iconKeys.get(item.productId)) || null,
        name: item.productName ?? code,
        itemName: NAMED_BY_CUSTOMER.has(code) && typedName ? typedName : null,
        count: Math.max(1, Math.round(item.quantity)),
        deliveryType: item.deliveryType?.trim() || null,
        services: servicesByCard.get(item.cardId) ?? [],
      };
    });
}

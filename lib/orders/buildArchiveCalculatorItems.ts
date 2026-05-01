import {
  normalizeSavedProductCard,
  type SavedProductCard,
  type WordpressImportPriceRow,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

type OrderItemInput = {
  cardId: number;
  productName: string | null;
  deliveryType: string | null;
  itemType: string;
  optionCode: string | null;
  optionLabel: string | null;
  quantity: number;
  customerPriceCents: number | null;
  subcontractorPriceCents: number | null;
  rawData?: unknown;
};

type ArchiveCalculatorItem = {
  cardId: number;
  productName: string;
  productModelNumber: string;
  deliveryType: string;
  itemType: OrderItemInput["itemType"];
  optionCode: string;
  optionLabel: string;
  quantity: number;
  customerPriceCents: number | null;
  subcontractorPriceCents: number | null;
};

function normalizeItemType(
  itemType: string,
): ArchiveCalculatorItem["itemType"] {
  switch (itemType) {
    case "PRODUCT_CARD":
    case "BASE_OPTION":
    case "INSTALL_OPTION":
    case "EXTRA_OPTION":
    case "RETURN_OPTION":
      return itemType;
    default:
      return "EXTRA_OPTION";
  }
}

function getProductModelNumber(rawData: unknown) {
  if (
    typeof rawData === "object" &&
    rawData !== null &&
    "modelNumber" in rawData &&
    typeof rawData.modelNumber === "string"
  ) {
    return rawData.modelNumber;
  }

  return "";
}

function getRawString(rawData: unknown, key: string) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return undefined;
  }

  const value = (rawData as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function toArchiveCalculatorItem(item: OrderItemInput): ArchiveCalculatorItem {
  return {
    cardId: item.cardId,
    productName: item.productName ?? "",
    productModelNumber: getProductModelNumber(item.rawData),
    deliveryType: item.deliveryType ?? "",
    itemType: normalizeItemType(item.itemType),
    optionCode: getRawString(item.rawData, "code") || getRawString(item.rawData, "mappedOptionCode") || item.optionCode?.trim() || "",
    optionLabel: getRawString(item.rawData, "label") || getRawString(item.rawData, "description") || item.optionLabel?.trim() || "",
    quantity: item.quantity,
    customerPriceCents: item.customerPriceCents,
    subcontractorPriceCents: item.subcontractorPriceCents,
  };
}

function findMatchingWordpressSubcontractorRow(
  customerRow: WordpressImportPriceRow,
  subcontractorRows: WordpressImportPriceRow[],
  usedIndexes: Set<number>,
) {
  const normalizedCode = (customerRow.code ?? "").trim().toUpperCase();
  const normalizedLabel = customerRow.label.trim().toUpperCase();

  const exactIndex = subcontractorRows.findIndex((row, index) => {
    if (usedIndexes.has(index)) {
      return false;
    }

    return (
      (row.code ?? "").trim().toUpperCase() === normalizedCode &&
      row.label.trim().toUpperCase() === normalizedLabel &&
      row.quantity === customerRow.quantity
    );
  });

  if (exactIndex >= 0) {
    usedIndexes.add(exactIndex);
    return subcontractorRows[exactIndex];
  }

  const fallbackIndex = subcontractorRows.findIndex((_, index) => !usedIndexes.has(index));
  if (fallbackIndex >= 0) {
    usedIndexes.add(fallbackIndex);
    return subcontractorRows[fallbackIndex];
  }

  return undefined;
}

function buildWordpressReadOnlyItems(card: SavedProductCard): ArchiveCalculatorItem[] {
  const snapshot = card.wordpressImportReadOnly;
  if (!snapshot) {
    return [];
  }

  const subcontractorRows = snapshot.subcontractorRows ?? [];
  const usedSubcontractorIndexes = new Set<number>();

  return [
    {
      cardId: card.cardId,
      productName: snapshot.productName,
      productModelNumber: card.modelNumber,
      deliveryType: "",
      itemType: "PRODUCT_CARD",
      optionCode: "",
      optionLabel: "",
      quantity: 1,
      customerPriceCents: null,
      subcontractorPriceCents: null,
    },
    ...snapshot.rows.map((row) => {
      const subcontractorRow = findMatchingWordpressSubcontractorRow(
        row,
        subcontractorRows,
        usedSubcontractorIndexes,
      );

      return {
        cardId: card.cardId,
        productName: snapshot.productName,
        productModelNumber: card.modelNumber,
        deliveryType: "",
        itemType: "EXTRA_OPTION" as const,
        optionCode: row.code ?? "",
        optionLabel: row.label,
        quantity: row.quantity,
        customerPriceCents: row.priceCents,
        subcontractorPriceCents: subcontractorRow?.priceCents ?? null,
      };
    }),
  ];
}

function normalizeProductCardsSnapshot(
  productCardsSnapshot: unknown,
): SavedProductCard[] {
  if (!Array.isArray(productCardsSnapshot)) {
    return [];
  }

  return productCardsSnapshot.map((card, index) =>
    normalizeSavedProductCard(
      card && typeof card === "object"
        ? (card as Partial<SavedProductCard>)
        : null,
      index,
    ),
  );
}

export function buildArchiveCalculatorItems(params: {
  orderItems: OrderItemInput[];
  productCardsSnapshot: unknown;
}): ArchiveCalculatorItem[] {
  const baseItems = params.orderItems.map(toArchiveCalculatorItem);
  const productCards = normalizeProductCardsSnapshot(params.productCardsSnapshot);

  if (!productCards.some((card) => Boolean(card.wordpressImportReadOnly))) {
    return baseItems;
  }

  const groupedBaseItems = new Map<number, ArchiveCalculatorItem[]>();
  const baseOrder: number[] = [];

  for (const item of baseItems) {
    const existing = groupedBaseItems.get(item.cardId);
    if (existing) {
      existing.push(item);
      continue;
    }

    groupedBaseItems.set(item.cardId, [item]);
    baseOrder.push(item.cardId);
  }

  const overrides = new Map<number, ArchiveCalculatorItem[]>();
  for (const card of productCards) {
    if (!card.wordpressImportReadOnly) {
      continue;
    }

    overrides.set(card.cardId, buildWordpressReadOnlyItems(card));
  }

  const orderedCardIds = [
    ...productCards.map((card) => card.cardId),
    ...baseOrder.filter(
      (cardId, index, array) =>
        !productCards.some((card) => card.cardId === cardId) &&
        array.indexOf(cardId) === index,
    ),
  ];

  return orderedCardIds.flatMap(
    (cardId) => overrides.get(cardId) ?? groupedBaseItems.get(cardId) ?? [],
  );
}

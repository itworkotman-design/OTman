import {
  normalizeSavedProductCard,
  type SavedProductCard,
  type WordpressImportPriceRow,
} from "@/app/_components/Dahsboard/booking/create/_types/productCard";

type OrderItemInput = {
  cardId: number;
  productCode: string | null;
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
  productCode: string;
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
    productCode: item.productCode?.trim() || "",
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

function parsePriceCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

function buildWordpressReadOnlyItems(card: SavedProductCard): ArchiveCalculatorItem[] {
  const snapshot = card.wordpressImportReadOnly;
  if (!snapshot) {
    return [];
  }

  const pricedRows = snapshot.rows
    .map((row) => ({
      ...row,
      priceCents: parsePriceCents(row.priceCents),
    }))
    .filter((row): row is typeof row & { priceCents: number } => row.priceCents !== null);
  if (pricedRows.length === 0) {
    return [];
  }

  const subcontractorRows = snapshot.subcontractorRows ?? [];
  const usedSubcontractorIndexes = new Set<number>();

  return [
    {
      cardId: card.cardId,
      productCode: "",
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
    ...pricedRows.map((row) => {
      const subcontractorRow = findMatchingWordpressSubcontractorRow(
        row,
        subcontractorRows,
        usedSubcontractorIndexes,
      );
      const subcontractorPriceCents = parsePriceCents(subcontractorRow?.priceCents);

      return {
        cardId: card.cardId,
        productCode: "",
        productName: snapshot.productName,
        productModelNumber: card.modelNumber,
        deliveryType: "",
        itemType: "EXTRA_OPTION" as const,
        optionCode: row.code ?? "",
        optionLabel: row.label,
        quantity: row.quantity,
        customerPriceCents: row.priceCents,
        subcontractorPriceCents,
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
  const existingPricedLineKeys = new Set(
    baseItems
      .filter((item) => item.customerPriceCents !== null || item.subcontractorPriceCents !== null)
      .map((item) => [item.cardId, item.optionCode, item.optionLabel, item.quantity, item.customerPriceCents, item.subcontractorPriceCents].join("|")),
  );
  const wordpressItems = productCards.flatMap(buildWordpressReadOnlyItems);
  const wordpressAdditions = wordpressItems.filter((item) => {
    if (item.customerPriceCents === null && item.subcontractorPriceCents === null) {
      return false;
    }

    const key = [item.cardId, item.optionCode, item.optionLabel, item.quantity, item.customerPriceCents, item.subcontractorPriceCents].join("|");
    return !existingPricedLineKeys.has(key);
  });

  return [...baseItems, ...wordpressAdditions];
}

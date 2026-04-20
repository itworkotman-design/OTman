import type { OrderItem } from "@prisma/client";

export type OrderSummaryGroup = {
  title: string;
  details: string[];
};

export type LegacyOrderSummarySource = {
  productsSummary?: string | null;
  deliveryTypeSummary?: string | null;
  servicesSummary?: string | null;
};

type OrderItemWithRawData = Pick<
  OrderItem,
  | "cardId"
  | "productName"
  | "deliveryType"
  | "itemType"
  | "optionCode"
  | "optionLabel"
  | "quantity"
  | "rawData"
>;

function formatQuantity(quantity: number | null | undefined) {
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 1) {
    return "";
  }

  const rounded = Math.round(quantity * 100) / 100;
  return ` x${String(rounded)}`;
}

function getRawDataDescription(rawData: unknown) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return "";
  }

  const candidate = rawData as {
    description?: unknown;
    label?: unknown;
    code?: unknown;
  };

  if (typeof candidate.description === "string" && candidate.description.trim()) {
    return candidate.description.trim();
  }

  if (typeof candidate.label === "string" && candidate.label.trim()) {
    return candidate.label.trim();
  }

  if (typeof candidate.code === "string" && candidate.code.trim()) {
    return candidate.code.trim();
  }

  return "";
}

function getOptionDetail(item: OrderItemWithRawData) {
  const baseLabel =
    getRawDataDescription(item.rawData) ||
    item.optionLabel?.trim() ||
    item.optionCode?.trim() ||
    "";

  if (!baseLabel) {
    return "";
  }

  return `${baseLabel}${formatQuantity(item.quantity)}`;
}

function getProductTitle(item: OrderItemWithRawData | undefined) {
  const label = item?.productName?.trim() || "Product";
  return `${label}${formatQuantity(item?.quantity)}`;
}

function groupItemsByCard(items: OrderItemWithRawData[]) {
  const grouped = new Map<number, OrderItemWithRawData[]>();

  for (const item of items) {
    const current = grouped.get(item.cardId) ?? [];
    current.push(item);
    grouped.set(item.cardId, current);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, cardItems]) => cardItems);
}

function splitSummary(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function buildOrderSummaryGroups(
  items: OrderItemWithRawData[],
): OrderSummaryGroup[] {
  return groupItemsByCard(items).map((cardItems) => {
    const productItem = cardItems.find((item) => item.itemType === "PRODUCT_CARD");
    const details: string[] = [];

    if (productItem?.deliveryType?.trim()) {
      details.push(
        `${productItem.deliveryType.trim()}${formatQuantity(productItem.quantity)}`,
      );
    }

    for (const item of cardItems) {
      if (item.itemType === "PRODUCT_CARD") {
        continue;
      }

      const detail = getOptionDetail(item);

      if (detail) {
        details.push(detail);
      }
    }

    return {
      title: getProductTitle(productItem),
      details,
    };
  });
}

export function buildLegacyOrderSummaryGroups(
  source: LegacyOrderSummarySource,
): OrderSummaryGroup[] {
  const title = source.productsSummary?.trim() ?? "";
  const details = [
    source.deliveryTypeSummary?.trim() ?? "",
    ...splitSummary(source.servicesSummary),
  ].filter((detail) => detail.length > 0);

  if (!title && details.length === 0) {
    return [];
  }

  return [
    {
      title: title || "Product",
      details,
    },
  ];
}

export function formatOrderSummaryText(groups: OrderSummaryGroup[]) {
  if (groups.length === 0) {
    return "";
  }

  return groups
    .map((group) => {
      const lines = [group.title, ...group.details.map((detail) => `- ${detail}`)];
      return lines.join("\n");
    })
    .join("\n\n");
}

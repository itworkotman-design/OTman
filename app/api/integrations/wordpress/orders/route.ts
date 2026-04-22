// path: app/api/integrations/wordpress/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import {
  buildOrderItemsFromCards,
  type BuiltOrderItem,
} from "@/lib/orders/buildOrderItemsFromCards";
import {
  mapWordpressImportToProductCards,
  type ResolvedWordpressService,
} from "@/lib/integrations/wordpress/catalogMapping";
import { getProductDeliveryTypeLabel } from "@/lib/products/deliveryTypes";

type WordpressOrderSyncPayload = {
  legacyWordpressOrderId: number;
  legacyWordpressUserId: number;
  createdAt?: string | null;
  status?: string | null;
  title?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

type ParsedWordpressProductItem = {
  cardId: number;
  productName: string;
  quantity: number;
  deliveryType?: string;
  rawData: Prisma.InputJsonValue;
};

type ParsedWordpressServiceItem = {
  cardId: number;
  productName: string;
  quantity: number;
  itemType: "INSTALL_OPTION" | "RETURN_OPTION" | "EXTRA_OPTION";
  label: string;
  code?: string;
  rawData: Prisma.InputJsonValue;
};

type ParsedBreakdownRow = {
  label: string;
  code?: string;
};

type ParsedBreakdownGroup = {
  groupLabel: string;
  rows: ParsedBreakdownRow[];
};

const DELIVERY_TYPE_CODES = new Set([
  "SIDEBYSIDETRAPP",
  "SIDEBYSIDE",
  "DELIVERY",
  "INDOOR",
  "XTRA",
  "INSSBS1",
  "INSSBS2",
  "INSTALLONLY",
  "KUNMONTERING",
]);

const SUMMARY_LABEL_PATTERNS = [
  /^mva\b/i,
  /^total\b/i,
  /^total inkl/i,
  /^km pris\b/i,
  /^rabatt\b/i,
  /^ekstra\b/i,
];

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const getFirstMetaString = (
  meta: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = asString(meta[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
};

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&aring;/gi, "\u00e5")
    .replace(/&oslash;/gi, "\u00f8")
    .replace(/&aelig;/gi, "\u00e6")
    .replace(/&Aring;/g, "\u00c5")
    .replace(/&Oslash;/g, "\u00d8")
    .replace(/&AElig;/g, "\u00c6")
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    );

const stripHtml = (value: string): string =>
  normalizeWhitespace(decodeHtmlEntities(value.replace(/<[^>]*>/g, " ")));

const cleanLegacyBreakdownLabel = (value: string): string => {
  const normalizedValue = normalizeWhitespace(stripHtml(value));
  if (!normalizedValue) return "";

  const parenMatch = normalizedValue.match(/^(.*?)\s*\(([^)]+)\)\s*$/u);
  const withoutParen = parenMatch ? parenMatch[1] ?? "" : normalizedValue;
  const parts = withoutParen.split(":").map((part) => normalizeWhitespace(part));

  if (parts.length >= 3 && parts[1]) {
    return parts[1];
  }

  if (parts.length === 2) {
    const maybePrice = parts[0]?.replace(/[ .,]/g, "") ?? "";
    if (maybePrice && /^\d+$/.test(maybePrice)) {
      return parts[1] ?? "";
    }

    return parts[0] ?? "";
  }

  return parts[0] ?? "";
};

const parseBreakdownLabelAndCode = (value: string): ParsedBreakdownRow => {
  const normalizedValue = normalizeWhitespace(stripHtml(value));
  if (!normalizedValue) {
    return { label: "" };
  }

  const parenMatch = normalizedValue.match(/^(.*?)\s*\(([^)]+)\)\s*$/u);
  if (parenMatch) {
    return {
      label: cleanLegacyBreakdownLabel(parenMatch[1] ?? ""),
      code: normalizeWhitespace(parenMatch[2] ?? "").toUpperCase() || undefined,
    };
  }

  const parts = normalizedValue.split(":").map((part) => normalizeWhitespace(part));
  if (parts.length >= 3) {
    return {
      label: cleanLegacyBreakdownLabel(normalizedValue),
      code: (parts[2] ?? "").toUpperCase() || undefined,
    };
  }

  if (parts.length === 2) {
    const maybePrice = parts[0]?.replace(/[ .,]/g, "") ?? "";
    return {
      label: cleanLegacyBreakdownLabel(normalizedValue),
      code:
        maybePrice && /^\d+$/.test(maybePrice)
          ? undefined
          : (parts[1] ?? "").toUpperCase() || undefined,
    };
  }

  return {
    label: cleanLegacyBreakdownLabel(normalizedValue),
  };
};

const cleanDeliveryType = (raw?: string): string | undefined => {
  if (!raw) return undefined;

  const parts = raw.split(":");
  if (parts.length >= 2) {
    return parts[1]?.trim() || raw;
  }

  return raw;
};

const PRODUCT_REPEATER_KEY_PATTERN = /^(.*)_(\d+)_velg_produkt$/;

const PRODUCT_NAME_FIELD_SUFFIXES = ["velg_produkt"];
const DELIVERY_TYPE_FIELD_SUFFIXES = [
  "velg_leveringstype",
  "leveringstype",
  "delivery_type",
];
const QUANTITY_FIELD_SUFFIXES = [
  "antall_produkter",
  "antall",
  "quantity",
  "qty",
];

const getIndexedMetaString = (params: {
  meta: Record<string, unknown>;
  prefix: string;
  index: number;
  suffixes: string[];
}): string | undefined => {
  const { meta, prefix, index, suffixes } = params;

  for (const suffix of suffixes) {
    const value = asString(meta[`${prefix}_${index}_${suffix}`]);
    if (value) {
      return value;
    }
  }

  return undefined;
};

const buildProductItemsFromMeta = (
  meta: Record<string, unknown>,
): ParsedWordpressProductItem[] => {
  const items: ParsedWordpressProductItem[] = [];
  const entries = Object.keys(meta)
    .map((key) => {
      const match = key.match(PRODUCT_REPEATER_KEY_PATTERN);
      if (!match) {
        return null;
      }

      const prefix = match[1] ?? "";
      const index = Number.parseInt(match[2] ?? "", 10);
      if (!Number.isInteger(index)) {
        return null;
      }

      return { prefix, index };
    })
    .filter((entry): entry is { prefix: string; index: number } => entry !== null)
    .sort((left, right) => {
      const leftExtra = left.prefix.includes("extra") ? 1 : 0;
      const rightExtra = right.prefix.includes("extra") ? 1 : 0;
      if (leftExtra !== rightExtra) {
        return leftExtra - rightExtra;
      }

      if (left.prefix !== right.prefix) {
        return left.prefix.localeCompare(right.prefix);
      }

      return left.index - right.index;
    });

  for (const [position, entry] of entries.entries()) {
    const productName = getIndexedMetaString({
      meta,
      prefix: entry.prefix,
      index: entry.index,
      suffixes: PRODUCT_NAME_FIELD_SUFFIXES,
    });
    if (!productName) {
      continue;
    }

    const deliveryTypeRaw = getIndexedMetaString({
      meta,
      prefix: entry.prefix,
      index: entry.index,
      suffixes: DELIVERY_TYPE_FIELD_SUFFIXES,
    });
    const deliveryType = cleanDeliveryType(deliveryTypeRaw);

    const qtyRaw = getIndexedMetaString({
      meta,
      prefix: entry.prefix,
      index: entry.index,
      suffixes: QUANTITY_FIELD_SUFFIXES,
    });
    const quantity = qtyRaw ? Number.parseFloat(qtyRaw) || 1 : 1;

    items.push({
      cardId: position + 1,
      productName,
      quantity,
      deliveryType,
      rawData: {
        source: "wordpress_sync",
        metaPrefix: entry.prefix,
        metaIndex: entry.index,
        productName,
        quantity,
        deliveryTypeRaw: deliveryTypeRaw ?? null,
        deliveryType: deliveryType ?? null,
      },
    });
  }

  return items;
};

const parseBreakdownGroups = (value: string | undefined): ParsedBreakdownGroup[] => {
  if (!value) return [];

  const html = value.replace(/\r/g, "");
  const rawSegments = html.split(/<div class="price-group">/i).slice(1);
  const groups: ParsedBreakdownGroup[] = [];

  for (const rawSegment of rawSegments) {
    const segment = rawSegment.split(/<div class="price-group">|<hr\b/i)[0] ?? "";
    const groupLabelMatch = segment.match(
      /<div class="price-group-label">\s*<strong>([\s\S]*?)<\/strong>\s*<\/div>/i,
    );

    const rows = Array.from(
      segment.matchAll(
        /<span class="price-breakdown-label">([\s\S]*?)<\/span>/gi,
      ),
    )
      .map((match) => parseBreakdownLabelAndCode(match[1] ?? ""))
      .filter((row) => row.label);

    const groupLabel = stripHtml(groupLabelMatch?.[1] ?? "");
    if (!groupLabel && rows.length === 0) {
      continue;
    }

    groups.push({
      groupLabel,
      rows,
    });
  }

  return groups;
};

const isSummaryLabel = (label: string): boolean =>
  SUMMARY_LABEL_PATTERNS.some((pattern) => pattern.test(label));

const isDeliveryTypeRow = (row: ParsedBreakdownRow): boolean => {
  if (row.code && DELIVERY_TYPE_CODES.has(row.code)) {
    return true;
  }

  return /kun\s+installasjon|kun\s+installasjon\/?montering|kun\s+montering/i.test(
    row.label,
  );
};

const classifyServiceItemType = (
  row: ParsedBreakdownRow,
): ParsedWordpressServiceItem["itemType"] => {
  const signal = `${row.code ?? ""} ${row.label}`.toUpperCase();

  if (signal.includes("RETURN") || signal.includes("RETUR")) {
    return "RETURN_OPTION";
  }

  if (
    signal.includes("INSTALL") ||
    signal.includes("MONTER") ||
    signal.includes("DEMONT")
  ) {
    return "INSTALL_OPTION";
  }

  return "EXTRA_OPTION";
};

const buildServiceItemsFromBreakdown = (
  meta: Record<string, unknown>,
  productItems: ParsedWordpressProductItem[],
): ParsedWordpressServiceItem[] => {
  const breakdownHtml = asString(meta.price_breakdown_html);
  const groups = parseBreakdownGroups(breakdownHtml);
  const serviceItems: ParsedWordpressServiceItem[] = [];

  groups.forEach((group, index) => {
    const productItem = productItems[index];
    const cardId = productItem?.cardId ?? index + 1;
    const productName =
      (productItem?.productName ?? group.groupLabel) || "Product";
    const quantity = productItem?.quantity ?? 1;

    for (const row of group.rows) {
      if (!row.label || isSummaryLabel(row.label) || isDeliveryTypeRow(row)) {
        continue;
      }

      serviceItems.push({
        cardId,
        productName,
        quantity,
        itemType: classifyServiceItemType(row),
        label: row.label,
        code: row.code,
        rawData: {
          source: "wordpress_sync",
          sourceType: "price_breakdown_html",
          cardId,
          groupLabel: group.groupLabel || productName,
          label: row.label,
          description: row.label,
          code: row.code ?? null,
          quantity,
        },
      });
    }
  });

  return serviceItems;
};

const buildServicesSummary = (
  serviceItems: ParsedWordpressServiceItem[],
): string | undefined => {
  if (serviceItems.length === 0) {
    return undefined;
  }

  const counts = new Map<string, number>();

  for (const item of serviceItems) {
    counts.set(item.label, (counts.get(item.label) ?? 0) + item.quantity);
  }

  return Array.from(counts.entries(), ([label, quantity]) =>
    quantity > 1 ? `${label} x${quantity}` : label,
  ).join(", ");
};

const attachServiceLabelsToProductItems = (
  productItems: ParsedWordpressProductItem[],
  serviceItems: ParsedWordpressServiceItem[],
): ParsedWordpressProductItem[] =>
  productItems.map((item) => {
    const linkedServiceItems = serviceItems.filter(
      (serviceItem) => serviceItem.cardId === item.cardId,
    );

    return {
      ...item,
      rawData: {
        ...(item.rawData as Record<string, Prisma.InputJsonValue>),
        serviceLabels: linkedServiceItems.map((serviceItem) => serviceItem.label),
        installLabels: linkedServiceItems
          .filter((serviceItem) => serviceItem.itemType === "INSTALL_OPTION")
          .map((serviceItem) => serviceItem.label),
        returnLabels: linkedServiceItems
          .filter((serviceItem) => serviceItem.itemType === "RETURN_OPTION")
          .map((serviceItem) => serviceItem.label),
        extraLabels: linkedServiceItems
          .filter((serviceItem) => serviceItem.itemType === "EXTRA_OPTION")
          .map((serviceItem) => serviceItem.label),
      },
    };
  });

type JsonRecord = Record<string, Prisma.InputJsonValue>;

type ImportedOrderItemData = Omit<Prisma.OrderItemCreateManyInput, "orderId">;

const toJsonRecord = (value: unknown): JsonRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
};

const buildResolvedServiceKey = (
  cardId: number,
  itemType: string,
  optionCode: string | null | undefined,
): string => `${cardId}|${itemType}|${optionCode ?? ""}`;

const buildServiceSignature = (service: {
  cardId: number;
  itemType: string;
  label: string;
  code?: string | null;
}): string => `${service.cardId}|${service.itemType}|${service.code ?? ""}|${service.label}`;

const buildResolvedServiceQueues = (
  services: ResolvedWordpressService[],
): Map<string, ResolvedWordpressService[]> => {
  const queues = new Map<string, ResolvedWordpressService[]>();

  for (const service of services) {
    const key = buildResolvedServiceKey(
      service.cardId,
      service.resolvedItemType,
      service.optionCode,
    );
    const currentQueue = queues.get(key) ?? [];
    currentQueue.push(service);
    queues.set(key, currentQueue);
  }

  return queues;
};

const takeResolvedServiceMatch = (
  queues: Map<string, ResolvedWordpressService[]>,
  item: BuiltOrderItem,
): ResolvedWordpressService | null => {
  if (item.itemType === "PRODUCT_CARD" || !item.optionCode) {
    return null;
  }

  const key = buildResolvedServiceKey(item.cardId, item.itemType, item.optionCode);
  const queue = queues.get(key);
  if (!queue || queue.length === 0) {
    return null;
  }

  const match = queue.shift() ?? null;
  if (queue.length === 0) {
    queues.delete(key);
  }

  return match;
};

const buildProductRawDataLookup = (
  productItems: ParsedWordpressProductItem[],
): Map<number, JsonRecord> =>
  new Map(
    productItems.map((item) => [item.cardId, toJsonRecord(item.rawData)]),
  );

const buildParsedServiceLookup = (
  serviceItems: ParsedWordpressServiceItem[],
): Map<string, JsonRecord[]> => {
  const lookup = new Map<string, JsonRecord[]>();

  for (const serviceItem of serviceItems) {
    const signature = buildServiceSignature(serviceItem);
    const current = lookup.get(signature) ?? [];
    current.push(toJsonRecord(serviceItem.rawData));
    lookup.set(signature, current);
  }

  return lookup;
};

const takeParsedServiceRawData = (
  lookup: Map<string, JsonRecord[]>,
  service: {
    cardId: number;
    itemType: string;
    label: string;
    code?: string | null;
  },
): JsonRecord => {
  const signature = buildServiceSignature(service);
  const queue = lookup.get(signature);
  if (!queue || queue.length === 0) {
    return {};
  }

  const match = queue.shift() ?? {};
  if (queue.length === 0) {
    lookup.delete(signature);
  }

  return match;
};

const enrichNativeItemsWithWordpressRawData = (params: {
  nativeItems: BuiltOrderItem[];
  productItems: ParsedWordpressProductItem[];
  resolvedServiceQueues: Map<string, ResolvedWordpressService[]>;
}): BuiltOrderItem[] => {
  const { nativeItems, productItems, resolvedServiceQueues } = params;
  const productRawDataLookup = buildProductRawDataLookup(productItems);

  return nativeItems.map((item) => {
    if (item.itemType === "PRODUCT_CARD") {
      return {
        ...item,
        rawData: {
          ...toJsonRecord(item.rawData),
          ...productRawDataLookup.get(item.cardId),
        },
      };
    }

    const matchedService = takeResolvedServiceMatch(resolvedServiceQueues, item);
    if (!matchedService) {
      return item;
    }

    return {
      ...item,
      rawData: {
        ...toJsonRecord(item.rawData),
        source: "wordpress_sync",
        sourceType: "price_breakdown_html",
        description: matchedService.label,
        label: matchedService.label,
        code: matchedService.code ?? matchedService.optionCode,
        mappedOptionCode: matchedService.optionCode,
      },
    };
  });
};

const buildSupplementalResolvedServiceItems = (params: {
  resolvedServices: ResolvedWordpressService[];
  productCards: ReturnType<typeof mapWordpressImportToProductCards>["productCards"];
  catalogProducts: Awaited<ReturnType<typeof getBookingCatalog>>["products"];
  parsedServiceLookup: Map<string, JsonRecord[]>;
}): ImportedOrderItemData[] => {
  const { resolvedServices, productCards, catalogProducts, parsedServiceLookup } =
    params;
  const cardLookup = new Map(productCards.map((card) => [card.cardId, card]));
  const productLookup = new Map(catalogProducts.map((product) => [product.id, product]));

  return resolvedServices.map((service) => {
    const card = cardLookup.get(service.cardId) ?? null;
    const product =
      card?.productId ? (productLookup.get(card.productId) ?? null) : null;
    const parsedRawData = takeParsedServiceRawData(parsedServiceLookup, service);

    return {
      cardId: service.cardId,
      productId: product?.id ?? null,
      productCode: product?.code ?? null,
      productName: product?.label ?? service.productName,
      deliveryType:
        product?.allowDeliveryTypes && card?.deliveryType
          ? getProductDeliveryTypeLabel(product.deliveryTypes, card.deliveryType)
          : null,
      itemType: service.resolvedItemType,
      optionId: service.optionId,
      optionCode: service.optionCode,
      optionLabel: service.optionLabel,
      quantity: service.quantity,
      customerPriceCents: service.customerPriceCents,
      subcontractorPriceCents: service.subcontractorPriceCents,
      rawData: {
        ...parsedRawData,
        source: "wordpress_sync",
        sourceType: "price_breakdown_html",
        description: service.label,
        label: service.label,
        code: service.code ?? service.optionCode,
        mappedOptionCode: service.optionCode,
      },
    };
  });
};

const buildFallbackImportedItems = (params: {
  unresolvedProducts: ReturnType<typeof mapWordpressImportToProductCards>["unresolvedProducts"];
  unresolvedServices: ReturnType<typeof mapWordpressImportToProductCards>["unresolvedServices"];
  productItems: ParsedWordpressProductItem[];
  parsedServiceLookup: Map<string, JsonRecord[]>;
}): ImportedOrderItemData[] => {
  const { unresolvedProducts, unresolvedServices, productItems, parsedServiceLookup } =
    params;
  const productLookup = new Map(productItems.map((item) => [item.cardId, item]));

  const fallbackProducts = unresolvedProducts.map((item) => ({
    cardId: item.cardId,
    productId: null,
    productCode: null,
    productName: item.productName,
    deliveryType: item.deliveryType ?? null,
    itemType: "PRODUCT_CARD" as const,
    optionId: null,
    optionCode: null,
    optionLabel: null,
    quantity: item.quantity,
    customerPriceCents: null,
    subcontractorPriceCents: null,
    rawData: {
      ...toJsonRecord(productLookup.get(item.cardId)?.rawData),
      source: "wordpress_sync",
      resolution: "fallback_product",
    },
  }));

  const fallbackServices = unresolvedServices.map((item) => ({
    cardId: item.cardId,
    productId: null,
    productCode: null,
    productName: item.productName,
    deliveryType: null,
    itemType: item.itemType,
    optionId: null,
    optionCode: item.code ?? null,
    optionLabel: item.label,
    quantity: item.quantity,
    customerPriceCents: null,
    subcontractorPriceCents: null,
    rawData: {
      ...takeParsedServiceRawData(parsedServiceLookup, item),
      source: "wordpress_sync",
      resolution: "fallback_service",
    },
  }));

  return [...fallbackProducts, ...fallbackServices];
};

const toCreateManyItem = (
  orderId: string,
  item: ImportedOrderItemData,
): Prisma.OrderItemCreateManyInput => ({
  orderId,
  cardId: item.cardId,
  productId: item.productId,
  productCode: item.productCode,
  productName: item.productName,
  deliveryType: item.deliveryType,
  itemType: item.itemType,
  optionId: item.optionId,
  optionCode: item.optionCode,
  optionLabel: item.optionLabel,
  quantity: item.quantity,
  customerPriceCents: item.customerPriceCents,
  subcontractorPriceCents: item.subcontractorPriceCents,
  rawData: item.rawData
    ? (item.rawData as Prisma.InputJsonValue)
    : Prisma.JsonNull,
});

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-wp-sync-secret");

    if (
      !process.env.WORDPRESS_SYNC_SECRET ||
      secret !== process.env.WORDPRESS_SYNC_SECRET
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as WordpressOrderSyncPayload;

    if (
      !body ||
      !Number.isInteger(body.legacyWordpressOrderId) ||
      !Number.isInteger(body.legacyWordpressUserId)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const companyId = process.env.WORDPRESS_SYNC_COMPANY_ID;
    if (!companyId) {
      return NextResponse.json(
        { error: "Missing WORDPRESS_SYNC_COMPANY_ID" },
        { status: 500 },
      );
    }

    const membership = await prisma.membership.findFirst({
      where: {
        companyId,
        legacyWordpressUserId: body.legacyWordpressUserId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        priceListId: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        {
          error: "Membership not found for legacyWordpressUserId",
          legacyWordpressUserId: body.legacyWordpressUserId,
        },
        { status: 404 },
      );
    }

    const meta =
      body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? (body.meta as Record<string, unknown>)
        : {};

    const pickupAddress = getFirstMetaString(meta, [
      "pickup_address",
      "henteadresse",
    ]);
    const deliveryAddress = getFirstMetaString(meta, [
      "delivery_address",
      "leveringsadresse",
    ]);
    const returnAddress = getFirstMetaString(meta, [
      "returadresse",
      "return_address",
    ]);
    const customerName = getFirstMetaString(meta, ["kundens_navn", "customer_name"]);
    const customerLabel = customerName ?? getFirstMetaString(meta, ["bestillingsnr"]);
    const phone = getFirstMetaString(meta, ["telefon_full", "telefon", "phone"]);
    const phoneTwo = getFirstMetaString(meta, [
      "ekstra_kundens_telefon",
      "additional_customer_phone",
      "phone_two",
    ]);
    const email = getFirstMetaString(meta, [
      "e-postadresse",
      "epostadresse",
      "email",
      "customer_email",
    ]);
    const customerComments = getFirstMetaString(meta, [
      "contact_notes",
      "customer_comments",
      "kunde_kommentar",
    ]);
    const floorNo = getFirstMetaString(meta, ["etasje_nr", "floor_no", "floor"]);
    const cashierName = getFirstMetaString(meta, [
      "kasserers_navn",
      "cashier_name",
    ]);
    const cashierPhone = getFirstMetaString(meta, [
      "kasserers_telefon_full",
      "kasserers_telefon",
      "cashier_phone",
    ]);
    const deliveryDate = getFirstMetaString(meta, [
      "leveringsdato",
      "delivery_date",
    ]);
    const timeWindow = getFirstMetaString(meta, [
      "tidsvindu_for_levering",
      "delivery_time_window",
      "time_window",
    ]);
    const orderNumber = getFirstMetaString(meta, ["bestillingsnr", "order_number"]);
    const status = getFirstMetaString(meta, ["status"]) ?? asString(body.status);
    const description =
      getFirstMetaString(meta, ["beskrivelse", "description"]) ??
      orderNumber ??
      asString(body.title);

    const parsedProductItems = buildProductItemsFromMeta(meta);
    const parsedServiceItems = buildServiceItemsFromBreakdown(
      meta,
      parsedProductItems,
    );
    const productItems = attachServiceLabelsToProductItems(
      parsedProductItems,
      parsedServiceItems,
    );

    const productsSummary =
      productItems.length > 0
        ? productItems
            .map((item) =>
              item.quantity > 1
                ? `${item.productName} x${item.quantity}`
                : item.productName,
            )
            .join(", ")
        : undefined;

    const deliveryTypeSummary =
      productItems.length > 0
        ? productItems
            .map((item) => item.deliveryType)
            .filter((value): value is string => Boolean(value))
            .join(", ")
        : undefined;

    const servicesSummary = buildServicesSummary(parsedServiceItems);
    const catalog = await getBookingCatalog(membership.priceListId ?? null);
    const mappedImport = mapWordpressImportToProductCards({
      parsedProducts: productItems.map((item) => ({
        cardId: item.cardId,
        productName: item.productName,
        quantity: item.quantity,
        deliveryType: item.deliveryType,
      })),
      parsedServices: parsedServiceItems.map((item) => ({
        cardId: item.cardId,
        productName: item.productName,
        quantity: item.quantity,
        itemType: item.itemType,
        label: item.label,
        code: item.code,
      })),
      catalogProducts: catalog.products,
      catalogSpecialOptions: catalog.specialOptions,
    });

    const resolvedServiceQueues = buildResolvedServiceQueues(
      mappedImport.resolvedServices,
    );
    const nativeItems = enrichNativeItemsWithWordpressRawData({
      nativeItems: buildOrderItemsFromCards(
        mappedImport.productCards,
        catalog.products,
        catalog.specialOptions,
      ),
      productItems,
      resolvedServiceQueues,
    });
    const parsedServiceLookup = buildParsedServiceLookup(parsedServiceItems);
    const supplementalItems = buildSupplementalResolvedServiceItems({
      resolvedServices: Array.from(resolvedServiceQueues.values()).flat(),
      productCards: mappedImport.productCards,
      catalogProducts: catalog.products,
      parsedServiceLookup,
    });
    const fallbackItems = buildFallbackImportedItems({
      unresolvedProducts: mappedImport.unresolvedProducts,
      unresolvedServices: mappedImport.unresolvedServices,
      productItems,
      parsedServiceLookup,
    });
    const importedItems = [
      ...nativeItems.map((item) => ({
        cardId: item.cardId,
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        deliveryType: item.deliveryType,
        itemType: item.itemType,
        optionId: item.optionId,
        optionCode: item.optionCode,
        optionLabel: item.optionLabel,
        quantity: item.quantity,
        customerPriceCents: item.customerPriceCents,
        subcontractorPriceCents: item.subcontractorPriceCents,
        rawData: item.rawData ?? Prisma.JsonNull,
      })),
      ...supplementalItems,
      ...fallbackItems,
    ];

    const existing = await prisma.order.findUnique({
      where: {
        legacyWordpressOrderId: body.legacyWordpressOrderId,
      },
      select: {
        id: true,
        displayId: true,
      },
    });

    const order = existing
      ? await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const updated = await tx.order.update({
            where: {
              legacyWordpressOrderId: body.legacyWordpressOrderId,
            },
            data: {
              createdByMembershipId: membership.id,
              customerMembershipId: membership.id,
              priceListId: membership.priceListId ?? null,
              legacyWordpressAuthorId: body.legacyWordpressUserId,
              legacyWordpressRawMeta: body.meta ?? Prisma.JsonNull,
              status,
              description,
              pickupAddress,
              deliveryAddress,
              returnAddress,
              customerName,
              customerLabel,
              phone,
              phoneTwo,
              email,
              customerComments,
              floorNo,
              cashierName,
              cashierPhone,
              deliveryDate,
              timeWindow,
              orderNumber,
              productsSummary,
              deliveryTypeSummary,
              servicesSummary,
              productCardsSnapshot:
                mappedImport.productCards.length > 0
                  ? (mappedImport.productCards as unknown as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
            },
            select: {
              id: true,
              displayId: true,
              legacyWordpressOrderId: true,
            },
          });

          await tx.orderItem.deleteMany({
            where: {
              orderId: updated.id,
            },
          });

          if (importedItems.length > 0) {
            await tx.orderItem.createMany({
              data: importedItems.map((item) => toCreateManyItem(updated.id, item)),
            });
          }

          return updated;
        })
      : await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const currentCounter = await tx.companyOrderCounter.upsert({
            where: { companyId },
            update: {},
            create: {
              companyId,
              nextNumber: 1,
            },
            select: {
              nextNumber: true,
            },
          });

          const created = await tx.order.create({
            data: {
              companyId,
              createdByMembershipId: membership.id,
              customerMembershipId: membership.id,
              priceListId: membership.priceListId ?? null,
              legacyWordpressOrderId: body.legacyWordpressOrderId,
              legacyWordpressAuthorId: body.legacyWordpressUserId,
              legacyWordpressRawMeta: body.meta ?? Prisma.JsonNull,
              createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
              updatedAt: body.createdAt ? new Date(body.createdAt) : undefined,
              displayId: currentCounter.nextNumber,
              status,
              description,
              pickupAddress,
              deliveryAddress,
              returnAddress,
              customerName,
              customerLabel,
              phone,
              phoneTwo,
              email,
              customerComments,
              floorNo,
              cashierName,
              cashierPhone,
              deliveryDate,
              timeWindow,
              orderNumber,
              productsSummary,
              deliveryTypeSummary,
              servicesSummary,
              productCardsSnapshot:
                mappedImport.productCards.length > 0
                  ? (mappedImport.productCards as unknown as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
              dontSendEmail: true,
              extraPickupAddress: [],
            },
            select: {
              id: true,
              displayId: true,
              legacyWordpressOrderId: true,
            },
          });

          if (importedItems.length > 0) {
            await tx.orderItem.createMany({
              data: importedItems.map((item) => toCreateManyItem(created.id, item)),
            });
          }

          await tx.companyOrderCounter.update({
            where: { companyId },
            data: {
              nextNumber: { increment: 1 },
            },
          });

          return created;
        });

    return NextResponse.json({
      ok: true,
      order,
      importedItemCount: importedItems.length,
    });
  } catch (error) {
    console.error("wordpress order sync failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

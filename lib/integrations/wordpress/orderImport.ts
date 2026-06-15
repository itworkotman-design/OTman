import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { buildOrderItemsFromCards, type BuiltOrderItem } from "@/lib/orders/buildOrderItemsFromCards";
import { normalizeAttachmentCategory, type AttachmentCategory } from "@/lib/orders/attachmentCategories";
import { isS3AttachmentStorageConfigured, uploadAttachmentBufferToS3 } from "@/lib/orders/orderAttachmentStorage";
import { POST as syncWordpressOrder } from "@/app/api/integrations/wordpress/orders/route";
import {
  mapWordpressImportToProductCards,
  type WordpressParsedProduct,
  type WordpressParsedService,
} from "@/lib/integrations/wordpress/catalogMapping";
import { getWordpressExpressDelivery, normalizeWordpressExtraPickups } from "@/lib/integrations/wordpress/orderMeta";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import { NextRequest } from "next/server";

export type WordpressImportMode = "dry-run" | "apply";

export type WordpressImportOptions = {
  mode: WordpressImportMode;
  fromPage: number;
  limitPages: number | null;
  orderId: number | null;
  debug: boolean;
};

export type WordpressImportFailure = {
  legacyWordpressOrderId: number | null;
  reason: string;
};

export type WordpressImportSummary = {
  imported: number;
  skipped: number;
  failed: number;
  failures: WordpressImportFailure[];
};

export type WordpressOrderListPage = {
  orders: WordpressOrderRecord[];
  totalPages: number | null;
  totalCount: number | null;
};

export type WordpressOrderRecord = Record<string, unknown> & {
  id?: unknown;
  author?: unknown;
  date?: unknown;
  date_gmt?: unknown;
  modified?: unknown;
  modified_gmt?: unknown;
  status?: unknown;
  title?: unknown;
  meta?: unknown;
  acf?: unknown;
  postmeta?: unknown;
};

export type WordpressAttachmentImportSummary = WordpressImportSummary & {
  uploaded: number;
};

type ParsedWordpressOrder = {
  legacyWordpressOrderId: number;
  legacyWordpressUserId: number;
  payload: WordpressOrderSyncPayload;
};

type WordpressOrderSyncPayload = {
  legacyWordpressOrderId: number;
  legacyWordpressUserId: number;
  createdAt?: string | null;
  modifiedAt?: string | null;
  status?: string | null;
  title?: string | null;
  meta?: Record<string, unknown>;
  attachments?: {
    id?: number | string | null;
    url?: string | null;
    sourceUrl?: string | null;
    filename?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    category?: string | null;
  }[];
};

type ParsedServiceEntry = {
  cardId: number;
  productName: string;
  itemType: WordpressParsedService["itemType"];
  optionCode: string | null;
  optionLabel: string;
  quantity: number;
  customerPriceCents: number | null;
  rawData: Record<string, unknown>;
};

type HistoricalParsedProductEntry = WordpressParsedProduct & {
  metaPrefix: string;
  metaIndex: number;
  rawData: Record<string, unknown>;
};

type HistoricalMappedItems = {
  items: Prisma.OrderItemCreateManyOrderInput[];
  productCardsSnapshot: Prisma.OrderUncheckedCreateInput["productCardsSnapshot"];
  productsSummary: string | undefined;
  deliveryTypeSummary: string | undefined;
  servicesSummary: string | undefined;
};

type HistoricalCardSnapshot = SavedProductCard & {
  wordpressImportReadOnly?: SavedProductCard["wordpressImportReadOnly"];
};

type WordpressAttachmentCandidate = {
  legacyWordpressAttachmentId: number;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  sourceUrl: string;
  category: AttachmentCategory;
};

const DEFAULT_WORDPRESS_ORDER_POST_TYPE = "orders";
const DEFAULT_PER_PAGE = 100;
const RAW_PAYLOAD_KEY = "__rawWordpressOrder";
const RAW_POSTMETA_KEY = "__rawPostMeta";
const IMPORT_SOURCE = "wordpress_historical_import";

class WordpressRestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly statusText: string,
  ) {
    super(message);
    this.name = "WordpressRestError";
  }
}

const STATUS_ALIASES: Record<string, string> = {
  active: "active",
  aktiv: "active",
  avbrutt: "cancelled",
  behandles: "processing",
  behandling: "processing",
  bekreftet: "confirmed",
  betalt: "paid",
  canceled: "cancelled",
  cancelled: "cancelled",
  completed: "completed",
  fail: "failed",
  failed: "failed",
  feilet: "failed",
  ferdig: "completed",
  fakturert: "invoiced",
  fakturet: "invoiced",
  invoiced: "invoiced",
  paid: "paid",
  processing: "processing",
};

const TERMINAL_STATUSES = new Set(["cancelled", "completed", "failed", "invoiced", "paid"]);

function getWordpressBaseUrl(): string {
  const baseUrl = process.env.WORDPRESS_API_BASE_URL?.trim() || process.env.WORDPRESS_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("Missing WORDPRESS_API_BASE_URL or WORDPRESS_BASE_URL");
  }

  return baseUrl.replace(/\/+$/u, "");
}

function normalizeRestPath(pathname: string): string {
  const trimmed = pathname.trim().replace(/\/+$/u, "");
  if (!trimmed) {
    throw new Error("WordPress REST path cannot be empty");
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function getWordpressOrderRestPath(): string {
  const customPath = process.env.WORDPRESS_ORDER_REST_PATH?.trim();
  if (customPath) {
    return normalizeRestPath(customPath);
  }

  const postType = process.env.WORDPRESS_ORDER_POST_TYPE?.trim() || DEFAULT_WORDPRESS_ORDER_POST_TYPE;
  const normalizedPostType = postType.replace(/^\/+|\/+$/gu, "");
  if (!normalizedPostType) {
    throw new Error("WORDPRESS_ORDER_POST_TYPE cannot be empty");
  }

  return `/wp-json/wp/v2/${encodeURIComponent(normalizedPostType)}`;
}

function getWordpressPostMetaRestPath(): string | null {
  const customPath = process.env.WORDPRESS_POSTMETA_REST_PATH?.trim() || process.env.WORDPRESS_ORDER_POSTMETA_REST_PATH?.trim();
  if (customPath) {
    return normalizeRestPath(customPath);
  }

  return null;
}

function getConfiguredWordpressOrderPostType(): string {
  return process.env.WORDPRESS_ORDER_POST_TYPE?.trim() || DEFAULT_WORDPRESS_ORDER_POST_TYPE;
}

function isPostMetaExpected(): boolean {
  return getConfiguredWordpressOrderPostType() === "power_order" || getWordpressPostMetaRestPath() !== null;
}

function getWordpressEndpointHelp(status: number): string {
  if (status !== 404 && status !== 401 && status !== 403) {
    return "";
  }

  const postType = process.env.WORDPRESS_ORDER_POST_TYPE?.trim() || DEFAULT_WORDPRESS_ORDER_POST_TYPE;
  const tablePrefix = process.env.WORDPRESS_DB_TABLE_PREFIX?.trim() || "21gLt_";

  return [
    `Resolved post type: ${postType}.`,
    "If the custom post type is not exposed by WordPress REST, set show_in_rest=true or provide WORDPRESS_ORDER_REST_PATH for a custom endpoint.",
    `Current WordPress table prefix for a DB-backed custom endpoint/import is ${tablePrefix}.`,
  ].join(" ");
}

function getWordpressHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const bearerToken = process.env.WORDPRESS_API_BEARER_TOKEN?.trim();
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
    return headers;
  }

  const username = process.env.WORDPRESS_API_USERNAME?.trim();
  const applicationPassword = process.env.WORDPRESS_API_APPLICATION_PASSWORD?.trim();
  if (username && applicationPassword) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${applicationPassword}`).toString("base64")}`;
  }

  return headers;
}

function getWordpressPostMetaHeaders(): HeadersInit {
  const secret = process.env.WORDPRESS_POSTMETA_REST_SECRET?.trim();
  const headers = getWordpressHeaders();
  if (!secret) {
    return headers;
  }

  if (headers instanceof Headers) {
    const postMetaHeaders = new Headers(headers);
    postMetaHeaders.set("x-otman-postmeta-secret", secret);
    return postMetaHeaders;
  }

  if (Array.isArray(headers)) {
    return [...headers, ["x-otman-postmeta-secret", secret]];
  }

  return {
    ...headers,
    "x-otman-postmeta-secret": secret,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function getWordpressPostStatus(order: WordpressOrderRecord): string {
  return asString(order.status)?.toLowerCase() ?? "";
}

function isTrashWordpressPost(order: WordpressOrderRecord): boolean {
  return getWordpressPostStatus(order) === "trash";
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/u.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return null;
}

function getFirstString(meta: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(meta[key]);
    if (value) return value;
  }

  return undefined;
}

function getFirstStringAllowEmpty(meta: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string") {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function decodeSerializedPhpString(value: string): unknown {
  const trimmed = value.trim();
  if (!/^(?:a|s|i|d|b|N):/u.test(trimmed)) {
    return value;
  }

  if (trimmed === "N;") {
    return null;
  }

  const stringMatch = trimmed.match(/^s:\d+:"([\s\S]*)";$/u);
  if (stringMatch) {
    return stringMatch[1] ?? "";
  }

  const integerMatch = trimmed.match(/^i:(-?\d+);$/u);
  if (integerMatch) {
    return Number.parseInt(integerMatch[1] ?? "0", 10);
  }

  const floatMatch = trimmed.match(/^d:(-?\d+(?:\.\d+)?);$/u);
  if (floatMatch) {
    return Number.parseFloat(floatMatch[1] ?? "0");
  }

  const booleanMatch = trimmed.match(/^b:([01]);$/u);
  if (booleanMatch) {
    return booleanMatch[1] === "1";
  }

  if (!trimmed.startsWith("a:")) {
    return value;
  }

  const entries: string[] = [];
  const regex = /s:\d+:"([\s\S]*?)";/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(trimmed)) !== null) {
    entries.push(match[1] ?? "");
  }

  return entries;
}

function normalizeMetaValue(value: unknown): unknown {
  if (typeof value === "string") {
    return decodeSerializedPhpString(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeMetaValue);
  }

  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      normalized[key] = normalizeMetaValue(entry);
    }
    return normalized;
  }

  return value;
}

function getStringValues(value: unknown): string[] {
  const normalized = normalizeMetaValue(value);
  if (Array.isArray(normalized)) {
    return normalized
      .map((entry) => asString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  const scalar = asString(normalized);
  return scalar ? [scalar] : [];
}

function normalizeDate(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/u.test(raw)) return raw;

  const compactIsoMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/u);
  if (compactIsoMatch) {
    return `${compactIsoMatch[1]}-${compactIsoMatch[2]}-${compactIsoMatch[3]}`;
  }

  const dottedMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/u);
  if (dottedMatch) {
    return `${dottedMatch[3]}-${dottedMatch[2]}-${dottedMatch[1]}`;
  }

  return raw;
}

function normalizeTimeWindow(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;

  const match = raw.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/u);
  return match ? `${match[1]}-${match[2]}` : raw;
}

function normalizeLift(value: unknown): string | undefined {
  const raw = asString(value)?.toLowerCase();
  if (!raw) return undefined;

  if (["1", "ja", "yes", "true", "y"].includes(raw)) return "yes";
  if (["0", "nei", "no", "false", "n"].includes(raw)) return "no";

  return undefined;
}

function normalizeStatus(value: unknown): string | undefined {
  const raw = asString(value)?.toLowerCase();
  if (!raw) return undefined;

  return STATUS_ALIASES[raw] ?? raw;
}

function parseDateTime(value: unknown): Date | undefined {
  const raw = asString(value);
  if (!raw) return undefined;

  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(raw) ? `${raw.replace(" ", "T")}Z` : raw;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function parseMoneyToCents(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsedEntry = parseMoneyToCents(entry);
      if (parsedEntry !== null) return parsedEntry;
    }

    return null;
  }

  if (isRecord(value)) {
    for (const key of ["value", "amount", "text"]) {
      const parsedEntry = parseMoneyToCents(value[key]);
      if (parsedEntry !== null) return parsedEntry;
    }

    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }

  const raw = asString(value);
  if (!raw) return null;

  const normalized = raw
    .replace(/\s+/gu, "")
    .replace(/NOK/giu, "")
    .replace(/[^\d,.-]/gu, "")
    .replace(",", ".");
  if (!normalized) return null;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function hasMetaValueContaining(meta: Record<string, unknown>, keyPattern: RegExp, code: string): boolean {
  const normalizedCode = code.toUpperCase();
  return Object.entries(meta).some(([key, value]) => {
    if (!keyPattern.test(key)) {
      return false;
    }

    return getStringValues(value).some((entry) => entry.toUpperCase().includes(normalizedCode));
  });
}

function isWordpressOrderPricesCard(card: Partial<HistoricalCardSnapshot>): boolean {
  return card.wordpressImportReadOnly?.productName === "WordPress order prices";
}

function shouldClearHistoricalReadOnlyMatch(meta: Record<string, unknown>): boolean {
  return (
    hasMetaValueContaining(meta, /_retur$/u, "RETURNSTORE") &&
    hasMetaValueContaining(meta, /_velg_leveringstype$/u, "INDOOR")
  );
}

function normalizeHistoricalProductCardsSnapshot(
  snapshot: Prisma.OrderUncheckedCreateInput["productCardsSnapshot"],
  meta: Record<string, unknown>,
): Prisma.OrderUncheckedCreateInput["productCardsSnapshot"] {
  if (!Array.isArray(snapshot)) {
    return snapshot;
  }

  const clearMatchedReadOnly = shouldClearHistoricalReadOnlyMatch(meta);
  const cards = (snapshot as Partial<HistoricalCardSnapshot>[])
    .filter((card) => !isWordpressOrderPricesCard(card))
    .map((card) => {
      if (
        !clearMatchedReadOnly ||
        !card.productId ||
        card.deliveryType !== "INDOOR" ||
        !card.selectedReturnOptionId
      ) {
        return card;
      }

      return {
        ...card,
        wordpressImportReadOnly: null,
      };
    });

  return cards.length > 0 ? (cards as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
}

function isReadOnlyImportedItem(item: { rawData?: unknown }): boolean {
  return isRecord(item.rawData) && item.rawData.readOnly === true;
}

function filterHistoricalImportedItems<T extends { productName?: string | null; rawData?: unknown }>(
  items: T[],
  meta: Record<string, unknown>,
): T[] {
  const clearMatchedReadOnly = shouldClearHistoricalReadOnlyMatch(meta);
  return items.filter((item) => {
    if (item.productName === "WordPress order prices") {
      return false;
    }

    return !clearMatchedReadOnly || !isReadOnlyImportedItem(item);
  });
}

function getTitleText(title: unknown): string | undefined {
  if (typeof title === "string") return stripHtml(title);
  if (isRecord(title)) return asString(title.rendered) ? stripHtml(asString(title.rendered) ?? "") : undefined;
  return undefined;
}

function normalizePostMetaRows(value: unknown): Record<string, unknown> {
  const rows = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.rows) ? value.rows : [];
  const meta: Record<string, unknown> = {};

  for (const row of rows) {
    if (!isRecord(row)) continue;

    const key = asString(row.meta_key) ?? asString(row.key);
    if (!key || key.startsWith("_")) continue;

    const rawValue = "meta_value" in row ? row.meta_value : row.value;
    meta[key] = normalizeMetaValue(rawValue);
  }

  return meta;
}

function mergeWordpressMeta(order: WordpressOrderRecord, postMetaRows: unknown): Record<string, unknown> {
  const acf = toRecord(order.acf);
  const meta = toRecord(order.meta);
  const embeddedPostMetaRows = Array.isArray(order.postmeta) ? order.postmeta : [];
  const rawPostMetaRows = Array.isArray(postMetaRows) && postMetaRows.length > 0 ? postMetaRows : embeddedPostMetaRows;
  const postMeta = normalizePostMetaRows(rawPostMetaRows);

  return {
    ...acf,
    ...meta,
    ...postMeta,
    [RAW_PAYLOAD_KEY]: order,
    [RAW_POSTMETA_KEY]: rawPostMetaRows,
    __importSource: IMPORT_SOURCE,
  };
}

function parseLegacyServiceValue(value: string): {
  priceCents: number | null;
  label: string;
  code: string | null;
} | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":").map((part) => stripHtml(part));
  if (parts.length >= 3) {
    const code = parts.slice(2).join(":").trim().toUpperCase();
    const label = parts[1]?.trim() ?? "";
    if (!label && !code) return null;

    return {
      priceCents: parseMoneyToCents(parts[0]),
      label: code === "RETURNREC" ? "Retur til gjenvinning" : label,
      code: code || null,
    };
  }

  const parenMatch = trimmed.match(/^(.*?)\s*\(([^)]+)\)\s*$/u);
  if (parenMatch) {
    const code = (parenMatch[2] ?? "").trim().toUpperCase();
    return {
      priceCents: null,
      label: code === "RETURNREC" ? "Retur til gjenvinning" : stripHtml(parenMatch[1] ?? ""),
      code: code || null,
    };
  }

  return {
    priceCents: parseMoneyToCents(trimmed),
    label: stripHtml(trimmed),
    code: null,
  };
}

function getHistoricalParsedProductEntries(meta: Record<string, unknown>): HistoricalParsedProductEntry[] {
  const entries: HistoricalParsedProductEntry[] = [];

  for (const [key, value] of Object.entries(meta)) {
    const match = key.match(/^(.*)_(\d+)_velg_produkt$/u);
    if (!match || key.startsWith("_")) continue;

    const productName = asString(value);
    if (!productName) continue;

    const prefix = match[1] ?? "";
    const index = Number.parseInt(match[2] ?? "0", 10);
    const quantity = Number.parseFloat(asString(meta[`${prefix}_${index}_antall_produkter`]) ?? "1");
    const deliveryType = getHistoricalDeliveryType(meta, prefix, index);

    entries.push({
      cardId: index + 1,
      metaPrefix: prefix,
      metaIndex: index,
      productName: stripHtml(productName),
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      deliveryType,
      rawData: {
        source: IMPORT_SOURCE,
        metaKey: key,
        metaPrefix: prefix,
        metaIndex: index,
        productName,
        deliveryType: deliveryType ?? null,
      },
    });
  }

  return entries.sort((left, right) => left.cardId - right.cardId).map((entry, index) => ({
    ...entry,
    cardId: index + 1,
  }));
}

function getHistoricalDeliveryType(meta: Record<string, unknown>, prefix: string, index: number): string | undefined {
  const deliveryKeys = [`${prefix}_${index}_velg_leveringstype`, `${prefix}_${index}_velg_leveringstype_andre`];
  for (const key of deliveryKeys) {
    for (const value of getStringValues(meta[key])) {
      const parsed = parseLegacyServiceValue(value);
      const deliveryType = parsed?.code ?? parsed?.label;
      if (deliveryType) return deliveryType;
    }
  }

  return undefined;
}

function getHistoricalParsedServiceItems(meta: Record<string, unknown>, productEntries: HistoricalParsedProductEntry[]): WordpressParsedService[] {
  const services: WordpressParsedService[] = [];

  for (const productEntry of productEntries) {
    for (const service of getServiceRowsForProduct({
      meta,
      cardId: productEntry.cardId,
      productName: productEntry.productName,
      quantity: productEntry.quantity,
      metaPrefix: productEntry.metaPrefix,
      metaIndex: productEntry.metaIndex,
    })) {
      services.push({
        cardId: service.cardId,
        productName: service.productName,
        quantity: service.quantity,
        itemType: service.itemType,
        label: service.optionLabel,
        code: service.optionCode ?? undefined,
        priceCents: service.customerPriceCents ?? undefined,
      });
    }
  }

  return services;
}

function toHistoricalOrderItemInput(item: BuiltOrderItem): Prisma.OrderItemCreateManyOrderInput {
  return {
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
    rawData: item.rawData ? (item.rawData as Prisma.InputJsonValue) : Prisma.JsonNull,
  };
}

function buildFallbackProductItem(item: WordpressParsedProduct): Prisma.OrderItemCreateManyOrderInput {
  return {
    cardId: item.cardId,
    productName: item.productName,
    deliveryType: item.deliveryType ?? null,
    itemType: "PRODUCT_CARD",
    quantity: item.quantity,
    rawData: {
      source: IMPORT_SOURCE,
      resolution: "unresolved_product",
    } as Prisma.InputJsonValue,
  };
}

function buildFallbackServiceItem(item: WordpressParsedService): Prisma.OrderItemCreateManyOrderInput {
  return {
    cardId: item.cardId,
    productName: item.productName,
    itemType: item.itemType,
    optionCode: item.code ?? null,
    optionLabel: item.label,
    quantity: item.quantity,
    customerPriceCents: item.priceCents ?? null,
    rawData: {
      source: IMPORT_SOURCE,
      resolution: "unresolved_service",
    } as Prisma.InputJsonValue,
  };
}

function getProductsSummaryFromParsedProducts(productEntries: WordpressParsedProduct[]): string | undefined {
  if (productEntries.length === 0) return undefined;

  return productEntries.map((item) => (item.quantity > 1 ? `${item.productName} x${item.quantity}` : item.productName)).join(", ");
}

function getDeliveryTypeSummaryFromParsedProducts(productEntries: WordpressParsedProduct[]): string | undefined {
  const deliveryTypes = productEntries.map((item) => item.deliveryType).filter((value): value is string => Boolean(value));
  return deliveryTypes.length > 0 ? deliveryTypes.join(", ") : undefined;
}

async function buildHistoricalMappedItems(meta: Record<string, unknown>, priceListId: string | null): Promise<HistoricalMappedItems> {
  const productEntries = getHistoricalParsedProductEntries(meta);
  const serviceItems = getHistoricalParsedServiceItems(meta, productEntries);
  if (productEntries.length === 0) {
    return {
      items: [],
      productCardsSnapshot: Prisma.JsonNull,
      productsSummary: undefined,
      deliveryTypeSummary: undefined,
      servicesSummary: buildServicesSummary(serviceItems.map((item) => ({
        cardId: item.cardId,
        productName: item.productName,
        itemType: item.itemType,
        optionCode: item.code ?? null,
        optionLabel: item.label,
        quantity: item.quantity,
        customerPriceCents: item.priceCents ?? null,
        rawData: { source: IMPORT_SOURCE },
      }))),
    };
  }

  const catalog = await getBookingCatalog(priceListId);
  const mappedImport = mapWordpressImportToProductCards({
    parsedProducts: productEntries.map((item) => ({
      cardId: item.cardId,
      productName: item.productName,
      quantity: item.quantity,
      deliveryType: item.deliveryType,
    })),
    parsedServices: serviceItems,
    catalogProducts: catalog.products,
    catalogSpecialOptions: catalog.specialOptions,
  });

  const nativeItems = buildOrderItemsFromCards(mappedImport.productCards, catalog.products, catalog.specialOptions).map(toHistoricalOrderItemInput);
  const fallbackItems = [
    ...mappedImport.unresolvedProducts.map(buildFallbackProductItem),
    ...mappedImport.unresolvedServices.map(buildFallbackServiceItem),
  ];

  return {
    items: [...nativeItems, ...fallbackItems],
    productCardsSnapshot: mappedImport.productCards.length > 0 ? (mappedImport.productCards as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    productsSummary: getProductsSummaryFromParsedProducts(productEntries),
    deliveryTypeSummary: getDeliveryTypeSummaryFromParsedProducts(productEntries),
    servicesSummary: buildServicesSummary(serviceItems.map((item) => ({
      cardId: item.cardId,
      productName: item.productName,
      itemType: item.itemType,
      optionCode: item.code ?? null,
      optionLabel: item.label,
      quantity: item.quantity,
      customerPriceCents: item.priceCents ?? null,
      rawData: { source: IMPORT_SOURCE },
    }))),
  };
}

function getServiceRowsForProduct(params: {
  meta: Record<string, unknown>;
  cardId: number;
  productName: string;
  quantity: number;
  metaPrefix: string;
  metaIndex: number;
}): ParsedServiceEntry[] {
  const services: ParsedServiceEntry[] = [];
  const serviceFields = [
    {
      key: `${params.metaPrefix}_${params.metaIndex}_retur`,
      itemType: "RETURN_OPTION" as const,
    },
  ];

  for (const field of serviceFields) {
    for (const value of getStringValues(params.meta[field.key])) {
      const parsed = parseLegacyServiceValue(value);
      if (!parsed || (!parsed.label && !parsed.code)) continue;

      services.push({
        cardId: params.cardId,
        productName: params.productName,
        itemType: field.itemType,
        optionCode: parsed.code,
        optionLabel: parsed.label || parsed.code || "",
        quantity: params.quantity,
        customerPriceCents: parsed.priceCents,
        rawData: {
          source: IMPORT_SOURCE,
          metaKey: field.key,
          value,
          code: parsed.code,
          label: parsed.label,
        },
      });
    }
  }

  return services;
}

function getProductsSummary(items: Prisma.OrderItemCreateManyOrderInput[]): string | undefined {
  const labels = items
    .map((item) => {
      const productName = item.productName?.trim();
      if (!productName) return null;
      const quantity = typeof item.quantity === "number" && item.quantity !== 1 ? ` x${item.quantity}` : "";
      return `${productName}${quantity}`;
    })
    .filter((value): value is string => value !== null);

  return labels.length > 0 ? labels.join(", ") : undefined;
}

function buildServicesSummary(serviceItems: ParsedServiceEntry[]): string | undefined {
  if (serviceItems.length === 0) return undefined;

  const counts = new Map<string, number>();
  for (const item of serviceItems) {
    counts.set(item.optionLabel, (counts.get(item.optionLabel) ?? 0) + item.quantity);
  }

  return Array.from(counts.entries(), ([label, quantity]) => (quantity > 1 ? `${label} x${quantity}` : label)).join(", ");
}

function buildFallbackItem(meta: Record<string, unknown>, priceCents: number | null): Prisma.OrderItemCreateManyOrderInput | null {
  const breakdownHtml = asString(meta.price_breakdown_html);
  if (!breakdownHtml && priceCents === null) return null;

  return {
    cardId: 1,
    productName: "WordPress historical order",
    itemType: "WORDPRESS_IMPORTED_TOTAL",
    quantity: 1,
    customerPriceCents: priceCents,
    rawData: {
      source: IMPORT_SOURCE,
      priceBreakdownHtml: breakdownHtml ?? null,
      note: "Fallback row for historical WordPress import",
    } as Prisma.InputJsonValue,
  };
}

function getCompletedAt(status: string, fallbackDate: Date | undefined): Date | undefined {
  return TERMINAL_STATUSES.has(status) ? fallbackDate : undefined;
}

function buildImportedRawMeta(meta: Record<string, unknown>): Prisma.InputJsonValue {
  return meta as Prisma.InputJsonValue;
}

async function resolveMembership(params: {
  companyId: string;
  legacyWordpressUserId: number | null;
}) {
  if (params.legacyWordpressUserId !== null) {
    const legacyMembership = await prisma.membership.findFirst({
      where: {
        companyId: params.companyId,
        legacyWordpressUserId: params.legacyWordpressUserId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        membershipPriceLists: {
          select: { priceListId: true },
        },
      },
    });

    if (legacyMembership) return legacyMembership;
  }

  const fallbackMembershipId = process.env.WORDPRESS_IMPORT_FALLBACK_MEMBERSHIP_ID?.trim();
  if (!fallbackMembershipId) return null;

  return prisma.membership.findFirst({
    where: {
      id: fallbackMembershipId,
      companyId: params.companyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      membershipPriceLists: {
        select: { priceListId: true },
      },
    },
  });
}

function getCompanyId(): string {
  const companyId = process.env.WORDPRESS_SYNC_COMPANY_ID?.trim() || process.env.WORDPRESS_IMPORT_COMPANY_ID?.trim();
  if (!companyId) {
    throw new Error("Missing WORDPRESS_SYNC_COMPANY_ID or WORDPRESS_IMPORT_COMPANY_ID");
  }

  return companyId;
}

async function fetchWordpressPostMetaRows(postId: number, debug: boolean): Promise<unknown[]> {
  const postMetaPath = getWordpressPostMetaRestPath();
  if (debug) {
    console.log("WordPress postmeta endpoint configuration", {
      configured: Boolean(postMetaPath),
      postmetaSecretConfigured: Boolean(process.env.WORDPRESS_POSTMETA_REST_SECRET?.trim()),
      path: postMetaPath,
      tablePrefix: process.env.WORDPRESS_DB_TABLE_PREFIX?.trim() || "21gLt_",
    });
  }

  if (!postMetaPath) {
    if (debug) {
      console.warn("WORDPRESS_POSTMETA_REST_PATH is not configured; postmeta-backed power_order imports cannot read real order fields.");
    }
    return [];
  }

  const params = new URLSearchParams({
    post_id: String(postId),
    table_prefix: process.env.WORDPRESS_DB_TABLE_PREFIX?.trim() || "21gLt_",
  });
  const path = postMetaPath.includes("{postId}") ? postMetaPath.replace("{postId}", encodeURIComponent(String(postId))) : postMetaPath;
  const url = buildWordpressUrl(path, postMetaPath.includes("{postId}") ? undefined : params);
  if (debug) {
    console.log("WordPress postmeta request", { url });
  }
  const result = await fetchJson(url, debug, getWordpressPostMetaHeaders());

  const rows = Array.isArray(result.value)
    ? result.value
    : isRecord(result.value) && Array.isArray(result.value.rows)
      ? result.value.rows
      : isRecord(result.value) && Array.isArray(result.value.postmeta)
        ? result.value.postmeta
        : null;

  if (rows) {
    if (debug) {
      console.log("WordPress postmeta rows returned", {
        postId,
        rowCount: rows.length,
      });
    }
    return rows;
  }

  throw new Error("WordPress postmeta endpoint returned a non-array response");
}

async function parseWordpressOrder(order: WordpressOrderRecord, debug: boolean): Promise<ParsedWordpressOrder> {
  const legacyWordpressOrderId = asInteger(order.id);
  if (legacyWordpressOrderId === null) {
    throw new Error("WordPress order is missing numeric id");
  }

  const legacyWordpressUserId = asInteger(order.author);
  if (legacyWordpressUserId === null) {
    throw new Error("WordPress order is missing numeric author; original sync requires legacyWordpressUserId");
  }

  const postMetaRows = await fetchWordpressPostMetaRows(legacyWordpressOrderId, debug);
  if (isPostMetaExpected() && postMetaRows.length === 0 && !Array.isArray(order.postmeta)) {
    throw new Error(
      `WordPress postmeta rows are required for post_id ${legacyWordpressOrderId}. Configure WORDPRESS_POSTMETA_REST_PATH or return embedded postmeta rows from the order endpoint.`,
    );
  }
  const meta = mergeWordpressMeta(order, postMetaRows);
  const syncMeta = {
    ...meta,
    leveringsdato: getFirstString(meta, ["leveringsdato", "delivery_date"]) ?? normalizeDate(meta.leveringsdato_sortable),
  };
  const syncPayload: WordpressOrderSyncPayload = {
    legacyWordpressOrderId,
    legacyWordpressUserId,
    createdAt: asString(meta.order_created_at) ?? asString(order.date_gmt) ?? asString(order.date) ?? null,
    modifiedAt: asString(order.modified_gmt) ?? asString(order.modified) ?? null,
    status: asString(order.status) ?? null,
    title: getTitleText(order.title) ?? null,
    meta: syncMeta,
  };
  return {
    legacyWordpressOrderId,
    legacyWordpressUserId,
    payload: syncPayload,
  };
}

async function postToOriginalWordpressSync(payload: WordpressOrderSyncPayload): Promise<void> {
  const secret = process.env.WORDPRESS_SYNC_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing WORDPRESS_SYNC_SECRET; historical fetch import posts into the original sync route");
  }

  const request = new NextRequest("http://localhost/api/integrations/wordpress/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-wp-sync-secret": secret,
    },
    body: JSON.stringify(payload),
  });
  const response = await syncWordpressOrder(request);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Original WordPress sync failed for order ${payload.legacyWordpressOrderId}: ${response.status} ${body}`);
  }
}

/*
  const createdAt = syncCore.orderData.createdAt instanceof Date ? syncCore.orderData.createdAt : undefined;
  const updatedAt = syncCore.orderData.updatedAt instanceof Date ? syncCore.orderData.updatedAt : createdAt;
  const status = typeof syncCore.orderData.status === "string" ? syncCore.orderData.status : "processing";
  const historicalProductCardsSnapshot = normalizeHistoricalProductCardsSnapshot(
    syncCore.orderData.productCardsSnapshot,
    meta,
  );
  const historicalImportedItems = filterHistoricalImportedItems(syncCore.importedItems, meta);
  const mappedItems = {
    items: historicalImportedItems,
    productsSummary: syncCore.orderData.productsSummary,
    deliveryTypeSummary: syncCore.orderData.deliveryTypeSummary,
    servicesSummary: syncCore.orderData.servicesSummary,
    productCardsSnapshot: historicalProductCardsSnapshot,
  };
  const fallbackItem = buildFallbackItem(meta, priceCents);
  const items = historicalImportedItems.length > 0 ? historicalImportedItems : fallbackItem ? [fallbackItem] : [];
  const extraPickups = normalizeWordpressExtraPickups(meta);
  const description = getFirstStringAllowEmpty(meta, ["beskrivelse", "description"]) ?? getTitleText(order.title);

  const data: Prisma.OrderUncheckedCreateInput = {
    companyId,
    createdByMembershipId: membership.id,
    customerMembershipId: membership.id,
    priceListId: membership.membershipPriceLists[0]?.priceListId ?? null,
    legacyWordpressOrderId,
    legacyWordpressAuthorId: legacyWordpressUserId,
    legacyWordpressRawMeta: buildImportedRawMeta(meta),
    createdAt,
    updatedAt,
    displayId: legacyWordpressOrderId,
    status,
    completedAt: getCompletedAt(status, updatedAt ?? createdAt),
    dontSendEmail: true,
    description,
    pickupAddress: getFirstString(meta, ["pickup_address", "henteadresse"]),
    deliveryAddress: getFirstString(meta, ["delivery_address", "leveringsadresse"]),
    returnAddress: getFirstString(meta, ["returadresse", "return_address"]),
    customerName: getFirstString(meta, ["kundens_navn", "customer_name"]),
    customerLabel: getFirstString(meta, ["kundens_navn", "customer_name"]) ?? getFirstString(meta, ["bestillingsnr", "order_number"]),
    phone: getFirstString(meta, ["telefon_full", "telefon", "phone"]),
    phoneTwo: getFirstString(meta, ["ekstra_kundens_telefon", "additional_customer_phone", "phone_two"]),
    email: getFirstString(meta, ["e-postadresse", "epostadresse", "email", "customer_email"]),
    customerComments: getFirstString(meta, ["contact_notes", "customer_comments", "kunde_kommentar"]),
    floorNo: getFirstString(meta, ["etasje_nr", "floor_no", "floor"]),
    lift: normalizeLift(getFirstString(meta, ["heis", "lift"])),
    subcontractor: getFirstString(meta, ["subcontractor", "underleverandor", "underleverandør"]),
    drivingDistance: getFirstString(meta, ["total_km", "driving_distance"]),
    cashierName: getFirstString(meta, ["kasserers_navn", "cashier_name"]),
    cashierPhone: getFirstString(meta, ["kasserers_telefon_full", "kasserers_telefon", "cashier_phone"]),
    deliveryDate: normalizeDate(getFirstString(meta, ["leveringsdato_sortable", "leveringsdato", "delivery_date"])),
    timeWindow: normalizeTimeWindow(getFirstString(meta, ["tidsvindu_for_levering", "delivery_time_window", "time_window"])),
    orderNumber: getFirstString(meta, ["bestillingsnr", "order_number"]) ?? String(legacyWordpressOrderId),
    productsSummary: mappedItems.productsSummary ?? getProductsSummary(items),
    deliveryTypeSummary: mappedItems.deliveryTypeSummary,
    servicesSummary: mappedItems.servicesSummary ?? getFirstString(meta, ["services_summary"]),
    extraPickupAddress: extraPickups.addresses,
    extraPickupContacts: extraPickups.contacts.length > 0 ? (extraPickups.contacts as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    expressDelivery: getWordpressExpressDelivery(meta),
    priceExVat: priceCents === null ? 0 : Math.round(priceCents / 100),
    priceSubcontractor: Math.round((parseMoneyToCents(meta.subcontractor_total_price) ?? 0) / 100),
    productCardsSnapshot: mappedItems.productCardsSnapshot,
  };
  Object.assign(data, syncCore.orderData, {
    displayId: legacyWordpressOrderId,
    dontSendEmail: true,
    productCardsSnapshot: historicalProductCardsSnapshot,
  });
  const historicalSubcontractorPriceCents = parseMoneyToCents(meta.subcontractor_total_price);
  if (historicalSubcontractorPriceCents !== null) {
    data.priceSubcontractor = Math.round(historicalSubcontractorPriceCents / 100);
  }

  return {
    legacyWordpressOrderId,
    legacyWordpressUserId,
    createdAt,
    updatedAt,
    data,
    items,
    wordpressPriceExVatCents: priceCents,
  };
}

*/

export async function upsertHistoricalWordpressOrder(params: {
  order: WordpressOrderRecord;
  mode: WordpressImportMode;
  debug?: boolean;
}): Promise<"imported" | "skipped"> {
  const parsed = await parseWordpressOrder(params.order, params.debug ?? false);

  if (params.mode === "dry-run") {
    console.log("Dry-run: would import WordPress order", {
      legacyWordpressOrderId: parsed.legacyWordpressOrderId,
      legacyWordpressUserId: parsed.legacyWordpressUserId,
    });
    return "imported";
  }

  await postToOriginalWordpressSync(parsed.payload);

  return "imported";
}

function buildWordpressUrl(pathname: string, params?: URLSearchParams): string {
  const url = new URL(`${getWordpressBaseUrl()}${pathname}`);
  if (params) {
    for (const [key, value] of params) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function fetchJson(url: string, debug: boolean, headers: HeadersInit = getWordpressHeaders()): Promise<{ value: unknown; headers: Headers }> {
  if (debug) {
    console.log("WordPress REST request", { url });
  }

  const response = await fetch(url, {
    headers,
  });

  if (debug) {
    console.log("WordPress REST response", {
      url,
      status: response.status,
      statusText: response.statusText,
    });
  }

  if (!response.ok) {
    const help = getWordpressEndpointHelp(response.status);
    throw new WordpressRestError(
      `WordPress REST request failed: ${response.status} ${response.statusText}${help ? ` ${help}` : ""}`,
      response.status,
      response.statusText,
    );
  }

  return {
    value: await response.json(),
    headers: response.headers,
  };
}

export async function fetchWordpressOrdersPage(page: number, debug = false): Promise<WordpressOrderListPage> {
  const params = new URLSearchParams({
    per_page: String(DEFAULT_PER_PAGE),
    page: String(page),
  });
  const result = await fetchJson(buildWordpressUrl(getWordpressOrderRestPath(), params), debug);

  if (!Array.isArray(result.value)) {
    throw new Error("WordPress orders page returned a non-array response");
  }

  return {
    orders: result.value.filter(isRecord) as WordpressOrderRecord[],
    totalPages: asInteger(result.headers.get("x-wp-totalpages")),
    totalCount: asInteger(result.headers.get("x-wp-total")),
  };
}

export async function fetchWordpressOrderById(orderId: number, debug = false): Promise<WordpressOrderRecord> {
  const result = await fetchJson(buildWordpressUrl(`${getWordpressOrderRestPath()}/${orderId}`), debug);
  if (!isRecord(result.value)) {
    throw new Error("WordPress order returned a non-object response");
  }

  return result.value as WordpressOrderRecord;
}

async function findWordpressOrderShellInPages(orderId: number, debug = false): Promise<WordpressOrderRecord> {
  let page = 1;
  let totalPages: number | null = null;

  while (true) {
    if (totalPages !== null && page > totalPages) {
      break;
    }

    const result = await fetchWordpressOrdersPage(page, debug);
    totalPages = result.totalPages ?? totalPages;

    const match = result.orders.find((order) => asInteger(order.id) === orderId);
    if (match) {
      if (debug) {
        console.log("Using WordPress shell post from collection page after direct fetch failed", {
          orderId,
          page,
        });
      }
      return match;
    }

    if (result.orders.length === 0) {
      break;
    }

    page += 1;
  }

  throw new Error(`WordPress order ${orderId} was not found in collection pages after direct fetch failed`);
}

export async function fetchWordpressOrderForImport(orderId: number, debug = false): Promise<WordpressOrderRecord> {
  try {
    return await fetchWordpressOrderById(orderId, debug);
  } catch (error) {
    if (error instanceof WordpressRestError && (error.status === 401 || error.status === 403)) {
      if (debug) {
        console.warn("Direct WordPress order fetch was unauthorized; falling back to collection shell post plus postmeta", {
          orderId,
          status: error.status,
        });
      }
      return findWordpressOrderShellInPages(orderId, debug);
    }

    throw error;
  }
}

export async function fetchWordpressTotalOrderCount(debug = false): Promise<number | null> {
  const params = new URLSearchParams({
    per_page: "1",
    page: "1",
  });
  const result = await fetchJson(buildWordpressUrl(getWordpressOrderRestPath(), params), debug);

  return asInteger(result.headers.get("x-wp-total"));
}

export function parseWordpressImportCliArgs(argv: string[]): WordpressImportOptions {
  let mode: WordpressImportMode = "dry-run";
  let fromPage = 1;
  let limitPages: number | null = null;
  let orderId: number | null = null;
  let debug = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--apply") {
      mode = "apply";
      continue;
    }

    if (arg === "--dry-run") {
      mode = "dry-run";
      continue;
    }

    if (arg === "--debug") {
      debug = true;
      continue;
    }

    if (arg === "--from-page" && next) {
      fromPage = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    if (arg === "--limit-pages" && next) {
      limitPages = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    if (arg === "--order-id" && next) {
      orderId = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  if (!Number.isInteger(fromPage) || fromPage < 1) {
    throw new Error("--from-page must be a positive integer");
  }

  if (limitPages !== null && (!Number.isInteger(limitPages) || limitPages < 1)) {
    throw new Error("--limit-pages must be a positive integer");
  }

  if (orderId !== null && (!Number.isInteger(orderId) || orderId < 1)) {
    throw new Error("--order-id must be a positive integer");
  }

  return {
    mode,
    fromPage,
    limitPages,
    orderId,
    debug,
  };
}

export async function runWordpressOrderImport(options: WordpressImportOptions): Promise<WordpressImportSummary> {
  const summary: WordpressImportSummary = {
    imported: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };
  const fetchedPageIds: number[] = [];

  const importOne = async (order: WordpressOrderRecord) => {
    const legacyWordpressOrderId = asInteger(order.id);
    try {
      const result = await upsertHistoricalWordpressOrder({
        order,
        mode: options.mode,
        debug: options.debug,
      });

      if (result === "imported") {
        summary.imported += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.failures.push({
        legacyWordpressOrderId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  };

  if (options.orderId !== null) {
    await importOne(await fetchWordpressOrderForImport(options.orderId, options.debug));
    return summary;
  }

  let page = options.fromPage;
  let processedPages = 0;
  let totalPages: number | null = null;

  while (true) {
    if (options.limitPages !== null && processedPages >= options.limitPages) {
      break;
    }

    if (totalPages !== null && page > totalPages) {
      break;
    }

    const result = await fetchWordpressOrdersPage(page, options.debug);
    totalPages = result.totalPages ?? totalPages;

    if (result.orders.length === 0) {
      break;
    }

    console.log("Fetched WordPress orders page", {
      page,
      totalPages,
      count: result.orders.length,
      ids: result.orders.map((order) => asInteger(order.id)),
      mode: options.mode,
    });

    const importableOrders = result.orders.filter((order) => !isTrashWordpressPost(order));
    const trashIds = result.orders
      .filter(isTrashWordpressPost)
      .map((order) => asInteger(order.id))
      .filter((id): id is number => id !== null);

    if (trashIds.length > 0) {
      summary.skipped += trashIds.length;
      console.log("Skipping trashed WordPress posts on page", {
        page,
        trashIds,
      });
    }

    const pageIds = importableOrders
      .map((order) => asInteger(order.id))
      .filter((id): id is number => id !== null);
    fetchedPageIds.push(...pageIds);

    for (const order of importableOrders) {
      await importOne(order);
    }

    const pageFailedIds = summary.failures
      .filter((failure) => importableOrders.some((order) => asInteger(order.id) === failure.legacyWordpressOrderId))
      .map((failure) => failure.legacyWordpressOrderId);
    if (pageFailedIds.length > 0) {
      console.error("WordPress import page completed with failed IDs", {
        page,
        failedIds: pageFailedIds,
      });
      break;
    }

    processedPages += 1;
    page += 1;
  }

  if (options.mode === "apply" && fetchedPageIds.length > 0) {
    const companyId = getCompanyId();
    const expectedIds = [...new Set(fetchedPageIds)].toSorted((a, b) => b - a);
    const dbIds = (
      await prisma.order.findMany({
        where: {
          companyId,
          legacyWordpressOrderId: {
            in: expectedIds,
          },
        },
        select: {
          legacyWordpressOrderId: true,
        },
      })
    )
      .map((order) => order.legacyWordpressOrderId)
      .filter((id): id is number => id !== null)
      .toSorted((a, b) => b - a);
    const expectedSet = new Set(expectedIds);
    const dbSet = new Set(dbIds);
    const missingIds = expectedIds.filter((id) => !dbSet.has(id));
    const extraIds = dbIds.filter((id) => !expectedSet.has(id));

    console.log("WordPress page import verification", {
      fetchedPageIds: expectedIds,
      dbIds,
      missingIds,
      extraIds,
    });

    if (missingIds.length > 0 || extraIds.length > 0) {
      console.error("WordPress page import verification failed", {
        expectedCount: expectedIds.length,
        dbCount: dbIds.length,
        fetchedPageIds: expectedIds,
        dbIds,
        missingIds,
        extraIds,
      });
      summary.failed += 1;
      summary.failures.push({
        legacyWordpressOrderId: null,
        reason: `Page import verification failed. Missing IDs: ${missingIds.join(", ") || "none"}. Extra IDs: ${extraIds.join(", ") || "none"}.`,
      });
    } else {
      console.log("WordPress page import verification passed", {
        expectedCount: expectedIds.length,
        dbCount: dbIds.length,
      });
    }
  }

  return summary;
}

function getFilenameFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").filter(Boolean).at(-1);
    return filename ? decodeURIComponent(filename) : undefined;
  } catch {
    const filename = url.split("?")[0]?.split("/").filter(Boolean).at(-1);
    return filename ? decodeURIComponent(filename) : undefined;
  }
}

function inferMimeType(filename: string, url: string): string | null {
  const candidate = `${filename} ${url}`.toLowerCase();

  if (candidate.includes(".pdf")) return "application/pdf";
  if (candidate.includes(".png")) return "image/png";
  if (candidate.includes(".jpg") || candidate.includes(".jpeg")) return "image/jpeg";
  if (candidate.includes(".webp")) return "image/webp";
  if (candidate.includes(".gif")) return "image/gif";

  return null;
}

function collectAttachmentIds(value: unknown): number[] {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectAttachmentIds);
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap(collectAttachmentIds);
  }

  const raw = asString(value);
  if (!raw) return [];

  if (/^\d+$/u.test(raw)) {
    return [Number.parseInt(raw, 10)];
  }

  const ids: number[] = [];
  const serializedIntegerPairs = raw.matchAll(/i:\d+;i:(\d+);/gu);
  for (const match of serializedIntegerPairs) {
    const id = Number.parseInt(match[1] ?? "", 10);
    if (Number.isInteger(id) && id > 0) {
      ids.push(id);
    }
  }

  return ids;
}

function collectVedleggAttachmentIds(order: WordpressOrderRecord): number[] {
  const ids = new Set<number>();
  const candidates = [
    toRecord(order.meta).vedlegg,
    toRecord(order.acf).vedlegg,
    toRecord(order).vedlegg,
  ];

  for (const postMetaRow of Array.isArray(order.postmeta) ? order.postmeta : []) {
    if (!isRecord(postMetaRow)) continue;
    const key = asString(postMetaRow.meta_key) ?? asString(postMetaRow.key);
    if (key !== "vedlegg") continue;

    candidates.push(
      "meta_value" in postMetaRow ? postMetaRow.meta_value : postMetaRow.value,
    );
  }

  for (const candidate of candidates) {
    for (const id of collectAttachmentIds(candidate)) {
      ids.add(id);
    }
  }

  return Array.from(ids);
}

async function fetchWordpressMediaAttachmentCandidate(
  mediaId: number,
  debug = false,
): Promise<WordpressAttachmentCandidate | null> {
  const result = await fetchJson(
    buildWordpressUrl(`/wp-json/wp/v2/media/${mediaId}`),
    debug,
  ).catch((error: unknown) => {
    if (debug) {
      console.warn("WordPress media attachment fetch failed", {
        mediaId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  });

  if (!result || !isRecord(result.value)) {
    if (debug) {
      console.warn("WordPress media attachment returned no object", {
        mediaId,
      });
    }
    return null;
  }

  const media = result.value;
  const sourceUrl =
    asString(media.source_url) ??
    asString(toRecord(media.guid).rendered) ??
    asString(media.guid);

  if (!sourceUrl || !/^https?:\/\//iu.test(sourceUrl)) {
    if (debug) {
      console.warn("WordPress media attachment missing source URL", {
        mediaId,
      });
    }
    return null;
  }

  const title = asString(toRecord(media.title).rendered);
  const filename =
    getFilenameFromUrl(sourceUrl) ??
    title ??
    `wordpress-attachment-${mediaId}`;
  const mimeType =
    asString(media.mime_type) ??
    inferMimeType(filename, sourceUrl) ??
    "application/octet-stream";
  const sizeBytes = asInteger(toRecord(media.media_details).filesize);

  return {
    legacyWordpressAttachmentId: mediaId,
    filename,
    mimeType,
    sizeBytes,
    sourceUrl,
    category: "ATTACHMENT",
  };
}

function collectAttachmentRecords(value: unknown, output: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectAttachmentRecords(entry, output);
    return;
  }

  if (!isRecord(value)) return;

  const url = asString(value.url) ?? asString(value.sourceUrl) ?? asString(value.file) ?? asString(value.guid);
  if (url) {
    output.push(value);
  }

  for (const nestedValue of Object.values(value)) {
    if (Array.isArray(nestedValue)) {
      collectAttachmentRecords(nestedValue, output);
    }
  }
}

function isGsmPodAttachmentRecord(record: Record<string, unknown>): boolean {
  const source = asString(record.source)?.toUpperCase();
  const gsmTaskId = asString(record.gsmTaskId) ?? asString(record.gsm_task_id);
  const gsmDocumentId =
    asString(record.gsmDocumentId) ?? asString(record.gsm_document_id);

  return (
    source === "GSM" ||
    Boolean(gsmTaskId) ||
    Boolean(gsmDocumentId?.startsWith("pod:"))
  );
}

export function extractWordpressAttachmentCandidates(order: WordpressOrderRecord): WordpressAttachmentCandidate[] {
  const records: Record<string, unknown>[] = [];
  collectAttachmentRecords(order.attachments, records);
  collectAttachmentRecords(toRecord(order.meta).attachments, records);
  collectAttachmentRecords(toRecord(order.acf).attachments, records);
  collectAttachmentRecords(toRecord(order.meta).files, records);
  collectAttachmentRecords(toRecord(order.acf).files, records);

  const byLegacyId = new Map<number, WordpressAttachmentCandidate>();

  for (const record of records) {
    if (isGsmPodAttachmentRecord(record)) continue;

    const sourceUrl = asString(record.url) ?? asString(record.sourceUrl) ?? asString(record.file) ?? asString(record.guid);
    if (!sourceUrl || !/^https?:\/\//iu.test(sourceUrl)) continue;

    const rawId = asInteger(record.legacyAttachmentId) ?? asInteger(record.id) ?? asInteger(record.ID);
    if (rawId === null || byLegacyId.has(rawId)) continue;

    const filename = asString(record.filename) ?? asString(record.file_name) ?? asString(record.name) ?? getFilenameFromUrl(sourceUrl) ?? `wordpress-attachment-${rawId}`;
    const mimeType = asString(record.mimeType) ?? asString(record.mime_type) ?? asString(record.type) ?? inferMimeType(filename, sourceUrl);
    const sizeBytes = asInteger(record.sizeBytes) ?? asInteger(record.filesize) ?? asInteger(record.size);

    byLegacyId.set(rawId, {
      legacyWordpressAttachmentId: rawId,
      filename,
      mimeType,
      sizeBytes,
      sourceUrl,
      category: normalizeAttachmentCategory(asString(record.category)),
    });
  }

  return Array.from(byLegacyId.values());
}

async function resolveWordpressAttachmentCandidates(
  order: WordpressOrderRecord,
  debug = false,
): Promise<WordpressAttachmentCandidate[]> {
  const byLegacyId = new Map<number, WordpressAttachmentCandidate>();

  for (const candidate of extractWordpressAttachmentCandidates(order)) {
    byLegacyId.set(candidate.legacyWordpressAttachmentId, candidate);
  }

  const vedleggIds = collectVedleggAttachmentIds(order);
  if (debug) {
    console.log("WordPress vedlegg attachment IDs", {
      orderId: asInteger(order.id),
      vedleggIds,
    });
  }

  for (const mediaId of vedleggIds) {
    if (byLegacyId.has(mediaId)) continue;

    const candidate = await fetchWordpressMediaAttachmentCandidate(
      mediaId,
      debug,
    );
    if (candidate && !isGsmPodAttachmentRecord(candidate)) {
      byLegacyId.set(mediaId, candidate);
    }
  }

  return Array.from(byLegacyId.values());
}

async function downloadAttachment(candidate: WordpressAttachmentCandidate): Promise<{
  bytes: Buffer;
  mimeType: string | null;
  sizeBytes: number;
}> {
  const response = await fetch(candidate.sourceUrl, {
    headers: {
      Accept: candidate.mimeType ?? "*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Attachment download failed: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length <= 0) {
    throw new Error("Attachment response was empty");
  }

  return {
    bytes,
    mimeType: response.headers.get("content-type")?.split(";")[0]?.trim() || candidate.mimeType,
    sizeBytes: bytes.length,
  };
}

export async function importWordpressOrderAttachments(params: {
  order: WordpressOrderRecord;
  mode: WordpressImportMode;
  debug?: boolean;
}): Promise<WordpressAttachmentImportSummary> {
  const summary: WordpressAttachmentImportSummary = {
    imported: 0,
    skipped: 0,
    failed: 0,
    uploaded: 0,
    failures: [],
  };

  const legacyWordpressOrderId = asInteger(params.order.id);
  if (legacyWordpressOrderId === null) {
    summary.failed = 1;
    summary.failures.push({ legacyWordpressOrderId: null, reason: "WordPress order is missing numeric id" });
    return summary;
  }

  const order = await prisma.order.findUnique({
    where: {
      legacyWordpressOrderId,
    },
    select: {
      id: true,
    },
  });

  if (!order) {
    summary.skipped = 1;
    return summary;
  }

  const postMetaRows = await fetchWordpressPostMetaRows(
    legacyWordpressOrderId,
    params.debug ?? false,
  );
  const orderWithPostMeta: WordpressOrderRecord = {
    ...params.order,
    meta: {
      ...toRecord(params.order.meta),
      ...mergeWordpressMeta(params.order, postMetaRows),
    },
    postmeta: postMetaRows,
  };
  const candidates = await resolveWordpressAttachmentCandidates(
    orderWithPostMeta,
    params.debug ?? false,
  );
  if (params.debug) {
    console.log("WordPress attachment candidates", {
      legacyWordpressOrderId,
      count: candidates.length,
      candidates: candidates.map((candidate) => ({
        legacyWordpressAttachmentId: candidate.legacyWordpressAttachmentId,
        filename: candidate.filename,
        mimeType: candidate.mimeType,
        sourceUrl: candidate.sourceUrl,
      })),
    });
  }
  if (candidates.length === 0) {
    summary.skipped = 1;
    return summary;
  }

  if (params.mode === "apply" && !isS3AttachmentStorageConfigured()) {
    throw new Error("S3 attachment storage is not configured");
  }

  for (const candidate of candidates) {
    try {
      const existing = await prisma.orderAttachment.findUnique({
        where: {
          orderId_legacyWordpressAttachmentId: {
            orderId: order.id,
            legacyWordpressAttachmentId: candidate.legacyWordpressAttachmentId,
          },
        },
        select: {
          id: true,
          storagePath: true,
        },
      });

      if (params.mode === "dry-run") {
        console.log("Dry-run: would import WordPress order attachment", {
          legacyWordpressOrderId,
          legacyWordpressAttachmentId: candidate.legacyWordpressAttachmentId,
          sourceUrl: candidate.sourceUrl,
          existingAttachmentId: existing?.id ?? null,
        });
        summary.imported += 1;
        continue;
      }

      const downloaded = await downloadAttachment(candidate);
      const stored = await uploadAttachmentBufferToS3({
        bytes: downloaded.bytes,
        scope: order.id,
        filename: candidate.filename,
        contentType: downloaded.mimeType ?? "application/octet-stream",
      });

      const data = {
        filename: candidate.filename,
        mimeType: downloaded.mimeType,
        sizeBytes: downloaded.sizeBytes,
        storagePath: stored.storagePath,
        sourceUrl: candidate.sourceUrl,
        source: IMPORT_SOURCE,
        category: candidate.category,
      };

      if (existing) {
        await prisma.orderAttachment.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.orderAttachment.create({
          data: {
            orderId: order.id,
            legacyWordpressAttachmentId: candidate.legacyWordpressAttachmentId,
            ...data,
          },
        });
      }

      summary.imported += 1;
      summary.uploaded += 1;
    } catch (error) {
      summary.failed += 1;
      summary.failures.push({
        legacyWordpressOrderId,
        reason: `Attachment ${candidate.legacyWordpressAttachmentId}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return summary;
}

export async function runWordpressAttachmentImport(options: WordpressImportOptions): Promise<WordpressAttachmentImportSummary> {
  const summary: WordpressAttachmentImportSummary = {
    imported: 0,
    skipped: 0,
    failed: 0,
    uploaded: 0,
    failures: [],
  };

  const merge = (next: WordpressAttachmentImportSummary) => {
    summary.imported += next.imported;
    summary.skipped += next.skipped;
    summary.failed += next.failed;
    summary.uploaded += next.uploaded;
    summary.failures.push(...next.failures);
  };

  if (options.orderId !== null) {
    merge(await importWordpressOrderAttachments({
      order: await fetchWordpressOrderForImport(options.orderId, options.debug),
      mode: options.mode,
      debug: options.debug,
    }));
    return summary;
  }

  let page = options.fromPage;
  let processedPages = 0;
  let totalPages: number | null = null;

  while (true) {
    if (options.limitPages !== null && processedPages >= options.limitPages) break;
    if (totalPages !== null && page > totalPages) break;

    const result = await fetchWordpressOrdersPage(page, options.debug);
    totalPages = result.totalPages ?? totalPages;
    if (result.orders.length === 0) break;

    for (const order of result.orders) {
      merge(await importWordpressOrderAttachments({
        order,
        mode: options.mode,
        debug: options.debug,
      }));
    }

    processedPages += 1;
    page += 1;
  }

  return summary;
}

export async function verifyWordpressOrderImport(): Promise<{
  wordpressTotal: number | null;
  importedTotal: number;
  spotChecks: Array<{
    legacyWordpressOrderId: number;
    dbPriceExVat: number;
    wordpressPriceExVat: number | null;
    matches: boolean | null;
  }>;
}> {
  const companyId = getCompanyId();
  const wordpressTotal = await fetchWordpressTotalOrderCount();
  const importedTotal = await prisma.order.count({
    where: {
      companyId,
      legacyWordpressOrderId: {
        not: null,
      },
    },
  });

  const importedOrders = await prisma.order.findMany({
    where: {
      companyId,
      legacyWordpressOrderId: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
    select: {
      legacyWordpressOrderId: true,
      priceExVat: true,
      legacyWordpressRawMeta: true,
    },
  });

  const spotChecks = importedOrders
    .filter((order): order is typeof order & { legacyWordpressOrderId: number } => order.legacyWordpressOrderId !== null)
    .map((order) => {
      const meta = toRecord(order.legacyWordpressRawMeta);
      const wordpressPriceCents = parseMoneyToCents(meta.total_price);
      const dbPriceCents = order.priceExVat * 100;

      return {
        legacyWordpressOrderId: order.legacyWordpressOrderId,
        dbPriceExVat: order.priceExVat,
        wordpressPriceExVat: wordpressPriceCents === null ? null : Math.round(wordpressPriceCents / 100),
        matches: wordpressPriceCents === null ? null : dbPriceCents === wordpressPriceCents,
      };
    });

  return {
    wordpressTotal,
    importedTotal,
    spotChecks,
  };
}

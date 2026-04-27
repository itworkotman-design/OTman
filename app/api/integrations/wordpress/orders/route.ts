// path: app/api/integrations/wordpress/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getBookingCatalog } from "@/lib/booking/catalog/getBookingCatalog";
import { buildProductBreakdowns } from "@/lib/booking/pricing/fromProductCards";
import { buildPriceLookup } from "@/lib/booking/pricing/priceLookup";
import { calculateBookingPricing } from "@/lib/booking/pricing/engine";
import { ADD_TO_ORDER_FEE_CODE, calculateExtraWorkFee, EXTRA_WORK_FEE_CODE } from "@/lib/booking/pricing/hardcodedFees";
import { getDeviationFeeOption, normalizeDeviationLabel } from "@/lib/booking/pricing/deviationFees";
import { buildOrderItemsFromCards, type BuiltOrderItem } from "@/lib/orders/buildOrderItemsFromCards";
import { safeInteger } from "@/lib/orders/normalizeOrderInput";
import { mapWordpressImportToProductCards, type ResolvedWordpressService } from "@/lib/integrations/wordpress/catalogMapping";
import { buildWordpressExtraPickupContacts, getWordpressExpressDelivery, getWordpressExtraPickupAddresses } from "@/lib/integrations/wordpress/orderMeta";
import { OPTION_CODES } from "@/lib/booking/constants";
import { getProductDeliveryTypeLabel } from "@/lib/products/deliveryTypes";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { createEmptyProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";

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
  metaPrefix: string;
  metaIndex: number;
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
  priceCents?: number;
  rawData: Prisma.InputJsonValue;
};

type ParsedBreakdownRow = {
  label: string;
  code?: string;
  quantity?: number;
  priceCents?: number;
};

type ParsedBreakdownGroup = {
  groupLabel: string;
  rows: ParsedBreakdownRow[];
};

type ImportedWordpressAdjustments = {
  rabatt?: string;
  leggTil?: string;
  subcontractorMinus?: string;
  subcontractorPlus?: string;
};

type ImportedWordpressFees = {
  feeExtraWork: boolean;
  extraWorkMinutes: number;
  feeAddToOrder: boolean;
};

const WORDPRESS_DEFAULT_TIME_HOURS = 0.5;
const getImportedProductQuantity = (item: ParsedWordpressProductItem, catalogProducts: Awaited<ReturnType<typeof getBookingCatalog>>["products"]): number => {
  const exactMatches = catalogProducts.filter((candidate) => candidate.label.toLowerCase() === item.productName.toLowerCase());
  const product =
    item.deliveryType && exactMatches.length > 0 ? (exactMatches.find((candidate) => candidate.allowDeliveryTypes) ?? exactMatches[0]) : exactMatches[0];

  if (product?.allowHoursInput && item.quantity === 1) {
    return WORDPRESS_DEFAULT_TIME_HOURS;
  }

  return item.quantity;
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
  "PALLS1",
  "PALLXTRAS1",
  "FIRST_STEP",
]);

const GLOBAL_FEE_CODES = new Set([EXTRA_WORK_FEE_CODE, ADD_TO_ORDER_FEE_CODE, "EXPRESS", "BOMTUR"]);
const WORDPRESS_PRICE_MISMATCH_COMMENT = "New system was unable to match to old price";
const EXTRA_PICKUP_CODE = "EXTRAPICKUP";

const SUMMARY_LABEL_PATTERNS = [/^mva\b/i, /^total\b/i, /^total inkl/i, /^pris uten mva\b/i, /^sum\b/i, /^km pris\b/i, /^extra\b/i, /^rabatt\b/i, /^ekstra\b/i];

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const getFirstMetaString = (meta: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = asString(meta[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const parseLegacyMoneyToCents = (value: unknown): number | undefined => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsedEntry = parseLegacyMoneyToCents(entry);
      if (typeof parsedEntry === "number") {
        return parsedEntry;
      }
    }

    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["value", "amount", "text"]) {
      const parsedEntry = parseLegacyMoneyToCents(record[key]);
      if (typeof parsedEntry === "number") {
        return parsedEntry;
      }
    }

    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .replace(/\s+/g, "")
    .replace(/NOK/giu, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");

  if (!normalized) {
    return undefined;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
};

const TOTAL_BREAKDOWN_LABEL_PATTERNS = [/^total$/i, /^pris uten mva\b/i, /^sum$/i];

const IMPORTED_CUSTOMER_DISCOUNT_KEYS = ["field_686e217030aaa", "manual_discount", "rabatt", "discount"] as const;

const IMPORTED_EXTRA_WORK_KEYS = ["field_68760a149a59b", "ekstra_arbeid", "extra_work"] as const;

const IMPORTED_EXTRA_WORK_MINUTES_KEYS = ["field_68760ebfe7f33", "extra_work_minutes", "ekstra_arbeid_minutter"] as const;

const IMPORTED_ADD_TO_ORDER_KEYS = ["field_690216d860a13", "gebyr_for_tillegg_av_bestilling", "add_order_fee"] as const;

const IMPORTED_DEVIATION_KEYS = ["field_682e0baebb080", "bomtur", "deviation", "avvik"] as const;

const formatImportedAdjustment = (cents: number): string => {
  const amount = cents / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/u, "");
};

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
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)));

const stripHtml = (value: string): string => normalizeWhitespace(decodeHtmlEntities(value.replace(/<[^>]*>/g, " ")));

const cleanLegacyBreakdownLabel = (value: string): string => {
  const normalizedValue = normalizeWhitespace(stripHtml(value));
  if (!normalizedValue) return "";

  const parenMatch = normalizedValue.match(/^(.*?)\s*\(([^)]+)\)(?:\s*x\s*\d+(?:[.,]\d+)?)?\s*$/u);
  const withoutParen = parenMatch ? (parenMatch[1] ?? "") : normalizedValue;
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

  const parenMatch = normalizedValue.match(/^(.*?)\s*\(([^)]+)\)(?:\s*x\s*\d+(?:[.,]\d+)?)?\s*$/u);
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
      code: maybePrice && /^\d+$/.test(maybePrice) ? undefined : (parts[1] ?? "").toUpperCase() || undefined,
    };
  }

  return {
    label: cleanLegacyBreakdownLabel(normalizedValue),
  };
};

const parseLegacyServiceValuePriceCents = (value: string): number | undefined => {
  const firstPart = value.split(":")[0];
  return parseLegacyMoneyToCents(firstPart);
};

const extractBreakdownQuantity = (value: string): number | undefined => {
  const normalizedValue = normalizeWhitespace(stripHtml(value));
  if (!normalizedValue) {
    return undefined;
  }

  const quantityMatch = normalizedValue.match(/\bx\s*(\d+(?:[.,]\d+)?)(?:\s*(?:time|timer?))?\b/iu);
  if (!quantityMatch) {
    return undefined;
  }

  const parsed = Number.parseFloat((quantityMatch[1] ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const cleanDeliveryType = (raw?: string): string | undefined => {
  if (!raw) return undefined;

  const parts = raw.split(":");
  if (parts.length >= 2) {
    return parts[1]?.trim() || raw;
  }

  return raw;
};

const cleanLegacyProductName = (raw: string): string => {
  const parsed = parseBreakdownLabelAndCode(raw);
  return parsed.label || normalizeWhitespace(stripHtml(raw));
};

const normalizeImportedDate = (raw?: string): string | undefined => {
  if (!raw) return undefined;

  const normalized = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const compactIsoMatch = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactIsoMatch) {
    const [, year, month, day] = compactIsoMatch;
    return `${year}-${month}-${day}`;
  }

  const dottedMatch = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dottedMatch) {
    const [, day, month, year] = dottedMatch;
    return `${year}-${month}-${day}`;
  }

  return normalized;
};

const normalizeImportedTimeWindow = (raw?: string): string | undefined => {
  if (!raw) return undefined;

  const normalized = raw.trim();
  const rangeMatch = normalized.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/u);
  if (!rangeMatch) {
    return normalized;
  }

  const [, from, to] = rangeMatch;
  return `${from}-${to}`;
};

const normalizeImportedLift = (raw?: string): "yes" | "no" | undefined => {
  if (!raw) return undefined;

  const normalized = raw.trim().toLowerCase();
  if (["ja", "yes", "y", "true", "1"].includes(normalized)) {
    return "yes";
  }

  if (["nei", "no", "n", "false", "0"].includes(normalized)) {
    return "no";
  }

  return undefined;
};

const normalizeImportedStatus = (raw?: string): string | undefined => {
  if (!raw) return undefined;

  const normalized = raw.trim().toLowerCase();
  switch (normalized) {
    case "behandles":
    case "behandling":
    case "processing":
      return "processing";
    case "bekreftet":
    case "confirmed":
      return "confirmed";
    case "aktiv":
    case "active":
      return "active";
    case "kansellert":
    case "kanselert":
    case "cancelled":
    case "canceled":
    case "avbrutt":
      return "cancelled";
    case "fail":
    case "failed":
    case "feilet":
      return "failed";
    case "ferdig":
    case "completed":
      return "completed";
    case "fakturert":
    case "fakturet":
    case "invoiced":
      return "invoiced";
    case "betalt":
    case "paid":
      return "paid";
    default:
      return normalized || undefined;
  }
};

const PRODUCT_REPEATER_KEY_PATTERN = /^(.*)_(\d+)_velg_produkt$/;

const PRODUCT_NAME_FIELD_SUFFIXES = ["velg_produkt"];
const DELIVERY_TYPE_FIELD_SUFFIXES = ["velg_leveringstype", "velg_leveringstype_andre", "leveringstype", "delivery_type"];
const QUANTITY_FIELD_SUFFIXES = ["antall_produkter", "antall", "quantity", "qty"];
const PRODUCT_META_CONTROL_SUFFIXES = new Set([
  ...PRODUCT_NAME_FIELD_SUFFIXES,
  ...DELIVERY_TYPE_FIELD_SUFFIXES,
  ...QUANTITY_FIELD_SUFFIXES,
  "acfe_flexible_toggle",
]);

const getIndexedMetaString = (params: { meta: Record<string, unknown>; prefix: string; index: number; suffixes: string[] }): string | undefined => {
  const { meta, prefix, index, suffixes } = params;

  for (const suffix of suffixes) {
    const value = asString(meta[`${prefix}_${index}_${suffix}`]);
    if (value) {
      return value;
    }
  }

  return undefined;
};

const buildProductItemsFromMeta = (meta: Record<string, unknown>): ParsedWordpressProductItem[] => {
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
    const productNameRaw = getIndexedMetaString({
      meta,
      prefix: entry.prefix,
      index: entry.index,
      suffixes: PRODUCT_NAME_FIELD_SUFFIXES,
    });
    if (!productNameRaw) {
      continue;
    }

    const productName = cleanLegacyProductName(productNameRaw);

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
      metaPrefix: entry.prefix,
      metaIndex: entry.index,
      productName,
      quantity,
      deliveryType,
      rawData: {
        source: "wordpress_sync",
        metaPrefix: entry.prefix,
        metaIndex: entry.index,
        productNameRaw,
        productName,
        quantity,
        deliveryTypeRaw: deliveryTypeRaw ?? null,
        deliveryType: deliveryType ?? null,
      },
    });
  }

  return items;
};

const fillMissingProductDeliveryTypesFromBreakdown = (params: {
  meta: Record<string, unknown>;
  productItems: ParsedWordpressProductItem[];
}): ParsedWordpressProductItem[] => {
  const groups = parseBreakdownGroups(asString(params.meta.price_breakdown_html));

  return params.productItems.map((item, index) => {
    const fillMissingProductDeliveryTypesFromBreakdown = (params: {
      meta: Record<string, unknown>;
      productItems: ParsedWordpressProductItem[];
    }): ParsedWordpressProductItem[] => {
      const groups = parseBreakdownGroups(asString(params.meta.price_breakdown_html));

      return params.productItems.map((item, index) => {
        const group = groups[index];
        if (!group) {
          return item;
        }

        const deliveryRow = group.rows.find((row) => isDeliveryTypeRow(row));
        const inferredDeliveryType = deliveryRow?.code?.trim() || deliveryRow?.label?.trim();

        if (!inferredDeliveryType) {
          return item;
        }

        return {
          ...item,
          deliveryType: inferredDeliveryType,
          rawData: {
            ...(item.rawData as Record<string, Prisma.InputJsonValue>),
            deliveryTypeRaw: deliveryRow?.code ?? inferredDeliveryType,
            deliveryType: inferredDeliveryType,
            inferredDeliveryTypeFromBreakdown: true,
            overriddenDeliveryTypeFromBreakdown: item.deliveryType ?? null,
          },
        };
      });
    };

    const group = groups[index];
    if (!group) {
      return item;
    }

    const deliveryRow = group.rows.find((row) => isDeliveryTypeRow(row));
    const inferredDeliveryType = deliveryRow?.label?.trim();
    if (!inferredDeliveryType) {
      return item;
    }

    return {
      ...item,
      deliveryType: inferredDeliveryType,
      rawData: {
        ...(item.rawData as Record<string, Prisma.InputJsonValue>),
        deliveryTypeRaw: deliveryRow?.code ?? inferredDeliveryType,
        deliveryType: inferredDeliveryType,
        inferredDeliveryTypeFromBreakdown: true,
      },
    };
  });
};

const parseBreakdownGroups = (value: string | undefined): ParsedBreakdownGroup[] => {
  if (!value) return [];

  const html = value.replace(/\r/g, "");
  const rawSegments = html.split(/<div class="price-group">/i).slice(1);
  const groups: ParsedBreakdownGroup[] = [];

  for (const rawSegment of rawSegments) {
    const segment = rawSegment.split(/<div class="price-group">|<hr\b/i)[0] ?? "";
    const groupLabelMatch = segment.match(/<div class="price-group-label">\s*<strong>([\s\S]*?)<\/strong>\s*<\/div>/i);

    const rows = Array.from(
      segment.matchAll(
        /<div class="price-breakdown-row[\s\S]*?<span class="price-breakdown-label">([\s\S]*?)<\/span>[\s\S]*?<span class="price-breakdown-price">([\s\S]*?)<\/span>[\s\S]*?<\/div>/gi,
      ),
    )
      .map((match) => {
        const labelValue = match[1] ?? "";
        const priceValue = match[2] ?? "";
        return {
          ...parseBreakdownLabelAndCode(labelValue),
          quantity: extractBreakdownQuantity(labelValue),
          priceCents: parseLegacyMoneyToCents(stripHtml(priceValue)),
        };
      })
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

const extractBreakdownRows = (value: string | undefined): Array<{ label: string; priceCents: number | undefined }> => {
  if (!value) {
    return [];
  }

  return Array.from(value.matchAll(/price-breakdown-label">([\s\S]*?)<\/span>[\s\S]*?price-breakdown-price">([\s\S]*?)<\/span>/giu)).map((row) => ({
    label: stripHtml(row[1] ?? ""),
    priceCents: parseLegacyMoneyToCents(stripHtml(row[2] ?? "")),
  }));
};

const findBreakdownRowValueCents = (rows: Array<{ label: string; priceCents: number | undefined }>, patterns: RegExp[]): number | undefined => {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (!row || !patterns.some((pattern) => pattern.test(row.label))) {
      continue;
    }

    if (typeof row.priceCents === "number") {
      return Math.abs(row.priceCents);
    }
  }

  return undefined;
};

const isSummaryLabel = (label: string): boolean => SUMMARY_LABEL_PATTERNS.some((pattern) => pattern.test(label));

const isDeliveryTypeRow = (row: ParsedBreakdownRow): boolean => {
  if (row.code && DELIVERY_TYPE_CODES.has(row.code)) {
    return true;
  }

  return /kun\s+installasjon|kun\s+installasjon\/?montering|kun\s+montering/i.test(row.label);
};

const classifyServiceItemType = (row: ParsedBreakdownRow): ParsedWordpressServiceItem["itemType"] => {
  const signal = `${row.code ?? ""} ${row.label}`.toUpperCase();

  if (signal.includes("RETURN") || signal.includes("RETUR")) {
    return "RETURN_OPTION";
  }

  if (signal.includes("INSTALL") || signal.includes("MONTER") || signal.includes("DEMONT")) {
    return "INSTALL_OPTION";
  }

  return "EXTRA_OPTION";
};

const isGlobalFeeRow = (row: ParsedBreakdownRow): boolean => {
  const signal = `${row.code ?? ""} ${row.label}`.toUpperCase();

  return Boolean(row.code && GLOBAL_FEE_CODES.has(row.code)) || signal.includes("EXPRESS") || signal.includes("EKSPRESS") || signal.includes("BOMTUR");
};

const getMetaStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    const items: string[] = [];

    for (const entry of value) {
      const parsed = asString(entry);
      if (parsed) {
        items.push(parsed);
      }
    }

    return items;
  }

  const parsed = asString(value);
  return parsed ? [parsed] : [];
};

const looksLikeLegacyServiceValue = (value: string): boolean => value.includes(":") || /\([A-Z0-9_]+\)/u.test(value);

const hasTruthyLegacySelection = (value: unknown): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasTruthyLegacySelection(entry));
  }

  const normalized = asString(value)?.toLowerCase();
  if (!normalized) {
    return false;
  }

  return !["0", "false", "no", "nei", "off"].includes(normalized);
};

const normalizeLegacyServiceSuffix = (suffix: string): string => suffix.replace(/[_-]+/g, " ").trim().toLowerCase();

const LEGACY_RETURN_FIELD_SUFFIXES = new Set(["field_682206a2252d2"]);
const LEGACY_DEMONT_FIELD_SUFFIXES = new Set(["field_682206f2252d3"]);

const inferLegacyServiceFromMetaSuffix = (params: {
  cardId: number;
  productName: string;
  quantity: number;
  suffix: string;
  key: string;
  rawValue: unknown;
}): ParsedWordpressServiceItem | null => {
  const { cardId, productName, quantity, suffix, key, rawValue } = params;
  const normalizedSuffix = normalizeLegacyServiceSuffix(suffix);
  if (!normalizedSuffix) {
    return null;
  }

  const buildSyntheticService = (itemType: ParsedWordpressServiceItem["itemType"], label: string, code?: string): ParsedWordpressServiceItem => ({
    cardId,
    productName,
    quantity,
    itemType,
    label,
    code,
    rawData: {
      source: "wordpress_sync",
      sourceType: `meta:${suffix}`,
      cardId,
      groupLabel: productName,
      label,
      description: label,
      code: code ?? null,
      quantity,
      metaKey: key,
      metaValue: rawValue === undefined ? null : (rawValue as Prisma.InputJsonValue),
      inferredFromMetaKey: true,
    },
  });

  if (LEGACY_RETURN_FIELD_SUFFIXES.has(suffix)) {
    return buildSyntheticService("RETURN_OPTION", "Retur til butikk", "RETURNSTORE");
  }

  if (LEGACY_DEMONT_FIELD_SUFFIXES.has(suffix)) {
    return buildSyntheticService("EXTRA_OPTION", "Demontering gamle vare", "DEMONT");
  }

  if (/\b(return|retur)\b/.test(normalizedSuffix) && /\b(recycling|gjenvinning)\b/.test(normalizedSuffix)) {
    return buildSyntheticService("RETURN_OPTION", "Retur til gjenvinning", "RETURNREC");
  }

  if (/\b(return|retur)\b/.test(normalizedSuffix)) {
    return buildSyntheticService("RETURN_OPTION", "Retur til butikk", "RETURNSTORE");
  }

  if (/\b(?:demont\w*|demonter\w*)\b/.test(normalizedSuffix)) {
    return buildSyntheticService("EXTRA_OPTION", "Demontering gamle vare", "DEMONT");
  }

  if (/\b(?:unpacking|utpakking\w*)\b/.test(normalizedSuffix)) {
    return buildSyntheticService("EXTRA_OPTION", "Utpakking og kasting av emballasje", "UNPACKING");
  }

  if (/\b(?:install\w*|monter\w*)\b/.test(normalizedSuffix)) {
    return buildSyntheticService("INSTALL_OPTION", "Montering");
  }

  return null;
};

const buildServiceItemsFromMeta = (meta: Record<string, unknown>, productItems: ParsedWordpressProductItem[]): ParsedWordpressServiceItem[] => {
  const serviceItems: ParsedWordpressServiceItem[] = [];

  for (const productItem of productItems) {
    const prefixBase = `${productItem.metaPrefix}_${productItem.metaIndex}_`;

    for (const [key, rawValue] of Object.entries(meta)) {
      if (!key.startsWith(prefixBase) || key.startsWith(`_${prefixBase}`)) {
        continue;
      }

      const suffix = key.slice(prefixBase.length);
      if (!suffix || PRODUCT_META_CONTROL_SUFFIXES.has(suffix)) {
        continue;
      }
      const serviceQuantity = suffix === "timepris" || suffix === "timepris_flugger" ? 0.5 : productItem.quantity;

      let matchedExplicitLegacyValue = false;

      for (const entry of getMetaStringList(rawValue)) {
        if (!looksLikeLegacyServiceValue(entry)) {
          continue;
        }

        matchedExplicitLegacyValue = true;
        const row = parseBreakdownLabelAndCode(entry);
        if (!row.label || isSummaryLabel(row.label) || isDeliveryTypeRow(row) || isGlobalFeeRow(row)) {
          continue;
        }

        serviceItems.push({
          cardId: productItem.cardId,
          productName: productItem.productName,
          quantity: serviceQuantity,
          itemType: classifyServiceItemType(row),
          label: row.label,
          code: row.code,
          priceCents: parseLegacyServiceValuePriceCents(entry),
          rawData: {
            source: "wordpress_sync",
            sourceType: `meta:${suffix}`,
            cardId: productItem.cardId,
            groupLabel: productItem.productName,
            label: row.label,
            description: row.label,
            code: row.code ?? null,
            quantity: serviceQuantity,
            metaKey: key,
            metaValue: entry,
          },
        });
      }

      if (matchedExplicitLegacyValue || !hasTruthyLegacySelection(rawValue)) {
        continue;
      }

      const inferredService = inferLegacyServiceFromMetaSuffix({
        cardId: productItem.cardId,
        productName: productItem.productName,
        quantity: serviceQuantity,
        suffix,
        key,
        rawValue,
      });
      if (inferredService) {
        serviceItems.push(inferredService);
      }
    }
  }

  return serviceItems;
};

const buildServiceItemsFromBreakdown = (meta: Record<string, unknown>, productItems: ParsedWordpressProductItem[]): ParsedWordpressServiceItem[] => {
  const breakdownHtml = asString(meta.price_breakdown_html);
  const groups = parseBreakdownGroups(breakdownHtml);
  const serviceItems: ParsedWordpressServiceItem[] = [];

  groups.forEach((group, index) => {
    const productItem = productItems[index];
    const cardId = productItem?.cardId ?? index + 1;
    const productName = (productItem?.productName ?? group.groupLabel) || "Product";
    const quantity = productItem?.quantity ?? 1;

    for (const row of group.rows) {
      if (!row.label || isSummaryLabel(row.label) || isDeliveryTypeRow(row) || isGlobalFeeRow(row)) {
        continue;
      }

      serviceItems.push({
        cardId,
        productName,
        quantity: row.quantity ?? quantity,
        itemType: classifyServiceItemType(row),
        label: row.label,
        code: row.code,
        priceCents: row.priceCents,
        rawData: {
          source: "wordpress_sync",
          sourceType: "price_breakdown_html",
          cardId,
          groupLabel: group.groupLabel || productName,
          label: row.label,
          description: row.label,
          code: row.code ?? null,
          quantity: row.quantity ?? quantity,
        },
      });
    }
  });

  return serviceItems;
};

const isExpressServiceItem = (serviceItem: Pick<ParsedWordpressServiceItem, "label" | "code">): boolean => {
  const signal = `${serviceItem.code ?? ""} ${serviceItem.label}`.toUpperCase();
  return signal.includes("EXPRESS") || signal.includes("EKSPRESS");
};

const dedupeServiceItems = (serviceItems: ParsedWordpressServiceItem[]): ParsedWordpressServiceItem[] => {
  const seen = new Set<string>();

  return serviceItems.filter((item) => {
    const signature = buildServiceSignature(item);
    if (seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
};

const buildServicesSummary = (serviceItems: ParsedWordpressServiceItem[]): string | undefined => {
  if (serviceItems.length === 0) {
    return undefined;
  }

  const counts = new Map<string, number>();

  for (const item of serviceItems) {
    counts.set(item.label, (counts.get(item.label) ?? 0) + item.quantity);
  }

  return Array.from(counts.entries(), ([label, quantity]) => (quantity > 1 ? `${label} x${quantity}` : label)).join(", ");
};

const parseDistanceKm = (value?: string): number => {
  if (!value) return 0;

  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getImportedWordpressPriceExVatCents = (meta: Record<string, unknown>): number | undefined => {
  const explicitTotal = parseLegacyMoneyToCents(meta.total_price);
  if (typeof explicitTotal === "number") {
    return explicitTotal;
  }

  const breakdownHtml = asString(meta.price_breakdown_html);
  if (!breakdownHtml) {
    return undefined;
  }

  return findBreakdownRowValueCents(extractBreakdownRows(breakdownHtml), TOTAL_BREAKDOWN_LABEL_PATTERNS);
};

const getImportedWordpressAdjustments = (meta: Record<string, unknown>): ImportedWordpressAdjustments => {
  const customerRows = extractBreakdownRows(asString(meta.price_breakdown_html));
  const subcontractorRows = extractBreakdownRows(asString(meta.field_6889f3e2ca127));

  const rabattCents =
    IMPORTED_CUSTOMER_DISCOUNT_KEYS.map((key) => parseLegacyMoneyToCents(meta[key])).find((value): value is number => typeof value === "number") ??
    findBreakdownRowValueCents(customerRows, [/^rabatt\b/i]);
  const subcontractorMinusCents = findBreakdownRowValueCents(subcontractorRows, [/^minus$/i]);

  return {
    rabatt: typeof rabattCents === "number" ? formatImportedAdjustment(rabattCents) : undefined,
    leggTil: undefined,
    subcontractorMinus: typeof subcontractorMinusCents === "number" ? formatImportedAdjustment(subcontractorMinusCents) : undefined,
    subcontractorPlus: undefined,
  };
};

const parseLegacyInteger = (value: unknown): number | undefined => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = parseLegacyInteger(entry);
      if (typeof parsed === "number") {
        return parsed;
      }
    }

    return undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["value", "amount", "text"]) {
      const parsed = parseLegacyInteger(record[key]);
      if (typeof parsed === "number") {
        return parsed;
      }
    }

    return undefined;
  }

  const parsed = safeInteger(value);
  return parsed > 0 ? parsed : undefined;
};

const getFirstLegacyInteger = (meta: Record<string, unknown>, keys: readonly string[]): number | undefined => {
  for (const key of keys) {
    const parsed = parseLegacyInteger(meta[key]);
    if (typeof parsed === "number") {
      return parsed;
    }
  }

  return undefined;
};

const hasLegacySelection = (meta: Record<string, unknown>, keys: readonly string[]): boolean => keys.some((key) => hasTruthyLegacySelection(meta[key]));

const getBreakdownRowsWithCodes = (breakdownHtml: string | undefined): ParsedBreakdownRow[] =>
  extractBreakdownRows(breakdownHtml).map((row) => ({
    ...parseBreakdownLabelAndCode(row.label),
    priceCents: row.priceCents,
  }));

const getBreakdownCodeSignal = (row: ParsedBreakdownRow): string => `${row.code ?? ""} ${row.label}`.toUpperCase();

const isExtraPickupBreakdownRow = (row: ParsedBreakdownRow): boolean => getBreakdownCodeSignal(row).includes(EXTRA_PICKUP_CODE);

const isKmBreakdownRow = (row: ParsedBreakdownRow): boolean => /^km pris\b/i.test(row.label);

const isExpressBreakdownRow = (row: ParsedBreakdownRow): boolean =>
  getBreakdownCodeSignal(row).includes("EXPRESS") || getBreakdownCodeSignal(row).includes("EKSPRESS");

const isBomturBreakdownRow = (row: ParsedBreakdownRow): boolean => getBreakdownCodeSignal(row).includes("BOMTUR");

const isDeviationBreakdownRow = (row: ParsedBreakdownRow): boolean => Boolean(getDeviationFeeOption(`${row.label}:${row.code ?? ""}`));

const isGlobalWordpressPriceRow = (row: ParsedBreakdownRow): boolean =>
  isKmBreakdownRow(row) ||
  isExtraPickupBreakdownRow(row) ||
  isExpressBreakdownRow(row) ||
  isBomturBreakdownRow(row) ||
  isDeviationBreakdownRow(row) ||
  isGlobalFeeRow(row);

const getExtraWorkBlocksFromLabel = (label: string): number | undefined => {
  const match = label.match(/\bx\s*(\d+)\b/iu);
  if (!match) {
    return undefined;
  }

  const blocks = Number.parseInt(match[1] ?? "", 10);
  return Number.isInteger(blocks) && blocks > 0 ? blocks : undefined;
};

const getImportedWordpressFees = (meta: Record<string, unknown>): ImportedWordpressFees => {
  const rows = getBreakdownRowsWithCodes(asString(meta.price_breakdown_html));
  const extraWorkRow = rows.find((row) => {
    const signal = getBreakdownCodeSignal(row);
    return signal.includes(EXTRA_WORK_FEE_CODE) || /ekstra\s+arbeid/i.test(row.label);
  });
  const addToOrderRow = rows.find((row) => {
    const signal = getBreakdownCodeSignal(row);
    return signal.includes(ADD_TO_ORDER_FEE_CODE) || /gebyr\s+for\s+tillegg\s+av\s+bestilling/i.test(row.label);
  });
  const minutesFromMeta = getFirstLegacyInteger(meta, IMPORTED_EXTRA_WORK_MINUTES_KEYS);
  const blocksFromBreakdown = extraWorkRow ? getExtraWorkBlocksFromLabel(extraWorkRow.label) : undefined;
  const extraWorkMinutes = minutesFromMeta ?? (blocksFromBreakdown ? blocksFromBreakdown * 20 : 0);
  const feeExtraWork = hasLegacySelection(meta, IMPORTED_EXTRA_WORK_KEYS) || Boolean(extraWorkRow) || extraWorkMinutes > 0;

  return {
    feeExtraWork,
    extraWorkMinutes: feeExtraWork ? extraWorkMinutes : 0,
    feeAddToOrder: hasLegacySelection(meta, IMPORTED_ADD_TO_ORDER_KEYS) || Boolean(addToOrderRow),
  };
};

const getImportedWordpressDeviation = (meta: Record<string, unknown>): string | undefined => {
  const metaDeviation = getFirstMetaString(meta, Array.from(IMPORTED_DEVIATION_KEYS));
  const normalizedMetaDeviation = normalizeDeviationLabel(metaDeviation);
  if (normalizedMetaDeviation) {
    return normalizedMetaDeviation;
  }

  const breakdownRows = getBreakdownRowsWithCodes(asString(meta.price_breakdown_html));
  const matchingRow = breakdownRows.find((row) => Boolean(getDeviationFeeOption(`${row.label}:${row.code ?? ""}`)));

  return normalizeDeviationLabel(matchingRow ? `${matchingRow.label}:${matchingRow.code ?? ""}` : undefined);
};

const getProtectedFailureFeeCents = (params: { importedFees: ImportedWordpressFees; deviation?: string }): number => {
  const extraWorkFeeCents = params.importedFees.feeExtraWork ? calculateExtraWorkFee(params.importedFees.extraWorkMinutes).price * 100 : 0;
  const addToOrderFeeCents = params.importedFees.feeAddToOrder ? 99 * 100 : 0;
  const deviationFeeCents = (getDeviationFeeOption(params.deviation)?.price ?? 0) * 100;

  return extraWorkFeeCents + addToOrderFeeCents + deviationFeeCents;
};

const isFailureDiscountStatus = (status: string): boolean => status === "cancelled" || status === "failed";

const getNativeCalculatedPricing = (params: {
  productCards: ReturnType<typeof mapWordpressImportToProductCards>["productCards"];
  catalogProducts: Awaited<ReturnType<typeof getBookingCatalog>>["products"];
  catalogSpecialOptions: Awaited<ReturnType<typeof getBookingCatalog>>["specialOptions"];
  drivingDistance: string | undefined;
  adjustments: ImportedWordpressAdjustments;
  importedFees?: ImportedWordpressFees;
  deviation?: string;
}): { totalExVatCents: number; subcontractorTotalCents: number } => {
  const productBreakdowns = buildProductBreakdowns(params.productCards, params.catalogProducts, params.catalogSpecialOptions, {
    zeroBaseDeliveryPricesOver100Km: parseDistanceKm(params.drivingDistance) > 100,
  });
  const priceLookup = buildPriceLookup(params.catalogProducts, params.catalogSpecialOptions);
  const result = calculateBookingPricing({
    productBreakdowns,
    priceLookup,
    adjustments: params.adjustments,
  });
  const extraWorkFeeCents = params.importedFees?.feeExtraWork === true ? calculateExtraWorkFee(params.importedFees.extraWorkMinutes).price * 100 : 0;
  const addToOrderFeeCents = params.importedFees?.feeAddToOrder === true ? 99 * 100 : 0;
  const deviationFeeCents = (getDeviationFeeOption(params.deviation)?.price ?? 0) * 100;

  return {
    totalExVatCents: Math.round(result.totals.totalExVat * 100 + extraWorkFeeCents + addToOrderFeeCents + deviationFeeCents),
    subcontractorTotalCents: Math.round((result.totals.subcontractorTotal ?? 0) * 100),
  };
};

const getBreakdownGroupTotalCents = (group: ParsedBreakdownGroup | undefined): number | undefined => {
  if (!group) {
    return undefined;
  }

  const total = group.rows.filter((row) => !isGlobalWordpressPriceRow(row)).reduce((sum, row) => sum + (row.priceCents ?? 0), 0);

  return Number.isFinite(total) ? total : undefined;
};

const getNativeProductTotalCents = (params: {
  productCard: ReturnType<typeof mapWordpressImportToProductCards>["productCards"][number];
  catalogProducts: Awaited<ReturnType<typeof getBookingCatalog>>["products"];
  catalogSpecialOptions: Awaited<ReturnType<typeof getBookingCatalog>>["specialOptions"];
}): number => {
  const breakdowns = buildProductBreakdowns([params.productCard], params.catalogProducts, params.catalogSpecialOptions);
  const result = calculateBookingPricing({
    productBreakdowns: breakdowns,
    priceLookup: buildPriceLookup(params.catalogProducts, params.catalogSpecialOptions),
  });

  return Math.round(result.totals.totalExVat * 100);
};

const toReadOnlyRows = (rows: ParsedBreakdownRow[]) =>
  rows
    .filter((row) => typeof row.priceCents === "number")
    .map((row) => ({
      label: row.label,
      code: row.code ?? null,
      quantity: 1,
      priceCents: row.priceCents ?? 0,
    }));

const applyWordpressPriceMatchPolicy = (params: {
  meta: Record<string, unknown>;
  productCards: ReturnType<typeof mapWordpressImportToProductCards>["productCards"];
  resolvedServices: ResolvedWordpressService[];
  catalogProducts: Awaited<ReturnType<typeof getBookingCatalog>>["products"];
  catalogSpecialOptions: Awaited<ReturnType<typeof getBookingCatalog>>["specialOptions"];
}) => {
  const groups = parseBreakdownGroups(asString(params.meta.price_breakdown_html));
  const resolvedCodesByCardId = new Map<number, Set<string>>();

  for (const service of params.resolvedServices) {
    const code = (service.code ?? service.optionCode ?? "").trim().toUpperCase();
    if (!code) continue;

    const set = resolvedCodesByCardId.get(service.cardId) ?? new Set<string>();
    set.add(code);
    resolvedCodesByCardId.set(service.cardId, set);
  }

  const nextCards = params.productCards.map((card, index) => {
    const group = groups[index];

    if (!group) {
      return card;
    }

    const unresolvedRows = group.rows.filter((row) => {
      if (!row.label || isGlobalWordpressPriceRow(row)) {
        return false;
      }
      if (isDeliveryTypeRow(row)) {
        const code = (row.code ?? "").trim().toUpperCase();

        if (code === "XTRA") {
          if (/første trinn|forste trinn/i.test(row.label)) {
            // map/preserve as XTRALEVERING
          }

          if (/innbæring|innbaering/i.test(row.label)) {
            // map/preserve as XTRAINB
          }
        }

        return false;
      }

      const code = (row.code ?? "").trim().toUpperCase();

      if (!code) {
        return true;
      }

      return !resolvedCodesByCardId.get(card.cardId)?.has(code);
    });

    if (unresolvedRows.length === 0) {
      return card;
    }

    return {
      ...card,
      wordpressImportReadOnly: {
        productName: group.groupLabel || `WordPress product ${index + 1}`,
        comment: WORDPRESS_PRICE_MISMATCH_COMMENT,
        rows: toReadOnlyRows((group.rows ?? []).filter((row) => !isGlobalWordpressPriceRow(row))),
      },
    };
  });

  const allRows = getBreakdownRowsWithCodes(asString(params.meta.price_breakdown_html));
  const extraPickupRows = allRows.filter(isExtraPickupBreakdownRow);
  const kmRows = allRows.filter(isKmBreakdownRow);
  const expressRows = allRows.filter(isExpressBreakdownRow);
  const bomturRows = allRows.filter(isBomturBreakdownRow);
  const deviationRows = allRows.filter(isDeviationBreakdownRow);

  const nativeCoveredGlobalRows = [...expressRows, ...extraPickupRows, ...bomturRows, ...deviationRows];

  const readOnlyGlobalRows = [...kmRows].filter(
    (row) => !nativeCoveredGlobalRows.some((nativeRow) => getBreakdownCodeSignal(nativeRow) === getBreakdownCodeSignal(row)),
  );

  const globalReadOnlyRows = readOnlyGlobalRows;

  if (globalReadOnlyRows.length === 0) {
    return nextCards;
  }

  const globalReadOnlyCard = createEmptyProductCard(nextCards.length + 1);
  globalReadOnlyCard.wordpressImportReadOnly = {
    productName: "WordPress order prices",
    comment: WORDPRESS_PRICE_MISMATCH_COMMENT,
    rows: toReadOnlyRows(globalReadOnlyRows),
  };

  return [...nextCards, globalReadOnlyCard];
};

async function syncWordpressPriceMismatchNotification(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    companyId: string;
    wordpressPriceExVatCents?: number;
    nativePriceExVatCents: number;
  },
) {
  const { orderId, companyId, wordpressPriceExVatCents, nativePriceExVatCents } = params;

  const existing = await tx.orderNotification.findFirst({
    where: {
      orderId,
      companyId,
      type: "MANUAL_REVIEW",
      title: "WordPress price mismatch",
      resolvedAt: null,
    },
    select: {
      id: true,
    },
  });

  const hasMismatch = typeof wordpressPriceExVatCents === "number" && wordpressPriceExVatCents !== nativePriceExVatCents;

  if (!hasMismatch) {
    if (!existing) {
      return;
    }

    await tx.orderNotification.update({
      where: {
        id: existing.id,
      },
      data: {
        resolvedAt: new Date(),
      },
    });

    const unreadNotificationCount = await tx.orderNotification.count({
      where: {
        orderId,
        companyId,
        resolvedAt: null,
      },
    });

    await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        needsNotificationAttention: unreadNotificationCount > 0,
        unreadNotificationCount,
      },
    });

    return;
  }

  if (existing) {
    return;
  }

  await createOrderNotification(tx, {
    orderId,
    companyId,
    type: "MANUAL_REVIEW",
    title: "WordPress price mismatch",
    message: "Imported WordPress price does not match the rebuilt native total. Review the order manually.",
    payload: {
      source: "wordpress_import",
      wordpressPriceExVatCents,
      nativePriceExVatCents,
    },
  });
}

const attachServiceLabelsToProductItems = (
  productItems: ParsedWordpressProductItem[],
  serviceItems: ParsedWordpressServiceItem[],
): ParsedWordpressProductItem[] =>
  productItems.map((item) => {
    const linkedServiceItems = serviceItems.filter((serviceItem) => serviceItem.cardId === item.cardId);

    return {
      ...item,
      rawData: {
        ...(item.rawData as Record<string, Prisma.InputJsonValue>),
        serviceLabels: linkedServiceItems.map((serviceItem) => serviceItem.label),
        installLabels: linkedServiceItems.filter((serviceItem) => serviceItem.itemType === "INSTALL_OPTION").map((serviceItem) => serviceItem.label),
        returnLabels: linkedServiceItems.filter((serviceItem) => serviceItem.itemType === "RETURN_OPTION").map((serviceItem) => serviceItem.label),
        extraLabels: linkedServiceItems.filter((serviceItem) => serviceItem.itemType === "EXTRA_OPTION").map((serviceItem) => serviceItem.label),
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

const buildResolvedServiceKey = (cardId: number, itemType: string, optionCode: string | null | undefined): string =>
  `${cardId}|${itemType}|${optionCode ?? ""}`;

const buildServiceSignature = (service: { cardId: number; itemType: string; label: string; code?: string | null }): string =>
  `${service.cardId}|${service.itemType}|${service.code ?? ""}|${service.label}`;

const buildResolvedServiceQueues = (services: ResolvedWordpressService[]): Map<string, ResolvedWordpressService[]> => {
  const queues = new Map<string, ResolvedWordpressService[]>();

  for (const service of services) {
    const key = buildResolvedServiceKey(service.cardId, service.resolvedItemType, service.optionCode);
    const currentQueue = queues.get(key) ?? [];
    currentQueue.push(service);
    queues.set(key, currentQueue);
  }

  return queues;
};

const cloneMappedProductCard = (card: ReturnType<typeof mapWordpressImportToProductCards>["productCards"][number]) => ({
  ...card,
  selectedInstallOptionIds: [...card.selectedInstallOptionIds],
  selectedExtraOptionIds: [...card.selectedExtraOptionIds],
  selectedTimeOptionIds: [...card.selectedTimeOptionIds],
  customSectionSelections: card.customSectionSelections.map((selection) => ({
    ...selection,
    optionIds: [...selection.optionIds],
  })),
});

const pushUniqueSelection = (target: string[], value: string | null | undefined) => {
  if (!value || target.includes(value)) {
    return;
  }

  target.push(value);
};

const ensureResolvedSelectionsOnProductCards = (params: {
  productCards: ReturnType<typeof mapWordpressImportToProductCards>["productCards"];
  resolvedServices: ResolvedWordpressService[];
}) => {
  const productCards = params.productCards.map(cloneMappedProductCard);
  const cardLookup = new Map(productCards.map((card) => [card.cardId, card]));

  for (const resolvedService of params.resolvedServices) {
    const card = cardLookup.get(resolvedService.cardId);
    if (!card) {
      continue;
    }

    if (resolvedService.optionCode && resolvedService.optionCode.trim().toUpperCase() === OPTION_CODES.DEMONT) {
      card.demontEnabled = true;
      continue;
    }

    if (resolvedService.resolvedItemType === "INSTALL_OPTION") {
      pushUniqueSelection(card.selectedInstallOptionIds, resolvedService.optionId);
      continue;
    }

    if (resolvedService.resolvedItemType === "RETURN_OPTION") {
      if (!card.selectedReturnOptionId && resolvedService.optionId) {
        card.selectedReturnOptionId = resolvedService.optionId;
      }
      continue;
    }

    if (resolvedService.customSectionId && resolvedService.optionId) {
      const existingSelection = card.customSectionSelections.find((selection) => selection.sectionId === resolvedService.customSectionId) ?? null;

      if (existingSelection) {
        pushUniqueSelection(existingSelection.optionIds, resolvedService.optionId);
      } else {
        card.customSectionSelections.push({
          sectionId: resolvedService.customSectionId,
          optionIds: [resolvedService.optionId],
        });
      }
      continue;
    }

    pushUniqueSelection(card.selectedExtraOptionIds, resolvedService.optionId);
  }

  return productCards;
};

const takeResolvedServiceMatch = (queues: Map<string, ResolvedWordpressService[]>, item: BuiltOrderItem): ResolvedWordpressService | null => {
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

const buildProductRawDataLookup = (productItems: ParsedWordpressProductItem[]): Map<number, JsonRecord> =>
  new Map(productItems.map((item) => [item.cardId, toJsonRecord(item.rawData)]));

const buildParsedServiceLookup = (serviceItems: ParsedWordpressServiceItem[]): Map<string, JsonRecord[]> => {
  const lookup = new Map<string, JsonRecord[]>();

  for (const serviceItem of serviceItems) {
    const signature = buildServiceSignature(serviceItem);
    const current = lookup.get(signature) ?? [];
    current.push(toJsonRecord(serviceItem.rawData));
    lookup.set(signature, current);
  }

  return lookup;
};

const coerceReturnServicesToStoreWhenAddressExists = (serviceItems: ParsedWordpressServiceItem[], hasReturnAddress: boolean): ParsedWordpressServiceItem[] => {
  if (!hasReturnAddress) {
    return serviceItems;
  }

  return serviceItems.map((item) =>
    item.itemType === "RETURN_OPTION"
      ? {
          ...item,
          label: "Retur til butikk",
          code: "RETURNSTORE",
          rawData: {
            ...(toJsonRecord(item.rawData) as Record<string, Prisma.InputJsonValue>),
            originalReturnLabel: item.label,
            originalReturnCode: item.code ?? null,
            forcedReturnStoreBecauseReturnAddressExists: true,
          },
        }
      : item,
  );
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
  const { resolvedServices, productCards, catalogProducts, parsedServiceLookup } = params;
  const cardLookup = new Map(productCards.map((card) => [card.cardId, card]));
  const productLookup = new Map(catalogProducts.map((product) => [product.id, product]));

  return resolvedServices.map((service) => {
    const card = cardLookup.get(service.cardId) ?? null;
    const product = card?.productId ? (productLookup.get(card.productId) ?? null) : null;
    const parsedRawData = takeParsedServiceRawData(parsedServiceLookup, service);

    return {
      cardId: service.cardId,
      productId: product?.id ?? null,
      productCode: product?.code ?? null,
      productName: product?.label ?? service.productName,
      deliveryType: product?.allowDeliveryTypes && card?.deliveryType ? getProductDeliveryTypeLabel(product.deliveryTypes, card.deliveryType) : null,
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
  const { unresolvedProducts, unresolvedServices, productItems, parsedServiceLookup } = params;
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

const toCreateManyItem = (orderId: string, item: ImportedOrderItemData): Prisma.OrderItemCreateManyInput => ({
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
  rawData: item.rawData ? (item.rawData as Prisma.InputJsonValue) : Prisma.JsonNull,
});

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-wp-sync-secret");

    if (!process.env.WORDPRESS_SYNC_SECRET || secret !== process.env.WORDPRESS_SYNC_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as WordpressOrderSyncPayload;

    if (!body || !Number.isInteger(body.legacyWordpressOrderId) || !Number.isInteger(body.legacyWordpressUserId)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const companyId = process.env.WORDPRESS_SYNC_COMPANY_ID;
    if (!companyId) {
      return NextResponse.json({ error: "Missing WORDPRESS_SYNC_COMPANY_ID" }, { status: 500 });
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

    const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? (body.meta as Record<string, unknown>) : {};

    const pickupAddress = getFirstMetaString(meta, ["pickup_address", "henteadresse"]);
    const deliveryAddress = getFirstMetaString(meta, ["delivery_address", "leveringsadresse"]);
    const returnAddress = getFirstMetaString(meta, ["returadresse", "return_address"]);
    const customerName = getFirstMetaString(meta, ["kundens_navn", "customer_name"]);
    const customerLabel = customerName ?? getFirstMetaString(meta, ["bestillingsnr"]);
    const phone = getFirstMetaString(meta, ["telefon_full", "telefon", "phone"]);
    const phoneTwo = getFirstMetaString(meta, ["ekstra_kundens_telefon", "additional_customer_phone", "phone_two"]);
    const email = getFirstMetaString(meta, ["e-postadresse", "epostadresse", "email", "customer_email"]);
    const customerComments = getFirstMetaString(meta, ["contact_notes", "customer_comments", "kunde_kommentar"]);
    const floorNo = getFirstMetaString(meta, ["etasje_nr", "floor_no", "floor"]);
    const lift = normalizeImportedLift(getFirstMetaString(meta, ["heis", "lift"]));
    const cashierName = getFirstMetaString(meta, ["kasserers_navn", "cashier_name"]);
    const cashierPhone = getFirstMetaString(meta, ["kasserers_telefon_full", "kasserers_telefon", "cashier_phone"]);
    const deliveryDate = normalizeImportedDate(getFirstMetaString(meta, ["leveringsdato", "delivery_date"]));
    const timeWindow = normalizeImportedTimeWindow(getFirstMetaString(meta, ["tidsvindu_for_levering", "delivery_time_window", "time_window"]));
    const orderNumber = getFirstMetaString(meta, ["bestillingsnr", "order_number"]);
    const status =
      normalizeImportedStatus(getFirstMetaString(meta, ["status", "order_status", "post_status"])) ??
      normalizeImportedStatus(asString(body.status)) ??
      "processing";
    const drivingDistance = getFirstMetaString(meta, ["total_km", "driving_distance"]);
    const description = getFirstMetaString(meta, ["beskrivelse", "description"]) ?? orderNumber ?? asString(body.title);
    const extraPickupAddresses = getWordpressExtraPickupAddresses(meta);
    const extraPickupContacts = buildWordpressExtraPickupContacts(extraPickupAddresses);
    let importedAdjustments = getImportedWordpressAdjustments(meta);
    const importedFees = getImportedWordpressFees(meta);
    const deviation = getImportedWordpressDeviation(meta);

    const parsedProductItems = fillMissingProductDeliveryTypesFromBreakdown({
      meta,
      productItems: buildProductItemsFromMeta(meta),
    });
    const parsedServiceItemsRaw = dedupeServiceItems([
      ...buildServiceItemsFromMeta(meta, parsedProductItems),
      ...buildServiceItemsFromBreakdown(meta, parsedProductItems),
    ]);

    const hasReturnAddress = Boolean(returnAddress?.trim());

    const parsedServiceItems = coerceReturnServicesToStoreWhenAddressExists(parsedServiceItemsRaw, hasReturnAddress);
    const expressDelivery = getWordpressExpressDelivery(meta);
    const productItems = attachServiceLabelsToProductItems(parsedProductItems, parsedServiceItems);
    const productsSummary =
      productItems.length > 0
        ? productItems.map((item) => (item.quantity > 1 ? `${item.productName} x${item.quantity}` : item.productName)).join(", ")
        : undefined;

    const deliveryTypeSummary =
      productItems.length > 0
        ? productItems
            .map((item) => item.deliveryType)
            .filter((value): value is string => Boolean(value))
            .join(", ")
        : undefined;

    const servicesSummary = buildServicesSummary(parsedServiceItems);
    const defaultPriceList = await prisma.priceList.findUnique({
      where: { code: "DEFAULT" },
      select: { id: true },
    });

    const priceListId = membership.priceListId ?? defaultPriceList?.id ?? null;

    const catalog = await getBookingCatalog(priceListId);
    console.dir(
      catalog.products
        .filter((p) => ["Side by side", "Ettermontering", "Pall", "Vaskemaskin"].includes(p.label))
        .map((p) => ({
          label: p.label,
          code: p.code,
          allowDeliveryTypes: p.allowDeliveryTypes,
          allowHoursInput: p.allowHoursInput,
          deliveryTypes: p.deliveryTypes,
          options: p.options.map((o) => ({
            code: o.code,
            label: o.label,
            customerPrice: o.customerPrice,
          })),
          customSections: p.customSections.map((s) => ({
            id: s.id,
            options: s.options.map((o) => ({
              code: o.code,
              label: o.label,
              price: o.price,
            })),
          })),
        })),
      { depth: null },
    );
    const rawMappedImport = mapWordpressImportToProductCards({
      parsedProducts: productItems.map((item) => ({
        cardId: item.cardId,
        productName: item.productName,
        quantity: getImportedProductQuantity(item, catalog.products),
        deliveryType: item.deliveryType,
      })),

      parsedServices: parsedServiceItems.map((item) => ({
        cardId: item.cardId,
        productName: item.productName,
        quantity: item.label.toLowerCase().includes("time") && item.quantity === 1 ? WORDPRESS_DEFAULT_TIME_HOURS : item.quantity,
        itemType: item.itemType,
        label: item.label,
        code: item.code,
        priceCents: item.priceCents,
      })),
      catalogProducts: catalog.products,
      catalogSpecialOptions: catalog.specialOptions,
    });

    const mappedImport = {
      ...rawMappedImport,
      productCards: ensureResolvedSelectionsOnProductCards({
        productCards: rawMappedImport.productCards,
        resolvedServices: rawMappedImport.resolvedServices,
      }),
    };
    const wordpressPriceExVatCents = getImportedWordpressPriceExVatCents(meta);
    const protectedFailureFeeCents = getProtectedFailureFeeCents({
      importedFees,
      deviation,
    });
    const shouldApplyFailureDiscount = isFailureDiscountStatus(status) && typeof wordpressPriceExVatCents === "number";
    if (shouldApplyFailureDiscount) {
      importedAdjustments = {
        ...importedAdjustments,
        rabatt: formatImportedAdjustment(Math.max(0, wordpressPriceExVatCents - protectedFailureFeeCents)),
      };
    }
    const effectiveWordpressPriceExVatCents = shouldApplyFailureDiscount ? protectedFailureFeeCents : wordpressPriceExVatCents;
    const returnStoreOption = catalog.specialOptions.find((option) => option.type === "return" && option.code.trim().toUpperCase() === "RETURNSTORE");

    if (returnAddress?.trim() && returnStoreOption) {
      const cardIdsWithImportedReturn = new Set(parsedServiceItems.filter((service) => service.itemType === "RETURN_OPTION").map((service) => service.cardId));

      mappedImport.productCards = mappedImport.productCards.map((card) => ({
        ...card,
        selectedReturnOptionId: cardIdsWithImportedReturn.has(card.cardId) ? returnStoreOption.id : card.selectedReturnOptionId,
      }));

      mappedImport.resolvedServices = mappedImport.resolvedServices.map((service) =>
        service.resolvedItemType === "RETURN_OPTION"
          ? {
              ...service,
              optionId: returnStoreOption.id,
              optionCode: returnStoreOption.code,
              optionLabel: returnStoreOption.label,
              customerPriceCents: Math.round(Number(returnStoreOption.customerPrice) * 100),
              subcontractorPriceCents: Math.round(Number(returnStoreOption.subcontractorPrice) * 100),
            }
          : service,
      );
    }

    mappedImport.productCards = applyWordpressPriceMatchPolicy({
      meta,
      productCards: mappedImport.productCards,
      resolvedServices: mappedImport.resolvedServices,
      catalogProducts: catalog.products,
      catalogSpecialOptions: catalog.specialOptions,
    });

    const nativePricing = getNativeCalculatedPricing({
      productCards: mappedImport.productCards,
      catalogProducts: catalog.products,
      catalogSpecialOptions: catalog.specialOptions,
      drivingDistance: undefined,
      adjustments: importedAdjustments,
      importedFees,
      deviation,
    });
    const nativePriceExVatCents = nativePricing.totalExVatCents;
    const nativePriceSubcontractorCents = nativePricing.subcontractorTotalCents;

    const resolvedServiceQueues = buildResolvedServiceQueues(mappedImport.resolvedServices);
    const nativeItems = enrichNativeItemsWithWordpressRawData({
      nativeItems: buildOrderItemsFromCards(mappedImport.productCards, catalog.products, catalog.specialOptions),
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
              priceListId,
              legacyWordpressAuthorId: body.legacyWordpressUserId,
              legacyWordpressRawMeta: body.meta ?? Prisma.JsonNull,
              status,
              deviation,
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
              lift,
              drivingDistance,
              cashierName,
              cashierPhone,
              deliveryDate,
              timeWindow,
              expressDelivery,
              orderNumber,
              productsSummary,
              deliveryTypeSummary,
              servicesSummary,
              extraPickupAddress: extraPickupAddresses,
              extraPickupContacts: extraPickupContacts.length > 0 ? (extraPickupContacts as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
              rabatt: importedAdjustments.rabatt,
              leggTil: importedAdjustments.leggTil,
              subcontractorMinus: importedAdjustments.subcontractorMinus,
              subcontractorPlus: importedAdjustments.subcontractorPlus,
              feeExtraWork: importedFees.feeExtraWork,
              extraWorkMinutes: importedFees.extraWorkMinutes,
              feeAddToOrder: importedFees.feeAddToOrder,
              priceExVat:
                typeof effectiveWordpressPriceExVatCents === "number"
                  ? Math.round(effectiveWordpressPriceExVatCents / 100)
                  : Math.round(nativePriceExVatCents / 100),
              priceSubcontractor: Math.round(nativePriceSubcontractorCents / 100),
              productCardsSnapshot: mappedImport.productCards.length > 0 ? (mappedImport.productCards as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
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

          await syncWordpressPriceMismatchNotification(tx, {
            orderId: updated.id,
            companyId,
            wordpressPriceExVatCents: effectiveWordpressPriceExVatCents,
            nativePriceExVatCents,
          });

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
              priceListId,
              legacyWordpressOrderId: body.legacyWordpressOrderId,
              legacyWordpressAuthorId: body.legacyWordpressUserId,
              legacyWordpressRawMeta: body.meta ?? Prisma.JsonNull,
              createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
              updatedAt: body.createdAt ? new Date(body.createdAt) : undefined,
              displayId: currentCounter.nextNumber,
              status,
              deviation,
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
              lift,
              drivingDistance,
              cashierName,
              cashierPhone,
              deliveryDate,
              timeWindow,
              expressDelivery,
              orderNumber,
              productsSummary,
              deliveryTypeSummary,
              servicesSummary,
              extraPickupAddress: extraPickupAddresses,
              extraPickupContacts: extraPickupContacts.length > 0 ? (extraPickupContacts as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
              rabatt: importedAdjustments.rabatt,
              leggTil: importedAdjustments.leggTil,
              subcontractorMinus: importedAdjustments.subcontractorMinus,
              subcontractorPlus: importedAdjustments.subcontractorPlus,
              feeExtraWork: importedFees.feeExtraWork,
              extraWorkMinutes: importedFees.extraWorkMinutes,
              feeAddToOrder: importedFees.feeAddToOrder,
              priceExVat:
                typeof effectiveWordpressPriceExVatCents === "number"
                  ? Math.round(effectiveWordpressPriceExVatCents / 100)
                  : Math.round(nativePriceExVatCents / 100),
              priceSubcontractor: Math.round(nativePriceSubcontractorCents / 100),
              productCardsSnapshot: mappedImport.productCards.length > 0 ? (mappedImport.productCards as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
              dontSendEmail: true,
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

          await syncWordpressPriceMismatchNotification(tx, {
            orderId: created.id,
            companyId,
            wordpressPriceExVatCents: effectiveWordpressPriceExVatCents,
            nativePriceExVatCents,
          });

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

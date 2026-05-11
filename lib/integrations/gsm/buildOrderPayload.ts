// path: lib/integrations/gsm/buildOrderPayload.ts
import type { Order, OrderItem } from "@prisma/client";
import { buildLegacyOrderSummaryGroups, buildOrderSummaryGroups, formatOrderSummaryText } from "@/lib/orders/orderSummary";

type GsmContact = {
  name?: string;
  emails?: string[];
  phones?: string[];
};

type GsmTask = {
  account: string;
  category: "pick_up" | "drop_off" | "assignment";
  address: { raw_address: string };
  contact?: GsmContact;
  description: string;
  complete_after?: string;
  complete_before?: string;
  metafields?: Record<string, string>;
};

type GsmOrderPayload = {
  account: string;
  reference: string;
  external_id: string;
  orderer: GsmContact;
  tasks_data: GsmTask[];
  metafields: Record<string, string>;
};

export type GsmOrderInput = Order & {
  items?: OrderItem[] | null;
};

const NO_PICKUP_ADDRESS = "no shop pickup address";
const RETURN_LABELS_BY_CODE: Record<string, string> = {
  RETURNSTORE: "Retur til butikk",
  RETURNREC: "Retur til gjenvinningsstasjon",
};

function normalizePhone(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";

  return hasPlus ? `+${digits}` : digits;
}

function normalizePhones(...values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => normalizePhone(value)).filter((value) => value.length > 0)));
}

function normalizePickupAddress(value?: string | null) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return "";
  }

  return normalized.toLocaleLowerCase() === NO_PICKUP_ADDRESS ? "" : normalized;
}

function formatLiftForDescription(value?: string | null) {
  return value?.trim().toLowerCase() === "yes" ? "Ja" : "No";
}

function buildLocationDetails(order: GsmOrderInput) {
  return [
    `Heis - ${formatLiftForDescription(order.lift)}`,
    order.floorNo?.trim() ? `Etasje - ${order.floorNo.trim()}` : null,
  ].filter((value): value is string => value !== null);
}

function getRawDataString(rawData: unknown, key: string) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return null;
  }

  const record = rawData as Record<string, unknown>;
  const value = record[key];

  return typeof value === "string" ? value.trim() : null;
}

function getItemOptionCode(item: OrderItem) {
  return (
    item.optionCode?.trim() ||
    getRawDataString(item.rawData, "mappedOptionCode") ||
    getRawDataString(item.rawData, "code") ||
    ""
  ).toUpperCase();
}

function getGsmSummaryItems(items: OrderItem[]) {
  return items.map((item) => {
    const returnLabel = RETURN_LABELS_BY_CODE[getItemOptionCode(item)];

    if (!returnLabel) {
      return item;
    }

    return {
      ...item,
      optionLabel: returnLabel,
      rawData: {
        ...(item.rawData && typeof item.rawData === "object" && !Array.isArray(item.rawData)
          ? (item.rawData as Record<string, unknown>)
          : {}),
        description: returnLabel,
        label: returnLabel,
      },
    };
  });
}

function buildDescription(order: GsmOrderInput) {
  const summaryGroups =
    order.items && order.items.length > 0
      ? buildOrderSummaryGroups(getGsmSummaryItems(order.items))
      : buildLegacyOrderSummaryGroups({
          productsSummary: order.productsSummary,
          deliveryTypeSummary: order.deliveryTypeSummary,
          servicesSummary: order.servicesSummary,
        });

  return [formatOrderSummaryText(summaryGroups), ...buildLocationDetails(order), order.description?.trim(), order.customerComments?.trim(), order.driverInfo?.trim(), order.statusNotes?.trim()]
    .filter((value): value is string => !!value)
    .join("\n");
}

function getTimeWindowIso(order: GsmOrderInput) {
  if (!order.deliveryDate) {
    return { complete_after: undefined, complete_before: undefined };
  }

  const date = order.deliveryDate.trim();
  const windowValue = (order.timeWindow ?? "").trim();

  const match = windowValue.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);

  const start = match ? `${String(Number(match[1])).padStart(2, "0")}:${match[2]}:00` : "06:00:00";
  const end = match ? `${String(Number(match[3])).padStart(2, "0")}:${match[4]}:00` : "06:05:00";

  const completeAfter = new Date(`${date}T${start}+02:00`).toISOString();
  const completeBefore = new Date(`${date}T${end}+02:00`).toISOString();

  return {
    complete_after: completeAfter,
    complete_before: completeBefore,
  };
}

function getRawDataCategory(rawData: unknown) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return null;
  }

  const record = rawData as Record<string, unknown>;
  const category = record.category;

  return typeof category === "string" ? category.trim().toLowerCase() : null;
}

function getRawProductCardDeliveryType(item: OrderItem) {
  return getRawDataString(item.rawData, "deliveryType");
}

function matchesDeliveryType(value: string | null | undefined, matches: string[]) {
  const normalized = (value ?? "").trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return matches.some((match) => normalized === match || normalized.includes(match));
}

function itemMatchesDeliveryType(item: OrderItem, matches: string[]) {
  return (
    matchesDeliveryType(item.deliveryType, matches) ||
    matchesDeliveryType(getRawProductCardDeliveryType(item), matches) ||
    matchesDeliveryType(item.optionCode, matches) ||
    matchesDeliveryType(getRawDataString(item.rawData, "code"), matches) ||
    matchesDeliveryType(getRawDataString(item.rawData, "mappedOptionCode"), matches)
  );
}

function normalizeDeliveryTypeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function isDropOffDeliveryType(value?: string | null) {
  const deliveryType = normalizeDeliveryTypeText(value);

  return (
    deliveryType === "indoor" ||
    deliveryType === "first_step" ||
    deliveryType.includes("innb") ||
    deliveryType.includes("første") ||
    deliveryType.includes("forste") ||
    deliveryType.includes("first step")
  );
}

function isAssignmentDeliveryType(value?: string | null) {
  const deliveryType = normalizeDeliveryTypeText(value);

  return (
    deliveryType === "install_only" ||
    deliveryType.includes("install") ||
    deliveryType.includes("montering")
  );
}

function hasMontering(order: GsmOrderInput) {
  return (
    order.items?.some((item) =>
      item.itemType === "INSTALL_OPTION" ||
      getRawDataCategory(item.rawData) === "install",
    ) ?? false
  );
}

function getDeliveryTaskCategory(order: GsmOrderInput): GsmTask["category"] {
  const productCardItems = order.items?.filter(
    (item) => item.itemType === "PRODUCT_CARD",
  ) ?? [];

  if (hasMontering(order)) {
    return "assignment";
  }

  if (
    productCardItems.some((item) =>
      itemMatchesDeliveryType(item, [
        "install_only",
        "kun installasjon/montering",
      ]),
    )
  ) {
    return "assignment";
  }

  if (
    productCardItems.some((item) =>
      itemMatchesDeliveryType(item, [
        "returnin",
        "return_only",
        "kun retur",
        "return only",
      ]),
    )
  ) {
    return "pick_up";
  }

  if (
    productCardItems.some((item) =>
      itemMatchesDeliveryType(item, [
        "first_step",
        "første",
        "fÃ¸rste",
        "forste",
        "first step",
        "indoor",
        "innb",
      ]),
    )
  ) {
    return "drop_off";
  }

  return "drop_off";
}

export function buildOrderPayload(order: GsmOrderInput): GsmOrderPayload {
  const account = process.env.GSM_ACCOUNT_URL;

  if (!account) {
    throw new Error("Missing GSM_ACCOUNT_URL");
  }

  const description = buildDescription(order) || "Delivery";
  const timeWindow = getTimeWindowIso(order);

  const customerContact: GsmContact = {
    name: order.customerName?.trim() ? `Kunde: ${order.customerName.trim()}` : undefined,
    emails: order.email ? [order.email.trim()] : [],
    phones: normalizePhones(order.phone, order.phoneTwo),
  };

  const cashierContact: GsmContact = {
    name: order.cashierName?.trim() ? `Kasserer: ${order.cashierName.trim()}` : undefined,
    phones: normalizePhones(order.cashierPhone),
  };

  const orderer: GsmContact = {
    name: order.customerLabel?.trim() || order.customerName?.trim() || undefined,
    emails: order.email ? [order.email.trim()] : [],
    phones: normalizePhones(order.phone),
  };

  const metafields: Record<string, string> = {
    "app:signature": "Jeg bekrefter at jeg har mottatt riktig vare uten synlige feil eller skader.",
    "gsmtasks:cashersname": order.cashierName?.trim() || "-",
    "gsmtasks:cashersnumber": normalizePhone(order.cashierPhone) || "-",
    "app:name": order.driver?.trim() || "-",
    "app:driver2": order.secondDriver?.trim() || "-",
    "app:carnumber": order.licensePlate?.trim() || "-",
  };

  const makeTask = (category: GsmTask["category"], rawAddress: string, contact?: GsmContact): GsmTask => ({
    account,
    category,
    address: { raw_address: rawAddress },
    contact,
    description,
    metafields,
    ...timeWindow,
  });

  const tasks: GsmTask[] = [];
  const pickupAddress = normalizePickupAddress(order.pickupAddress);

  if (pickupAddress) {
    tasks.push(makeTask("pick_up", pickupAddress, cashierContact));
  }

  for (const address of order.extraPickupAddress) {
    const value = normalizePickupAddress(address);
    if (value) {
      tasks.push(makeTask("pick_up", value, cashierContact));
    }
  }

  if (order.deliveryAddress?.trim()) {
    tasks.push(makeTask(getDeliveryTaskCategory(order), order.deliveryAddress.trim(), customerContact));
  }

  if (order.returnAddress?.trim()) {
    tasks.push(makeTask("drop_off", order.returnAddress.trim(), orderer));
  }

  if (tasks.length === 0) {
    throw new Error("No GSM tasks could be built for this order");
  }

  return {
    account,
    reference: order.orderNumber?.trim() ? `ID${order.displayId} / ${order.orderNumber.trim()}` : `ID${order.displayId}`,
    external_id: `order:${order.id}`,
    orderer,
    tasks_data: tasks,
    metafields,
  };
}

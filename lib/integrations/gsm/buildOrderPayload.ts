// path: lib/integrations/gsm/buildOrderPayload.ts
import type { Order, OrderItem } from "@prisma/client";
import { buildLegacyOrderSummaryGroups, buildOrderSummaryGroups, formatOrderSummaryText } from "@/lib/orders/orderSummary";

type GsmContact = {
  name?: string;
  emails?: string[];
  phones?: string[];
};

type GsmLocation = { type: "Point"; coordinates: [number, number] };

type GsmTask = {
  account: string;
  category: "pick_up" | "drop_off" | "assignment";
  address: { raw_address: string; location?: GsmLocation };
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
const WORDPRESS_ORDER_PRICES_PRODUCT_NAME = "WordPress order prices";
const RETURN_TO_STORE_CODE = "RETURNSTORE";
const RETURN_TO_STORE_NOTICE = "❗Retur til butikk❗";
const RETURN_LABELS_BY_CODE: Record<string, string> = {
  [RETURN_TO_STORE_CODE]: RETURN_TO_STORE_NOTICE,
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

// Pins the task at an exact coordinate instead of leaving GSM to geocode
// `raw_address` on its own — the two are sent together so the driver still
// sees a readable address even where GSM's own geocoder would land somewhere
// else entirely (the original motivation: a correct address text arriving in
// the wrong city once GSM re-geocoded it).
function toGsmLocation(latitude?: number | null, longitude?: number | null): GsmLocation | undefined {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return undefined;
  }

  return { type: "Point", coordinates: [longitude, latitude] };
}

// extraPickupContacts stores the full ExtraPickupInput[] the order was
// created/edited with, in the same order as extraPickupAddress — so a given
// pickup's coordinates (and, when it came from a saved warehouse address, its
// phone) live at the same array index, not matched by address text (which
// can repeat, e.g. two placeholder entries).
function getExtraPickupCoordinates(
  extraPickupContacts: unknown,
  index: number,
): { latitude: number | null; longitude: number | null; customPickupAddressPhone: string | null } | null {
  if (!Array.isArray(extraPickupContacts)) {
    return null;
  }

  const entry = extraPickupContacts[index];

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const record = entry as Record<string, unknown>;

  return {
    latitude: typeof record.latitude === "number" ? record.latitude : null,
    longitude: typeof record.longitude === "number" ? record.longitude : null,
    customPickupAddressPhone:
      typeof record.customPickupAddressPhone === "string" ? record.customPickupAddressPhone : null,
  };
}

// Appends the saved warehouse's phone as its own description line, only when
// the task's address actually came from a saved custom pickup/return address
// with a phone on file — never for a manually-typed address.
function appendWarehousePhoneNote(description: string, phone: string | null | undefined) {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    return description;
  }

  return [description, `Telefon lager: ${normalized}`].filter((value) => value.length > 0).join("\n\n");
}

function normalizeLiftForDescription(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "yes") return "Ja";
  if (normalized === "no") return "Nei";
  return "Nei";
}

function formatLiftForDescription(value?: string | null) {
  return normalizeLiftForDescription(value);
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

function isWordpressOrderPriceItem(item: OrderItem) {
  return item.productName?.trim() === WORDPRESS_ORDER_PRICES_PRODUCT_NAME;
}

function isWordpressKmPriceItem(item: OrderItem) {
  if (!isWordpressOrderPriceItem(item)) {
    return false;
  }

  const label = (
    getRawDataString(item.rawData, "label") ||
    getRawDataString(item.rawData, "description") ||
    item.optionLabel ||
    item.optionCode ||
    ""
  ).trim().toLowerCase();

  return label === "km pris";
}

function getGsmSummaryItems(items: OrderItem[]) {
  const summaryItems = items.map((item) => {
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

  const wordpressOrderPriceCardsWithVisibleRows = new Set<number>();

  for (const item of summaryItems) {
    if (
      isWordpressOrderPriceItem(item) &&
      item.itemType !== "PRODUCT_CARD" &&
      !isWordpressKmPriceItem(item)
    ) {
      wordpressOrderPriceCardsWithVisibleRows.add(item.cardId);
    }
  }

  return summaryItems.filter((item) => {
    if (!isWordpressOrderPriceItem(item)) {
      return true;
    }

    if (item.itemType === "PRODUCT_CARD") {
      return wordpressOrderPriceCardsWithVisibleRows.has(item.cardId);
    }

    return !isWordpressKmPriceItem(item);
  });
}

function hasReturnToStore(order: GsmOrderInput) {
  return order.items?.some(
    (item) => getItemOptionCode(item) === RETURN_TO_STORE_CODE,
  ) ?? false;
}

function buildDriverInfo(order: GsmOrderInput) {
  const driverInfo = order.driverInfo?.trim() ?? "";

  if (!hasReturnToStore(order) || driverInfo.includes(RETURN_TO_STORE_NOTICE)) {
    return driverInfo;
  }

  return [driverInfo, RETURN_TO_STORE_NOTICE]
    .filter((value) => value.length > 0)
    .join("\n");
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

  const summaryBlock = [formatOrderSummaryText(summaryGroups), ...buildLocationDetails(order)]
    .filter((value): value is string => !!value)
    .join("\n");
  return [summaryBlock, order.description?.trim(), order.customerComments?.trim(), order.statusNotes?.trim(), buildDriverInfo(order)]
    .filter((value): value is string => !!value)
    .join("\n\n");
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
    name: order.cashierName?.trim() || undefined,
    phones: normalizePhones(order.cashierPhone),
  };

  const orderer: GsmContact = {
    name: order.customerLabel?.trim() || order.customerName?.trim() || undefined,
    emails: [],
    phones: normalizePhones(order.cashierPhone),
  };

  const metafields: Record<string, string> = {
    "app:signature": "Jeg bekrefter at jeg har mottatt riktig vare uten synlige feil eller skader.",
    "gsmtasks:cashersname": order.cashierName?.trim() || "-",
    "gsmtasks:cashersnumber": normalizePhone(order.cashierPhone) || "-",
    "app:name": order.driver?.trim() || "-",
    "app:driver2": order.secondDriver?.trim() || "-",
    "app:carnumber": order.licensePlate?.trim() || "-",
  };

  const makeTask = (
    category: GsmTask["category"],
    rawAddress: string,
    options: {
      contact?: GsmContact;
      metafields?: Record<string, string>;
      location?: GsmLocation;
      description?: string;
    } = {},
  ): GsmTask => ({
    account,
    category,
    address: options.location ? { raw_address: rawAddress, location: options.location } : { raw_address: rawAddress },
    contact: options.contact,
    description: options.description ?? description,
    metafields: options.metafields ?? metafields,
    ...timeWindow,
  });

  const tasks: GsmTask[] = [];
  const pickupAddress = normalizePickupAddress(order.pickupAddress);

  if (pickupAddress) {
    tasks.push(
      makeTask("pick_up", pickupAddress, {
        contact: cashierContact,
        location: toGsmLocation(order.pickupLatitude, order.pickupLongitude),
        description: appendWarehousePhoneNote(description, order.customPickupAddressPhone),
      }),
    );
  }

  for (const [index, address] of order.extraPickupAddress.entries()) {
    const value = normalizePickupAddress(address);
    if (value) {
      const coordinate = getExtraPickupCoordinates(order.extraPickupContacts, index);
      tasks.push(
        makeTask("pick_up", value, {
          contact: cashierContact,
          location: toGsmLocation(coordinate?.latitude, coordinate?.longitude),
          description: appendWarehousePhoneNote(description, coordinate?.customPickupAddressPhone),
        }),
      );
    }
  }

  if (order.deliveryAddress?.trim()) {
    const deliveryCategory = getDeliveryTaskCategory(order);
    const googleReviewQrUrl = process.env.GOOGLE_REVIEW_QR_URL?.trim();
    const deliveryMetafields =
      googleReviewQrUrl && deliveryCategory !== "pick_up"
        ? { ...metafields, "app:qr_link": googleReviewQrUrl }
        : metafields;

    tasks.push(
      makeTask(deliveryCategory, order.deliveryAddress.trim(), {
        contact: customerContact,
        metafields: deliveryMetafields,
        location: toGsmLocation(order.deliveryLatitude, order.deliveryLongitude),
      }),
    );
  }

  if (order.returnAddress?.trim()) {
    tasks.push(
      makeTask("drop_off", order.returnAddress.trim(), {
        contact: orderer,
        location: toGsmLocation(order.returnLatitude, order.returnLongitude),
        description: appendWarehousePhoneNote(description, order.customReturnAddressPhone),
      }),
    );
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

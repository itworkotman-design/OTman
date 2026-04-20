// path: lib/integrations/gsm/buildOrderPayload.ts
import type { Order, OrderItem } from "@prisma/client";
import {
  buildLegacyOrderSummaryGroups,
  buildOrderSummaryGroups,
  formatOrderSummaryText,
} from "@/lib/orders/orderSummary";

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

function normalizePhone(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";

  return hasPlus ? `+${digits}` : digits;
}

function normalizePhones(...values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizePhone(value))
        .filter((value) => value.length > 0),
    ),
  );
}

function hasMontering(order: GsmOrderInput) {
  return !!order.servicesSummary?.trim();
}

function normalizePickupAddress(value?: string | null) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return "";
  }

  return normalized.toLocaleLowerCase() === NO_PICKUP_ADDRESS ? "" : normalized;
}

function buildDescription(order: GsmOrderInput) {
  const summaryGroups =
    order.items && order.items.length > 0
      ? buildOrderSummaryGroups(order.items)
      : buildLegacyOrderSummaryGroups({
          productsSummary: order.productsSummary,
          deliveryTypeSummary: order.deliveryTypeSummary,
          servicesSummary: order.servicesSummary,
        });

  return [
    formatOrderSummaryText(summaryGroups),
    order.description?.trim(),
    order.customerComments?.trim(),
    order.driverInfo?.trim(),
    order.statusNotes?.trim(),
  ]
    .filter((value): value is string => !!value)
    .join("\n");
}

function getTimeWindowIso(order: GsmOrderInput) {
  if (!order.deliveryDate) {
    return { complete_after: undefined, complete_before: undefined };
  }

  const date = order.deliveryDate.trim();
  const windowValue = (order.timeWindow ?? "").trim();

  const match = windowValue.match(
    /^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/,
  );

  const start = match
    ? `${String(Number(match[1])).padStart(2, "0")}:${match[2]}:00`
    : "06:00:00";
  const end = match
    ? `${String(Number(match[3])).padStart(2, "0")}:${match[4]}:00`
    : "06:05:00";

  const completeAfter = new Date(`${date}T${start}+02:00`).toISOString();
  const completeBefore = new Date(`${date}T${end}+02:00`).toISOString();

  return {
    complete_after: completeAfter,
    complete_before: completeBefore,
  };
}

export function buildOrderPayload(order: GsmOrderInput): GsmOrderPayload {
  const account = process.env.GSM_ACCOUNT_URL;

  if (!account) {
    throw new Error("Missing GSM_ACCOUNT_URL");
  }

  const description = buildDescription(order) || "Delivery";
  const timeWindow = getTimeWindowIso(order);

  const customerContact: GsmContact = {
    name: order.customerName?.trim()
      ? `Kunde: ${order.customerName.trim()}`
      : undefined,
    emails: order.email ? [order.email.trim()] : [],
    phones: normalizePhones(order.phone, order.phoneTwo),
  };

  const cashierContact: GsmContact = {
    name: order.cashierName?.trim()
      ? `Kasserer: ${order.cashierName.trim()}`
      : undefined,
    phones: normalizePhones(order.cashierPhone),
  };

  const orderer: GsmContact = {
    name:
      order.customerLabel?.trim() || order.customerName?.trim() || undefined,
    emails: order.email ? [order.email.trim()] : [],
    phones: normalizePhones(order.phone),
  };

  const metafields: Record<string, string> = {
    "app:signature":
      "Jeg bekrefter at jeg har mottatt riktig vare uten synlige feil eller skader.",
    "gsmtasks:cashersname": order.cashierName?.trim() || "-",
    "gsmtasks:cashersnumber": normalizePhone(order.cashierPhone) || "-",
    "app:name": order.driver?.trim() || "-",
    "app:driver2": order.secondDriver?.trim() || "-",
    "app:carnumber": order.licensePlate?.trim() || "-",
  };

  const makeTask = (
    category: GsmTask["category"],
    rawAddress: string,
    contact?: GsmContact,
  ): GsmTask => ({
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
    tasks.push(
      makeTask(
        hasMontering(order) ? "assignment" : "drop_off",
        order.deliveryAddress.trim(),
        customerContact,
      ),
    );
  }

  if (order.returnAddress?.trim()) {
    tasks.push(makeTask("drop_off", order.returnAddress.trim(), orderer));
  }

  if (tasks.length === 0) {
    throw new Error("No GSM tasks could be built for this order");
  }

  return {
    account,
    reference: order.orderNumber?.trim()
      ? `ID${order.displayId} / ${order.orderNumber.trim()}`
      : `ID${order.displayId}`,
    external_id: `order:${order.id}`,
    orderer,
    tasks_data: tasks,
    metafields,
  };
}

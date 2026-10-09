import { parseTimeWindowValue } from "@/lib/booking/timeWindows";
import { addDaysIso, getOsloDateKey, parseIsoDate } from "@/lib/dates/isoDate";
import { isNorwegianPublicHoliday } from "@/lib/dates/norwayHolidays";
import { isOrderClosedForCustomer } from "@/lib/customerAccounts/accountLifetime";
import type { AdminPickupStop } from "./websiteOrderDetailsEdit";

// What a customer may change on their own homepage order from "My order"
// (app/api/customer/orders/[orderNumber]). Contact info, notes and add-ons /
// delivery type on products already in the order can be changed whenever the
// order is open — e.g. adding unpacking while the crew is at the door. The
// date, addresses and which products (and how many) only until 24h before
// the time window starts. The server checks every request against this; the
// page's locked sections are only a convenience.

const OSLO = "Europe/Oslo";
const DAY_MS = 24 * 60 * 60 * 1000;

// The UTC offset (ms) Oslo has at `instant`.
function osloOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OSLO,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// Oslo wall-clock date + "HH:MM" → the real instant.
function osloWallTime(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle the offset next to a DST switch.
  let instant = wallAsUtc - osloOffsetMs(new Date(wallAsUtc));
  instant = wallAsUtc - osloOffsetMs(new Date(instant));
  return new Date(instant);
}

// When the time window starts: a preset or custom window's from-time; a
// free-text or missing window counts as the start of the day.
function windowStart(timeWindow: string | null | undefined): string {
  const selection = parseTimeWindowValue(timeWindow);
  const from = selection.selectedTimeWindow === "custom" ? selection.customTimeFrom : selection.selectedTimeWindow.split("-")[0];
  return /^\d{2}:\d{2}$/.test(from ?? "") ? from : "00:00";
}

function validDateKey(deliveryDate: string | null | undefined): string | null {
  const value = deliveryDate?.trim() ?? "";
  return parseIsoDate(value) ? value : null;
}

// 24h before the time window starts (Oslo time). null = the order has no
// date yet, so nothing is locked by time.
export function getEditCutoff(deliveryDate: string | null | undefined, timeWindow: string | null | undefined): Date | null {
  const dateKey = validDateKey(deliveryDate);
  if (!dateKey) return null;
  return new Date(osloWallTime(dateKey, windowStart(timeWindow)).getTime() - DAY_MS);
}

export type CustomerEditPermissions = {
  // Not completed/cancelled/failed/invoiced/paid.
  open: boolean;
  // Open and more than 24h before the time window starts.
  beforeCutoff: boolean;
  cutoffAt: Date | null;
  // Only homepage white-goods orders are priced from the website catalog;
  // moving and special-goods orders have no products/addresses to edit.
  canEditItems: boolean;
};

export function getCustomerEditPermissions(
  order: { status: string | null; deliveryDate: string | null; timeWindow: string | null; websiteOrderKind: string | null },
  now: Date = new Date(),
): CustomerEditPermissions {
  const open = !isOrderClosedForCustomer(order.status);
  const cutoffAt = getEditCutoff(order.deliveryDate, order.timeWindow);
  return {
    open,
    beforeCutoff: open && (cutoffAt === null || now.getTime() < cutoffAt.getTime()),
    cutoffAt,
    canEditItems: order.websiteOrderKind === "WHITE_GOODS",
  };
}

// A day the booking calendar offers: from tomorrow (Oslo), no Sundays or
// public holidays. What a new homepage order is held to on the server.
export function isBookableDeliveryDate(deliveryDate: string, now: Date = new Date()): boolean {
  const dateKey = validDateKey(deliveryDate);
  if (!dateKey) return false;
  if (dateKey < addDaysIso(getOsloDateKey(now), 1)) return false;
  return !(new Date(`${dateKey}T12:00:00Z`).getUTCDay() === 0 || isNorwegianPublicHoliday(dateKey));
}

// A new date/time the customer picks: a day the booking calendar offers
// (from tomorrow, no Sundays or public holidays) and still more than 24h
// away, or it would be locked the moment it's saved.
export function isAllowedNewSchedule(deliveryDate: string, timeWindow: string, now: Date = new Date()): boolean {
  if (!isBookableDeliveryDate(deliveryDate, now)) return false;
  const cutoff = getEditCutoff(deliveryDate.trim(), timeWindow);
  return cutoff !== null && now.getTime() < cutoff.getTime();
}

export type CustomerEditKind =
  | "contact"
  | "notes"
  | "schedule"
  | "addresses"
  // Only services added to a product (an add-on, return, dismantling, doorstep
  // → carry-in) — what the customer may still do after the 24h cutoff.
  | "addOns"
  // Anything else about a product's setup (removing/swapping a service,
  // another delivery type) — locked after the cutoff.
  | "reconfigure"
  | "addProduct"
  | "removeProduct"
  | "quantity";

// Product cards as far as this check cares: which product, how many, and
// everything else (delivery type, add-ons…) as the configuration.
export type CustomerEditCard = {
  cardId: number;
  productId: string | null;
  amount: number;
  [config: string]: unknown;
};

// The order as the customer can see/edit it. Pickups, delivery and cards are
// only there for white-goods orders — and left out of an edit that doesn't
// touch them.
export type CustomerEditState = {
  customer: { name: string; phone: string; email: string; comments: string };
  preferredDate: string;
  timeWindow: string;
  pickups?: AdminPickupStop[];
  delivery?: { address: string; floor: number | null; liftAvailable: boolean };
  cards?: CustomerEditCard[];
};

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// A stop's route part (where, which floor, which products are collected
// there) — its contact person counts as contact info, and productNames are
// only display text.
function stopRoute(stop: AdminPickupStop) {
  return {
    source: stop.source,
    placeName: stop.placeName,
    address: stop.address,
    floor: stop.floor,
    liftAvailable: stop.liftAvailable,
    cardIds: [...(stop.cardIds ?? [])].sort((a, b) => a - b),
  };
}

const CARD_IDENTITY = new Set(["cardId", "productId", "amount"]);

function cardConfig(card: CustomerEditCard) {
  return Object.fromEntries(
    Object.entries(card)
      .filter(([key]) => !CARD_IDENTITY.has(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

// Delivery types in increasing service — moving up the list only adds work.
const DELIVERY_UPGRADES: Record<string, string[]> = { FIRST_STEP: ["INDOOR"] };

// Whether `after` only adds to `before`: every list a superset, a return /
// dismantling only switched on, the delivery type the same or an upgrade, and
// every other setting untouched.
function onlyAddsServices(before: CustomerEditCard, after: CustomerEditCard): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)].filter((key) => !CARD_IDENTITY.has(key)));
  for (const key of keys) {
    const was = before[key];
    const now = after[key];
    if (same(was, now)) continue;
    if (key === "deliveryType") {
      if (!(typeof was === "string" && typeof now === "string" && DELIVERY_UPGRADES[was]?.includes(now))) return false;
      continue;
    }
    if (key === "selectedReturnOptionId") {
      if (was !== null && was !== undefined && was !== "") return false;
      continue;
    }
    if (key === "demontEnabled") {
      if (!(was !== true && now === true)) return false;
      continue;
    }
    if (Array.isArray(now) && (was === undefined || Array.isArray(was))) {
      const previous = (was as unknown[] | undefined) ?? [];
      if (!previous.every((item) => now.some((candidate) => same(candidate, item)))) return false;
      continue;
    }
    return false;
  }
  return true;
}

export function classifyCustomerOrderEdit(before: CustomerEditState, after: CustomerEditState): CustomerEditKind[] {
  const kinds = new Set<CustomerEditKind>();

  const { comments: beforeComments, ...beforeContact } = before.customer;
  const { comments: afterComments, ...afterContact } = after.customer;
  if (!same(beforeContact, afterContact)) kinds.add("contact");
  if (beforeComments !== afterComments) kinds.add("notes");
  if (before.preferredDate !== after.preferredDate || before.timeWindow !== after.timeWindow) kinds.add("schedule");

  if (after.pickups !== undefined) {
    const beforePickups = before.pickups ?? [];
    if (!same(beforePickups.map(stopRoute), after.pickups.map(stopRoute))) kinds.add("addresses");
    const contacts = (stops: AdminPickupStop[]) => stops.map((s) => [s.contactName, s.contactPhone]);
    if (beforePickups.length === after.pickups.length && !same(contacts(beforePickups), contacts(after.pickups))) {
      kinds.add("contact");
    }
  }
  if (after.delivery !== undefined && !same(before.delivery, after.delivery)) kinds.add("addresses");

  if (after.cards !== undefined) {
    const beforeById = new Map((before.cards ?? []).map((card) => [card.cardId, card]));
    const afterIds = new Set(after.cards.map((card) => card.cardId));
    for (const card of after.cards) {
      const original = beforeById.get(card.cardId);
      if (!original) {
        kinds.add("addProduct");
      } else if (original.productId !== card.productId) {
        kinds.add("addProduct");
        kinds.add("removeProduct");
      } else {
        if (original.amount !== card.amount) kinds.add("quantity");
        if (!same(cardConfig(original), cardConfig(card))) kinds.add(onlyAddsServices(original, card) ? "addOns" : "reconfigure");
      }
    }
    if ([...beforeById.keys()].some((id) => !afterIds.has(id))) kinds.add("removeProduct");
  }

  const order: CustomerEditKind[] = ["contact", "notes", "schedule", "addresses", "addOns", "reconfigure", "addProduct", "removeProduct", "quantity"];
  return order.filter((kind) => kinds.has(kind));
}

const ALWAYS_ALLOWED = new Set<CustomerEditKind>(["contact", "notes", "addOns"]);
const ITEM_KINDS = new Set<CustomerEditKind>(["addresses", "addOns", "reconfigure", "addProduct", "removeProduct", "quantity"]);

export function findForbiddenChanges(kinds: CustomerEditKind[], permissions: CustomerEditPermissions): CustomerEditKind[] {
  return kinds.filter((kind) => {
    if (!permissions.open) return true;
    if (!permissions.canEditItems && ITEM_KINDS.has(kind)) return true;
    return !permissions.beforeCutoff && !ALWAYS_ALLOWED.has(kind);
  });
}

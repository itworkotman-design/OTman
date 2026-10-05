import { getOrderChargeAmountIncVatNok, parseNokAdjustment, roundNok } from "./orderTotals";
import { parseWhiteGoodsBookingDetails, withLiveOrderFields, type WhiteGoodsBookingDetails } from "./websiteBookingDetails";
import { groupPricingLinesByCard, pricingLinesFromSnapshot } from "./websiteOrderProducts";

// What an order looked like when the customer paid for it — stored on each
// OrderPayment (orderSnapshot) by the Stripe webhook — and how the order as it
// is now compares to that: which priced lines and which stops/dates changed,
// and whether the customer owes more or is due a refund. Both sides are built
// by the same buildOrderStateSnapshot, so they compare like for like.
//
// Amounts are what the customer is charged (getOrderChargeAmountIncVatNok);
// for homepage orders the lines are the VAT-inclusive catalog prices.

export type OrderStateLine = { key: string; group: string; label: string; qty: number; price: number };
// Keys: pickup.<n>.address|place|floor|lift|contact, delivery.address|floor|lift,
// date, timeWindow, distance. Values are raw ("3", "yes"); the UI labels them.
export type OrderStateDetail = { key: string; value: string };

export type OrderStateSnapshot = {
  version: 1;
  totalIncVatNok: number;
  lines: OrderStateLine[];
  details: OrderStateDetail[];
};

// Group of the order-level extras (floor surcharge, distance, extra pickups…)
// and of the manual discount/surcharge lines.
export const EXTRAS_GROUP = "extras";
export const ADJUSTMENT_GROUP = "adjustment";

export type OrderStateSource = {
  priceExVat: number;
  rabatt: string | null;
  leggTil: string | null;
  pricingSnapshot: unknown;
  websiteOrderKind: string | null;
  websiteBookingDetails: unknown;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  extraPickupAddress: string[];
  deliveryDate: string | null;
  timeWindow: string | null;
  drivingDistance: string | null;
};

function makeLine(group: string, label: string, qty: number, price: number): OrderStateLine {
  return { key: `${group}::${label}`, group, label, qty, price: roundNok(price) };
}

function floorValue(floor: number | null): string {
  return floor === null ? "" : String(floor);
}

function detailsOf(details: WhiteGoodsBookingDetails | null, order: OrderStateSource): OrderStateDetail[] {
  const out: OrderStateDetail[] = [];
  if (details) {
    details.pickups.forEach((stop, i) => {
      const n = i + 1;
      out.push(
        { key: `pickup.${n}.address`, value: stop.address },
        { key: `pickup.${n}.place`, value: stop.placeName },
        { key: `pickup.${n}.floor`, value: floorValue(stop.floor) },
        { key: `pickup.${n}.lift`, value: stop.source === "store" ? "" : stop.liftAvailable ? "yes" : "no" },
        { key: `pickup.${n}.contact`, value: [stop.contactName, stop.contactPhone].filter(Boolean).join(", ") },
      );
    });
    out.push(
      { key: "delivery.address", value: details.delivery.address },
      { key: "delivery.floor", value: floorValue(details.delivery.floor) },
      { key: "delivery.lift", value: details.delivery.liftAvailable ? "yes" : "no" },
      { key: "date", value: details.preferredDate },
      { key: "timeWindow", value: details.timeWindow },
      { key: "distance", value: details.drivingDistance },
    );
    return out;
  }
  // An order without booking details: just its own columns.
  [order.pickupAddress ?? "", ...order.extraPickupAddress].forEach((address, i) =>
    out.push({ key: `pickup.${i + 1}.address`, value: address }),
  );
  out.push(
    { key: "delivery.address", value: order.deliveryAddress ?? "" },
    { key: "date", value: order.deliveryDate ?? "" },
    { key: "timeWindow", value: order.timeWindow ?? "" },
    { key: "distance", value: order.drivingDistance ?? "" },
  );
  return out;
}

export function buildOrderStateSnapshot(order: OrderStateSource): OrderStateSnapshot {
  const booked = parseWhiteGoodsBookingDetails(order.websiteBookingDetails);
  const details = booked
    ? withLiveOrderFields(booked, {
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        extraPickupAddress: order.extraPickupAddress,
        deliveryDate: order.deliveryDate,
        timeWindow: order.timeWindow,
        drivingDistance: order.drivingDistance,
      })
    : null;

  const lines: OrderStateLine[] = [];
  for (const group of groupPricingLinesByCard(pricingLinesFromSnapshot(order.pricingSnapshot))) {
    for (const item of group.items) lines.push(makeLine(group.productName, item.label, item.qty, item.price));
  }
  for (const extra of details?.orderExtras ?? []) lines.push(makeLine(EXTRAS_GROUP, extra.label, extra.qty, extra.price));
  const discount = parseNokAdjustment(order.rabatt);
  if (discount) lines.push(makeLine(ADJUSTMENT_GROUP, "discount", 1, -discount));
  const surcharge = parseNokAdjustment(order.leggTil);
  if (surcharge) lines.push(makeLine(ADJUSTMENT_GROUP, "surcharge", 1, surcharge));

  return {
    version: 1,
    totalIncVatNok: getOrderChargeAmountIncVatNok(order),
    lines: mergeLines(lines),
    details: detailsOf(details, order),
  };
}

// Same product + label twice (e.g. two cards of one product) is one line.
function mergeLines(lines: OrderStateLine[]): OrderStateLine[] {
  const byKey = new Map<string, OrderStateLine>();
  for (const line of lines) {
    const existing = byKey.get(line.key);
    if (existing) {
      existing.qty += line.qty;
      existing.price = roundNok(existing.price + line.price);
    } else {
      byKey.set(line.key, { ...line });
    }
  }
  return [...byKey.values()];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

// Reads a stored OrderPayment.orderSnapshot back; null for anything that isn't
// a well-formed version-1 snapshot.
export function parseOrderStateSnapshot(value: unknown): OrderStateSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || !isNum(v.totalIncVatNok) || !Array.isArray(v.lines) || !Array.isArray(v.details)) return null;
  const lines = v.lines.filter(
    (l): l is OrderStateLine =>
      !!l && typeof l === "object" && isStr(l.key) && isStr(l.group) && isStr(l.label) && isNum(l.qty) && isNum(l.price),
  );
  const details = v.details.filter(
    (d): d is OrderStateDetail => !!d && typeof d === "object" && isStr(d.key) && isStr(d.value),
  );
  return {
    version: 1,
    totalIncVatNok: v.totalIncVatNok,
    lines: lines.map(({ key, group, label, qty, price }) => ({ key, group, label, qty, price })),
    details: details.map(({ key, value: detailValue }) => ({ key, value: detailValue })),
  };
}

export type OrderLineChange = {
  kind: "added" | "removed" | "changed";
  group: string;
  label: string;
  qtyBefore: number;
  qtyAfter: number;
  priceBefore: number;
  priceAfter: number;
  delta: number;
};
export type OrderDetailChange = { key: string; before: string; after: string };

export type OrderPaymentComparison = {
  // No payment yet / owes more / overpaid (refund by hand) / exactly paid.
  outcome: "unpaid" | "due" | "refund" | "settled";
  totalPaidIncVatNok: number;
  currentTotalIncVatNok: number;
  // current − paid: positive = the customer must pay this, negative = refund.
  differenceIncVatNok: number;
  // false for payments made before snapshots existed: only the amounts can be
  // compared then, not what changed.
  hasPaidSnapshot: boolean;
  paidSnapshotTotalIncVatNok: number | null;
  paidAt: string | null;
  lineChanges: OrderLineChange[];
  detailChanges: OrderDetailChange[];
};

export type PaymentForComparison = { amountChargedCents: number; createdAt: Date; orderSnapshot: unknown };

export function compareOrderWithPayments(params: {
  payments: PaymentForComparison[];
  current: OrderStateSnapshot;
}): OrderPaymentComparison {
  const { payments, current } = params;
  const totalPaidIncVatNok = roundNok(payments.reduce((sum, p) => sum + p.amountChargedCents, 0) / 100);
  const differenceIncVatNok = roundNok(current.totalIncVatNok - totalPaidIncVatNok);

  // The latest payment brought the order up to date with its snapshot.
  const latest = [...payments]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((p) => ({ payment: p, snapshot: parseOrderStateSnapshot(p.orderSnapshot) }))
    .find((entry) => entry.snapshot !== null);
  const paid = latest?.snapshot ?? null;

  const outcome: OrderPaymentComparison["outcome"] =
    payments.length === 0
      ? "unpaid"
      : differenceIncVatNok > 0
        ? "due"
        : differenceIncVatNok < 0
          ? "refund"
          : "settled";

  return {
    outcome,
    totalPaidIncVatNok,
    currentTotalIncVatNok: current.totalIncVatNok,
    differenceIncVatNok,
    hasPaidSnapshot: paid !== null,
    paidSnapshotTotalIncVatNok: paid?.totalIncVatNok ?? null,
    paidAt: latest ? latest.payment.createdAt.toISOString() : null,
    lineChanges: paid ? diffLines(paid.lines, current.lines) : [],
    detailChanges: paid ? diffDetails(paid.details, current.details) : [],
  };
}

// What changed between any two states of an order (e.g. before and after a
// customer's own edit in "My order").
export function diffOrderStates(before: OrderStateSnapshot, after: OrderStateSnapshot) {
  return { lineChanges: diffLines(before.lines, after.lines), detailChanges: diffDetails(before.details, after.details) };
}

// Changed and removed lines in the paid order's order, then added ones.
function diffLines(before: OrderStateLine[], after: OrderStateLine[]): OrderLineChange[] {
  const afterByKey = new Map(after.map((l) => [l.key, l]));
  const beforeKeys = new Set(before.map((l) => l.key));
  const changes: OrderLineChange[] = [];
  for (const b of before) {
    const a = afterByKey.get(b.key);
    if (!a) {
      changes.push({ kind: "removed", group: b.group, label: b.label, qtyBefore: b.qty, qtyAfter: 0, priceBefore: b.price, priceAfter: 0, delta: roundNok(-b.price) });
    } else if (a.qty !== b.qty || a.price !== b.price) {
      changes.push({ kind: "changed", group: b.group, label: b.label, qtyBefore: b.qty, qtyAfter: a.qty, priceBefore: b.price, priceAfter: a.price, delta: roundNok(a.price - b.price) });
    }
  }
  for (const a of after) {
    if (!beforeKeys.has(a.key)) {
      changes.push({ kind: "added", group: a.group, label: a.label, qtyBefore: 0, qtyAfter: a.qty, priceBefore: 0, priceAfter: a.price, delta: a.price });
    }
  }
  return changes;
}

function diffDetails(before: OrderStateDetail[], after: OrderStateDetail[]): OrderDetailChange[] {
  const beforeByKey = new Map(before.map((d) => [d.key, d.value]));
  const afterByKey = new Map(after.map((d) => [d.key, d.value]));
  const keys = [...new Set([...before.map((d) => d.key), ...after.map((d) => d.key)])];
  return keys
    .map((key) => ({ key, before: beforeByKey.get(key) ?? "", after: afterByKey.get(key) ?? "" }))
    .filter((change) => change.before !== change.after);
}

import type { PriceChangeRow } from "@/lib/booking/pricing/priceChanges";
import { websiteInclVat } from "@/lib/booking/pricing/websiteVat";
import { MOVING_PRODUCT_CODE, MOVING_SERVICES_PRODUCT_CODE } from "@/lib/content/movingCatalog";
import { buildOrderPricingSnapshot, clampOrderPrice, parseNokAdjustment, roundNok } from "./orderTotals";
import type { MovingOrderItem } from "./movingOrderView";
import type { WebsiteOrderCalculatorLine, WebsiteOrderCalculatorView, WebsiteOrderNulledLines } from "./websiteOrderCalculator";

// A move in the admin calculator (WebsiteOrderCalculator), the same one a
// delivery order uses: its stored lines (Order.items, movingOrderItemRows) —
// the move itself (size + services) as one product, the floor/carry
// surcharges and the km as order extras — every line with its code and its
// customer and partner price, then the discount/extra and partner minus/plus
// (Order.rabatt/leggTil/subcontractorMinus/subcontractorPlus) and the lines
// set to 0 (kept on the pricing snapshot, `movingNulledLines`).
//
// movingOrderAdjustedPricing stores exactly these totals, so the calculator
// always matches the saved price. Kroner, ex. VAT; incl. VAT per line, the
// discount and extra the same way (websiteVat.ts).

export type MovingNulledLines = { customer: string[]; subcontractor: string[] };

export type MovingAdjustments = {
  rabatt: string | null | undefined;
  leggTil: string | null | undefined;
  subcontractorMinus: string | null | undefined;
  subcontractorPlus: string | null | undefined;
  // Line keys (movingLineKey) set to 0 per side; none when left out.
  nulledLines?: MovingNulledLines;
};

const NO_NULLED: MovingNulledLines = { customer: [], subcontractor: [] };

type SnapshotLine = Parameters<typeof buildOrderPricingSnapshot>[0]["lines"][number];

const isMove = (item: Pick<MovingOrderItem, "productCode">) =>
  item.productCode === MOVING_PRODUCT_CODE || item.productCode === MOVING_SERVICES_PRODUCT_CODE;

// Which line of a move this is, the same however it's re-priced: its product
// and option code, plus the end of the move for a per-end surcharge (read
// from the label movingFloorSurchargeLines / movingCarrySurchargeLines write).
export function movingLineKey(item: Pick<MovingOrderItem, "productCode" | "optionCode" | "optionLabel">): string {
  const label = item.optionLabel ?? "";
  const end = label.includes("moving from") ? "from" : label.includes("moving to") ? "to" : undefined;
  return movingLineKeyFor(item.productCode ?? "", item.optionCode ?? "", end);
}

// The same key from its parts — for the booking flow's own lines, which have
// no stored label to read the end from.
export function movingLineKeyFor(productCode: string, optionCode: string, end?: "from" | "to"): string {
  return `${productCode}:${optionCode}${end ? `:${end}` : ""}`;
}

const kr = (cents: number | null, qty: number) => Math.round(((cents ?? 0) * qty) / 100);

export function movingOrderCalculatorView(
  items: MovingOrderItem[],
  adjustments: MovingAdjustments,
  { includePartner }: { includePartner: boolean },
): WebsiteOrderCalculatorView {
  const nulled = adjustments.nulledLines ?? NO_NULLED;
  // A line set to 0 shows 0 kr and is left out of the totals (as the delivery engine does).
  const line = (item: MovingOrderItem): WebsiteOrderCalculatorLine => {
    const lineKey = movingLineKey(item);
    const nulledCustomer = nulled.customer.includes(lineKey);
    const nulledPartner = nulled.subcontractor.includes(lineKey);
    return {
      label: item.optionLabel || item.optionCode || "",
      code: item.optionCode,
      qty: item.quantity,
      customer: nulledCustomer ? 0 : kr(item.customerPriceCents, item.quantity),
      partner: includePartner ? (nulledPartner ? 0 : kr(item.subcontractorPriceCents, item.quantity)) : null,
      lineKey,
      nulledCustomer,
      nulledPartner: includePartner && nulledPartner,
    };
  };
  const moveLines = items.filter(isMove).map(line);
  const extraLines = items.filter((item) => !isMove(item)).map(line);
  const allLines = [...moveLines, ...extraLines];

  const subtotal = allLines.reduce((sum, l) => sum + l.customer, 0);
  const discount = roundNok(parseNokAdjustment(adjustments.rabatt));
  const extra = roundNok(parseNokAdjustment(adjustments.leggTil));
  const partnerBase = items.reduce(
    (sum, item) => sum + (nulled.subcontractor.includes(movingLineKey(item)) ? 0 : kr(item.subcontractorPriceCents, item.quantity)),
    0,
  );
  const minus = roundNok(parseNokAdjustment(adjustments.subcontractorMinus));
  const plus = roundNok(parseNokAdjustment(adjustments.subcontractorPlus));

  return {
    products: [
      ...(moveLines.length > 0 ? [{ name: "Moving", isOrderExtras: false, cardId: 0, lines: moveLines }] : []),
      ...(extraLines.length > 0 ? [{ name: "Order extras", isOrderExtras: true, cardId: null, lines: extraLines }] : []),
    ],
    customer: {
      subtotal,
      discount,
      extra,
      total: roundNok(subtotal - discount + extra),
      totalIncVat: allLines.reduce((sum, l) => sum + websiteInclVat(l.customer), 0) - websiteInclVat(discount) + websiteInclVat(extra),
    },
    partner: includePartner ? { base: partnerBase, minus, plus, total: roundNok(partnerBase - minus + plus) } : null,
  };
}

// What a move stores (Order.priceExVat, priceSubcontractor, pricingSnapshot)
// for its lines and adjustments. Without adjustments this is what booking it
// stores (movingOrderPricing).
export function movingOrderAdjustedPricing(rows: (MovingOrderItem & SnapshotLine)[], adjustments: MovingAdjustments) {
  const view = movingOrderCalculatorView(rows, adjustments, { includePartner: true });
  const partner = view.partner!;
  const nulled = adjustments.nulledLines ?? NO_NULLED;
  const snapshot = buildOrderPricingSnapshot({
    lines: rows,
    rabatt: adjustments.rabatt ?? null,
    leggTil: adjustments.leggTil ?? null,
    subcontractorMinus: adjustments.subcontractorMinus ?? null,
    subcontractorPlus: adjustments.subcontractorPlus ?? null,
    fallbackCustomerTotalExVat: view.customer.total,
    fallbackSubcontractorTotal: partner.total,
    customerTotalIncVat: view.customer.totalIncVat,
  });
  const hasNulled = nulled.customer.length > 0 || nulled.subcontractor.length > 0;
  return {
    priceExVat: clampOrderPrice(view.customer.total),
    priceSubcontractor: clampOrderPrice(partner.total),
    // Its own field, not the delivery engine's order-extra keys, so the
    // booking editor never applies a move's keys to anything.
    pricingSnapshot: hasNulled ? { ...snapshot, movingNulledLines: nulled } : snapshot,
  };
}

const stringList = (value: unknown) => (Array.isArray(value) ? value.filter((key): key is string => typeof key === "string") : []);

// The move's stored discount/extra, partner minus/plus and lines set to 0.
export function movingAdjustmentsFromOrder(order: {
  rabatt: string | null;
  leggTil: string | null;
  subcontractorMinus: string | null;
  subcontractorPlus: string | null;
  pricingSnapshot: unknown;
}): MovingAdjustments & { nulledLines: MovingNulledLines } {
  const snapshot = order.pricingSnapshot && typeof order.pricingSnapshot === "object" ? (order.pricingSnapshot as Record<string, unknown>) : {};
  const stored = snapshot.movingNulledLines && typeof snapshot.movingNulledLines === "object" ? (snapshot.movingNulledLines as Record<string, unknown>) : {};
  return {
    rabatt: order.rabatt,
    leggTil: order.leggTil,
    subcontractorMinus: order.subcontractorMinus,
    subcontractorPlus: order.subcontractorPlus,
    nulledLines: { customer: stringList(stored.customer), subcontractor: stringList(stored.subcontractor) },
  };
}

// The calculator's choices (WebsiteOrderNulledLines: the move's card and its
// order extras) as one list per side — a move's line keys are unique.
export function movingNulledFromDraft(nulled: WebsiteOrderNulledLines): MovingNulledLines {
  const cards = Object.values(nulled.cards);
  return {
    customer: [...cards.flatMap((card) => card.customer), ...nulled.orderExtras.customer],
    subcontractor: [...cards.flatMap((card) => card.subcontractor), ...nulled.orderExtras.subcontractor],
  };
}

// Each line priced differently in `current` (the move's stored answers priced
// at today's catalog) than it was saved — what "Use new price" names. A line
// only on one side counts at 0 on the other. Without partner prices only the
// customer's changes are listed, without the partner's amounts.
export function movingPriceChanges(
  saved: MovingOrderItem[],
  current: MovingOrderItem[],
  { includePartner }: { includePartner: boolean },
): PriceChangeRow[] {
  const byKey = (items: MovingOrderItem[]) => new Map(items.map((item) => [movingLineKey(item), item]));
  const savedByKey = byKey(saved);
  const currentByKey = byKey(current);
  const keys = [...new Set([...savedByKey.keys(), ...currentByKey.keys()])];
  return keys.flatMap((key) => {
    const was = savedByKey.get(key);
    const now = currentByKey.get(key);
    const item = (now ?? was)!;
    const customer = (i: MovingOrderItem | undefined) => (i ? kr(i.customerPriceCents, i.quantity) : 0);
    const partner = (i: MovingOrderItem | undefined) => (i ? kr(i.subcontractorPriceCents, i.quantity) : 0);
    const customerMoved = customer(was) !== customer(now);
    const partnerMoved = partner(was) !== partner(now);
    if (!customerMoved && !(includePartner && partnerMoved)) return [];
    return [
      {
        productName: isMove(item) ? "Moving" : null,
        label: item.optionLabel || item.optionCode || "",
        saved: customer(was),
        now: customer(now),
        savedPartner: includePartner ? partner(was) : null,
        nowPartner: includePartner ? partner(now) : null,
      },
    ];
  });
}

// The customer's live price while changing their own move ("My order"): the
// lines it shows (keyed like movingLineKey) with any discount/extra staff gave
// it and its lines set to 0 — the same totals the server prices the change at.
export function movingCustomerLiveTotals(
  lines: { key: string; customerPriceCents: number }[],
  context: { rabatt: string; leggTil: string; nulledLineKeys: string[] } | null,
) {
  const nulledKeys = context?.nulledLineKeys ?? [];
  const exVat = lines.map((line) => (nulledKeys.includes(line.key) ? 0 : Math.round(line.customerPriceCents / 100)));
  const discount = roundNok(parseNokAdjustment(context?.rabatt));
  const extra = roundNok(parseNokAdjustment(context?.leggTil));
  return {
    totalExVat: roundNok(exVat.reduce((sum, amount) => sum + amount, 0) - discount + extra),
    totalIncVat: exVat.reduce((sum, amount) => sum + websiteInclVat(amount), 0) - websiteInclVat(discount) + websiteInclVat(extra),
    discount,
    extra,
    nulledKeys,
  };
}

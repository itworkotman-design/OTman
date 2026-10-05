import { deriveDiscountSync } from "@/lib/booking/pricing/discountSync";
import type { CalculatorResult } from "@/lib/booking/pricing/types";

// The calculator in WebsiteOrderModal, shown like the booking app's
// (CalculatorDisplayNew + SubcontractorCalculatorDisplay): every priced line
// with what the customer pays and what the partner gets, then each side's
// adjustments and total. Built from the same priceWebsiteOrder result the
// order is stored at, so it always matches the saved price.
//
// Website prices already include VAT, so the customer's `total` is what they
// pay (Order.priceExVat holds it as-is for WHITE_GOODS orders).

export type WebsiteOrderCalculatorLine = {
  label: string;
  code: string | null;
  qty: number;
  customer: number;
  // null when the viewer may not see partner prices.
  partner: number | null;
  // Identifies the line for the booking app's "Set to 0" checkboxes
  // (computeLineKey); null for lines that can't be set to 0.
  lineKey: string | null;
  nulledCustomer: boolean;
  nulledPartner: boolean;
};

// The "Set to 0" choices as the save sends them: per product card, and for
// the order extras (stored in the pricing snapshot).
export type WebsiteOrderNulledLines = {
  cards: Record<number, { customer: string[]; subcontractor: string[] }>;
  orderExtras: { customer: string[]; subcontractor: string[] };
};

export type WebsiteOrderCalculatorView = {
  products: { name: string; isOrderExtras: boolean; cardId: number | null; lines: WebsiteOrderCalculatorLine[] }[];
  customer: { subtotal: number; discount: number; extra: number; total: number };
  partner: { base: number; minus: number; plus: number; total: number } | null;
};

export function websiteOrderCalculatorView(
  result: CalculatorResult,
  { includePartner }: { includePartner: boolean },
): WebsiteOrderCalculatorView {
  const { totals } = result;
  return {
    products: (result.breakdowns ?? []).map((product) => ({
      name: product.productName,
      isOrderExtras: product.isOrderExtras === true,
      cardId: product.isOrderExtras ? null : (product.cardId ?? null),
      lines: product.lines.map((line) => ({
        label: line.label,
        code: line.code ?? null,
        qty: line.qty,
        customer: line.lineTotal,
        partner: includePartner ? (line.subcontractorLineTotal ?? 0) : null,
        lineKey: line.lineKey ?? null,
        nulledCustomer: line.nulledForCustomer === true,
        nulledPartner: includePartner && line.nulledForSubcontractor === true,
      })),
    })),
    customer: {
      subtotal: totals.subtotalExVat,
      discount: totals.discount + totals.checkboxDiscount,
      extra: totals.extra,
      total: totals.totalExVat,
    },
    partner: includePartner
      ? {
          base: totals.subcontractorBase,
          minus: totals.subcontractorMinus + totals.subcontractorCheckboxDiscount,
          plus: totals.subcontractorPlus,
          total: totals.subcontractorTotal,
        }
      : null,
  };
}

// The booking app's rule (BookingEditor handleAdjustmentsChange): a discount
// cuts the partner's pay by the same share — the partner minus follows the
// discount until an admin types their own.
export function partnerMinusForDiscount(input: { rabatt: string; subtotal: number; partnerBase: number }): string {
  const sync = deriveDiscountSync({
    dnbDiscount: false,
    manualRabatt: input.rabatt,
    leggTil: "",
    subtotalExVat: input.subtotal,
    subcontractorBase: input.partnerBase,
    isInitialSyncForExistingOrder: false,
  });
  return sync.skip ? "" : (sync.subcontractorMinus ?? "");
}

// The choices currently in a calculator view, in the shape a save sends.
export function nulledLinesFromView(view: WebsiteOrderCalculatorView): WebsiteOrderNulledLines {
  const nulled: WebsiteOrderNulledLines = { cards: {}, orderExtras: { customer: [], subcontractor: [] } };
  for (const product of view.products) {
    const target = product.isOrderExtras
      ? nulled.orderExtras
      : product.cardId !== null
        ? (nulled.cards[product.cardId] ??= { customer: [], subcontractor: [] })
        : null;
    if (!target) continue;
    for (const line of product.lines) {
      if (!line.lineKey) continue;
      if (line.nulledCustomer) target.customer.push(line.lineKey);
      if (line.nulledPartner) target.subcontractor.push(line.lineKey);
    }
  }
  return nulled;
}

function keyList(value: unknown): string[] | null {
  if (value === undefined) return [];
  return Array.isArray(value) && value.every((key) => typeof key === "string") ? (value as string[]) : null;
}

function sides(value: unknown): { customer: string[]; subcontractor: string[] } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const customer = keyList(v.customer);
  const subcontractor = keyList(v.subcontractor);
  return customer && subcontractor ? { customer, subcontractor } : null;
}

// A save's `nulledLines`, or null when it isn't well-formed.
export function parseNulledLines(raw: unknown): WebsiteOrderNulledLines | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const orderExtras = v.orderExtras === undefined ? { customer: [], subcontractor: [] } : sides(v.orderExtras);
  if (!orderExtras) return null;
  if (v.cards !== undefined && (!v.cards || typeof v.cards !== "object" || Array.isArray(v.cards))) return null;
  const cards: WebsiteOrderNulledLines["cards"] = {};
  for (const [cardId, value] of Object.entries((v.cards ?? {}) as Record<string, unknown>)) {
    const parsed = sides(value);
    if (!parsed || !Number.isInteger(Number(cardId))) return null;
    cards[Number(cardId)] = parsed;
  }
  return { cards, orderExtras };
}

// The calculator's unsaved changes, saved by the modal's one Save button.
export type WebsiteOrderPricingDraft = {
  adjustments: { rabatt: string; leggTil: string; subcontractorMinus: string; subcontractorPlus: string };
  nulledLines: WebsiteOrderNulledLines;
};

// The body for PUT /api/orders/[orderId]/website-items: the "Handle order"
// fields, plus the calculator's amounts and lines set to 0 when it changed.
export function websiteItemsSaveBody(
  panelHandling: Record<string, unknown>,
  draft: WebsiteOrderPricingDraft | null,
  extra: Record<string, unknown> = {},
) {
  if (!draft) return { handling: panelHandling, ...extra };
  return { handling: { ...panelHandling, ...draft.adjustments }, nulledLines: draft.nulledLines, ...extra };
}

// One checkbox click, with the booking app's rules (BookingEditor's
// toggleLineNulledFor…): the customer box drives the partner box for the same
// line (on and off), while the partner box only changes itself.
export function toggleNulledLine(
  nulled: WebsiteOrderNulledLines,
  target: { cardId: number } | { orderExtras: true },
  side: "customer" | "partner",
  lineKey: string,
  on: boolean,
): WebsiteOrderNulledLines {
  const update = (keys: string[]) => (on ? [...keys.filter((key) => key !== lineKey), lineKey] : keys.filter((key) => key !== lineKey));
  const apply = (sides: { customer: string[]; subcontractor: string[] }) => ({
    customer: side === "customer" ? update(sides.customer) : sides.customer,
    subcontractor: update(sides.subcontractor),
  });
  if ("orderExtras" in target) return { ...nulled, orderExtras: apply(nulled.orderExtras) };
  const card = nulled.cards[target.cardId] ?? { customer: [], subcontractor: [] };
  return { ...nulled, cards: { ...nulled.cards, [target.cardId]: apply(card) } };
}

// Puts the choices on the product cards (where the pricing reads them); a
// card the save doesn't list has none.
export function applyNulledLinesToCards<T extends { cardId: number }>(cards: T[], nulled: WebsiteOrderNulledLines) {
  return cards.map((card) => ({
    ...card,
    nulledLineKeysForCustomer: nulled.cards[card.cardId]?.customer ?? [],
    nulledLineKeysForSubcontractor: nulled.cards[card.cardId]?.subcontractor ?? [],
  }));
}

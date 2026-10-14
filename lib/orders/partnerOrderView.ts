import { hasFullAccess, hasPermission } from "@/lib/users/access";
import type { AppPermission, Role } from "@/lib/users/types";
import { movingOrderPriceView, type MovingOrderItem } from "./movingOrderView";
import { roundNok } from "./orderTotals";
import type { WebsiteOrderCalculatorView } from "./websiteOrderCalculator";

// The booking app's read-only view of a homepage website order (delivery or
// move) for whoever isn't an admin there — the assigned partner above all:
// the job as booked and the partner's own price, read from what's stored on
// the order instead of re-pricing it with the dashboard engine (which doesn't
// know website pricing, and a move has no product cards at all).

export type PartnerViewerRole = "admin" | "creator" | "partner";

// Same scoping as the booking list (GET /api/orders): an owner/admin sees any
// order, an order creator the ones they made, everyone else only the orders
// they're the partner on — and only a partner never sees customer prices.
export function partnerViewerRole(
  membership: { id: string; role: Role; permissions: AppPermission[] },
  order: { subcontractorMembershipId: string | null; createdByMembershipId: string | null; customerMembershipId: string | null },
): PartnerViewerRole | null {
  if (hasFullAccess(membership.role)) return "admin";
  if (hasPermission(membership.permissions, "BOOKING_CREATE")) {
    return order.customerMembershipId === membership.id || order.createdByMembershipId === membership.id ? "creator" : null;
  }
  return order.subcontractorMembershipId === membership.id ? "partner" : null;
}

export type PartnerPriceLine = { label: string; qty: number; price: number };
export type PartnerPriceView = {
  groups: { name: string; lines: PartnerPriceLine[] }[];
  // The stored partner price (Order.priceSubcontractor) — what's paid.
  total: number;
  // total − what the lines add up to: anything but 0 means the lines don't
  // explain the stored price and must be checked.
  mismatch: number;
};

function withTotal(groups: PartnerPriceView["groups"], storedTotal: number): PartnerPriceView {
  const linesTotal = groups.reduce((sum, group) => sum + group.lines.reduce((s, line) => s + line.price, 0), 0);
  return { groups, total: storedTotal, mismatch: roundNok(storedTotal - linesTotal) };
}

// A delivery order: the admin calculator's partner side, line by line (a line
// set to 0 for the partner at 0), plus the partner's minus/plus.
export function partnerPricesFromCalculator(calculator: WebsiteOrderCalculatorView, storedTotal: number): PartnerPriceView {
  const groups = calculator.products.map((product) => ({
    name: product.name,
    lines: product.lines.map((line) => ({
      label: line.label,
      qty: line.qty,
      price: line.nulledPartner ? 0 : (line.partner ?? 0),
    })),
  }));
  const adjustments = [
    ...(calculator.partner?.minus ? [{ label: "Partner minus", qty: 1, price: -calculator.partner.minus }] : []),
    ...(calculator.partner?.plus ? [{ label: "Partner plus", qty: 1, price: calculator.partner.plus }] : []),
  ];
  return withTotal(adjustments.length > 0 ? [...groups, { name: "Justering", lines: adjustments }] : groups, storedTotal);
}

// A move: its stored lines' partner prices (movingOrderPriceView).
export function partnerPricesFromMovingItems(items: MovingOrderItem[], storedTotal: number): PartnerPriceView {
  const view = movingOrderPriceView(items, "partner");
  const groups = [
    ...view.products.map((product) => ({ name: product.productName, lines: product.items })),
    ...(view.orderExtras.length > 0 ? [{ name: "Order extras", lines: view.orderExtras }] : []),
  ];
  return withTotal(groups, storedTotal);
}

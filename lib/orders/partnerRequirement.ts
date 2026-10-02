import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

// Statuses where an order is expected to have a partner (subcontractor) set.
// Manually moving an order into one of these without a partner asks the admin
// to confirm, and the daily missing-partner cron alerts on leftovers.
export const PARTNER_REQUIRED_STATUSES = ["failed", "completed", "invoiced", "paid"] as const;

// Orders below this display id were imported from before the app and mostly
// have no partner; every partner check (dialogs, daily alert, cancelled
// placeholder) ignores them.
export const PARTNER_TRACKING_MIN_DISPLAY_ID = 20000;

export function isPartnerTrackedOrder(displayId: number | null | undefined) {
  // No display id yet = a new order, which will get one >= 20000.
  return typeof displayId !== "number" || displayId >= PARTNER_TRACKING_MIN_DISPLAY_ID;
}

export function requiresPartner(status: string | null | undefined) {
  const normalized = normalizeOrderStatus(status);
  return (PARTNER_REQUIRED_STATUSES as readonly string[]).includes(normalized);
}

export function hasPartner(order: {
  subcontractorMembershipId?: string | null;
  subcontractor?: string | null;
}) {
  return Boolean(order.subcontractorMembershipId?.trim() || order.subcontractor?.trim());
}

export function shouldPromptForPartner(input: {
  status: string | null | undefined;
  initialStatus: string | null | undefined;
  subcontractorId: string | null | undefined;
  displayId?: number | null;
}) {
  if (!isPartnerTrackedOrder(input.displayId)) return false;
  if (!requiresPartner(input.status)) return false;
  if (normalizeOrderStatus(input.status) === normalizeOrderStatus(input.initialStatus)) return false;
  return !input.subcontractorId?.trim();
}

export function findOrdersMissingPartner<
  T extends {
    displayId?: number | null;
    subcontractorMembershipId?: string | null;
    subcontractor?: string | null;
  },
>(orders: T[]) {
  return orders.filter((order) => isPartnerTrackedOrder(order.displayId) && !hasPartner(order));
}

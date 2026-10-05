import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

// How long a temporary customer account lives. One rule, worked out from the
// account's orders instead of stored: the account is kept while any of its
// orders is still open or on hold (Order.gdprHold — staff set it for an
// insurance case or dispute), and deleted `graceDays` after the last change
// once all of them are closed. A failed order (no-show) counts as closed, but
// staff putting it back to processing reopens it, which keeps the account.

// The statuses where the customer can no longer change the order.
const CLOSED_STATUSES = new Set(["completed", "cancelled", "failed", "invoiced", "paid"]);

export const CUSTOMER_ACCOUNT_GRACE_DAYS = 1;

export function isOrderClosedForCustomer(status: string | null | undefined): boolean {
  return CLOSED_STATUSES.has(normalizeOrderStatus(status));
}

export type AccountLifetimeOrder = {
  status: string | null;
  statusChangedAt: Date | null;
  // Some status writers (e.g. the public cancel route) don't set
  // statusChangedAt — updatedAt covers them. It can only move deleteAt later.
  updatedAt: Date;
  gdprHold: boolean;
};

// What the rule reads from an account's orders (plus id/createdAt for callers).
export const LIFETIME_ORDER_SELECT = {
  id: true,
  status: true,
  statusChangedAt: true,
  updatedAt: true,
  gdprHold: true,
  createdAt: true,
} as const;

const DAY_MS =24 * 60 * 60 * 1000;

// null = keep the account. An account with no orders left has nothing to
// keep it for and is due right away (`now`).
export function customerAccountDeleteAt(
  orders: AccountLifetimeOrder[],
  graceDays: number = CUSTOMER_ACCOUNT_GRACE_DAYS,
  now: Date = new Date(),
): Date | null {
  if (orders.length === 0) return now;
  if (orders.some((order) => order.gdprHold || !isOrderClosedForCustomer(order.status))) return null;

  const lastChange = Math.max(
    ...orders.map((order) => Math.max(order.statusChangedAt?.getTime() ?? 0, order.updatedAt.getTime())),
  );
  return new Date(lastChange + graceDays * DAY_MS);
}

export function isCustomerAccountExpired(orders: AccountLifetimeOrder[], now: Date = new Date()): boolean {
  const deleteAt = customerAccountDeleteAt(orders, CUSTOMER_ACCOUNT_GRACE_DAYS, now);
  return deleteAt !== null && deleteAt.getTime() <= now.getTime();
}

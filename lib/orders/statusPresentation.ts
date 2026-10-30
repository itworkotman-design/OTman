export const ORDER_STATUS_OPTIONS = [
  "pending",
  "processing",
  "approved",
  "rejected",
  "confirmed",
  "active",
  "cancelled",
  "failed",
  "completed",
  "invoiced",
  "paid",
] as const;

// Homepage (public customer) orders are prepaid at checkout, so they never
// need approved (awaiting payment) and never reach the B2B invoiced/paid
// bookkeeping statuses. "refunded" (declined, money sent back) is a website
// status too, but deliberately not pickable here: only the Decline action
// (app/api/orders/[orderId]/decline) sets it, after the Stripe refund.
export const WEBSITE_ORDER_STATUS_OPTIONS = [
  "processing",
  "rejected",
  "confirmed",
  "active",
  "failed",
  "cancelled",
  "completed",
] as const;

// What the website-orders list can filter by: everything above, plus the
// statuses only an action sets.
export const WEBSITE_ORDER_FILTER_STATUS_OPTIONS = [...WEBSITE_ORDER_STATUS_OPTIONS, "refunded"] as const;

// Closed orders whose products, details and price can no longer be changed
// (the admin editor and its API routes) — a refunded order's money has
// already gone back, so changing its price would charge or refund again.
const WEBSITE_ORDER_LOCKED_STATUSES = new Set(["cancelled", "refunded", "completed", "invoiced", "paid"]);

export function isWebsiteOrderLocked(status: string | null | undefined): boolean {
  return WEBSITE_ORDER_LOCKED_STATUSES.has(normalizeOrderStatus(status));
}

const WEBSITE_ORDER_STATUS_SET = new Set<string>(WEBSITE_ORDER_STATUS_OPTIONS);

export function isAllowedWebsiteOrderStatus(status: string | null | undefined): boolean {
  return WEBSITE_ORDER_STATUS_SET.has(normalizeOrderStatus(status));
}

export function normalizeOrderStatus(status: string | null | undefined) {
  const key = (status ?? "").toString().trim().toLowerCase();

  switch (key) {
    case "på vent":
    case "venter":
    case "avventer":
      return "pending";
    case "behandles":
    case "behandling":
      return "processing";
    case "godkjent":
      return "approved";
    case "avvist":
      return "rejected";
    case "bekreftet":
      return "confirmed";
    case "aktiv":
      return "active";
    case "kanselert":
    case "avbrutt":
      return "cancelled";
    case "fail":
    case "feilet":
      return "failed";
    case "ferdig":
      return "completed";
    case "fakturet":
    case "fakturert":
      return "invoiced";
    case "betalt":
      return "paid";
    case "refundert":
      return "refunded";
    default:
      return key;
  }
}

export function getOrderStatusStyle(status: string | null | undefined) {
  const key = normalizeOrderStatus(status);

  switch (key) {
    case "pending":
      return { color: "#be185d", backgroundColor: "#fce7f3" };
    case "processing":
      return { color: "#b45309", backgroundColor: "#fef3c7" };
    case "godkjent":
    case "approved":
      return { color: "#1d4ed8", backgroundColor: "#dbeafe" };
    case "avvist":
    case "rejected":
      return { color: "#b91c1c", backgroundColor: "#fee2e2" };
    case "bekreftet":
    case "confirmed":
      return { color: "#0f766e", backgroundColor: "#cffafe" };
    case "aktiv":
    case "active":
      return { color: "#5b21b6", backgroundColor: "#ede9fe" };
    case "kanselert":
    case "cancelled":
    case "canceled":
      return { color: "#ea580c", backgroundColor: "#ffedd5" };
    case "failed":
      return { color: "#7c3aed", backgroundColor: "#ede9fe" };
    case "refunded":
      return { color: "#be123c", backgroundColor: "#ffe4e6" };
    case "ferdig":
    case "completed":
      return { color: "#15803d", backgroundColor: "#dcfce7" };
    case "fakturet":
    case "invoiced":
      return { color: "#064e3b", backgroundColor: "#d1fae5" };
    case "betalt":
    case "paid":
      return { color: "#6b7280", backgroundColor: "#f3f4f6" };
    default:
      return { color: "inherit", backgroundColor: "#e5e7eb" };
  }
}

export function getOrderStatusLabel(status: string | null | undefined) {
  const value = normalizeOrderStatus(status);
  return value || "unknown";
}

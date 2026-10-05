// Which modal DashboardOrderModal opens, from GET /api/orders/[orderId]/website-details:
// the website modal for a homepage website order, the regular OrderModal for
// every other order (or a user without website-order access) — and an error
// for anything that failed, never the regular modal: a website order opened
// there is edited with the wrong (dashboard) pricing and breaks.
export type OrderModalMode = "website" | "standard" | "error";

const NOT_A_WEBSITE_ORDER = new Set(["NOT_WHITE_GOODS_WEBSITE_ORDER", "NOT_FOUND", "FORBIDDEN"]);

export function orderModalMode(status: number | null, data: unknown): OrderModalMode {
  const body = data && typeof data === "object" ? (data as { ok?: unknown; order?: unknown; reason?: unknown }) : null;
  if (status !== null && status >= 200 && status < 300 && body?.ok === true && body.order) return "website";
  if (typeof body?.reason === "string" && NOT_A_WEBSITE_ORDER.has(body.reason)) return "standard";
  return "error";
}

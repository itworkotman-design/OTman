export const ORDER_STATUS_OPTIONS = [
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

export function normalizeOrderStatus(status: string | null | undefined) {
  const key = (status ?? "").toString().trim().toLowerCase();

  switch (key) {
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
    default:
      return key;
  }
}

export function getOrderStatusStyle(status: string | null | undefined) {
  const key = normalizeOrderStatus(status);

  switch (key) {
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

export function getOrderStatusStyle(status: string | null | undefined) {
  const key = (status ?? "").toString().trim().toLowerCase();

  switch (key) {
    case "processing":
      return { color: "#b45309", backgroundColor: "#fef3c7" };
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
  const value = (status ?? "").trim();
  return value || "unknown";
}

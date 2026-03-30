import { getUserAccessType, hasFullAccess } from "@/lib/users/access";
import type { AppPermission, Role } from "@/lib/users/types";

export type OrderViewMode = "ADMIN" | "ORDER_CREATOR" | "SUBCONTRACTOR";

export function getOrderViewMode(
  role: Role,
  permissions: AppPermission[],
): OrderViewMode {
  if (hasFullAccess(role)) return "ADMIN";

  const accessType = getUserAccessType(role, permissions);

  if (accessType === "ORDER_CREATOR") return "ORDER_CREATOR";
  return "SUBCONTRACTOR";
}

export function canEditOrders(role: Role, permissions: AppPermission[]) {
  return hasFullAccess(role);
}

export function canDownloadOrderPdf(role: Role, permissions: AppPermission[]) {
  const mode = getOrderViewMode(role, permissions);
  return (
    mode === "ADMIN" || mode === "ORDER_CREATOR" || mode === "SUBCONTRACTOR"
  );
}

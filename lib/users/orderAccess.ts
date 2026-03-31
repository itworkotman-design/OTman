import type { AppPermission, Role } from "@/lib/users/types";

export type OrderViewMode = "ADMIN" | "ORDER_CREATOR" | "SUBCONTRACTOR";

export function hasFullAccess(role: Role) {
  return role === "OWNER" || role === "ADMIN";
}

export function canCreateOrders(role: Role, permissions: AppPermission[]) {
  if (hasFullAccess(role)) return true;
  return permissions.includes("BOOKING_CREATE");
}

export function canEditOrders(role: Role, permissions: AppPermission[]) {
  return canCreateOrders(role, permissions);
}
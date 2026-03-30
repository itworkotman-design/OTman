import type { AppPermission, Role } from "@/lib/users/types";

export type UserAccessType = "SUBCONTRACTOR" | "ORDER_CREATOR" | "FULL_ACCESS";

export function hasPermission(
  permissions: AppPermission[],
  permission: AppPermission,
) {
  return permissions.includes(permission);
}

export function hasFullAccess(role: Role) {
  return role === "OWNER" || role === "ADMIN";
}

export function canCreateOrders(role: Role, permissions: AppPermission[]) {
  if (hasFullAccess(role)) return true;
  return hasPermission(permissions, "BOOKING_CREATE");
}

export function canViewOrders(role: Role, permissions: AppPermission[]) {
  if (hasFullAccess(role)) return true;
  return hasPermission(permissions, "BOOKING_VIEW");
}

export function isSubcontractorAccess(permissions: AppPermission[]) {
  return (
    hasPermission(permissions, "BOOKING_VIEW") &&
    !hasPermission(permissions, "BOOKING_CREATE")
  );
}

export function isOrderCreatorAccess(permissions: AppPermission[]) {
  return (
    hasPermission(permissions, "BOOKING_VIEW") &&
    hasPermission(permissions, "BOOKING_CREATE")
  );
}

export function getUserAccessType(
  role: Role,
  permissions: AppPermission[],
): UserAccessType {
  if (hasFullAccess(role)) {
    return "FULL_ACCESS";
  }

  if (isOrderCreatorAccess(permissions)) {
    return "ORDER_CREATOR";
  }

  return "SUBCONTRACTOR";
}

export function getAccessLabel(
  role: Role,
  permissions: AppPermission[],
): string {
  const accessType = getUserAccessType(role, permissions);

  if (accessType === "SUBCONTRACTOR") return "Subcontractor";
  if (accessType === "ORDER_CREATOR") return "Order creator";
  return "";
}

import type { AppPermission, Role } from "@/lib/users/types";

export type UserAccessType = "SUBCONTRACTOR" | "ORDER_CREATOR";

export function hasPermission(
  permissions: AppPermission[],
  permission: AppPermission,
) {
  return permissions.includes(permission);
}

export function isSubcontractorPermissions(permissions: AppPermission[]) {
  return (
    hasPermission(permissions, "BOOKING_VIEW") &&
    !hasPermission(permissions, "BOOKING_CREATE")
  );
}

export function isOrderCreatorPermissions(permissions: AppPermission[]) {
  return (
    hasPermission(permissions, "BOOKING_VIEW") &&
    hasPermission(permissions, "BOOKING_CREATE")
  );
}

export function getAccessTypeFromRoleAndPermissions(
  role: Role,
  permissions: AppPermission[],
): UserAccessType | null {
  if (role === "OWNER" || role === "ADMIN") {
    return null;
  }

  if (isOrderCreatorPermissions(permissions)) {
    return "ORDER_CREATOR";
  }

  return "SUBCONTRACTOR";
}

export function getAccessLabel(
  role: Role,
  permissions: AppPermission[],
): string {
  const accessType = getAccessTypeFromRoleAndPermissions(role, permissions);

  if (accessType === "SUBCONTRACTOR") {
    return "Subcontractor";
  }

  if (accessType === "ORDER_CREATOR") {
    return "Order creator";
  }

  return "";
}


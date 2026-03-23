export type AppPermission =
  | "BOOKING_VIEW"
  | "BOOKING_CREATE";

export function hasPermission(
  permissions: AppPermission[],
  permission: AppPermission
) {
  return permissions.includes(permission);
}

export function canAccessPath(
  pathname: string,
  permissions: AppPermission[]
) {
  if (pathname.startsWith("/booking/create")) {
    return hasPermission(permissions, "BOOKING_CREATE");
  }

  if (pathname.startsWith("/booking")) {
    return hasPermission(permissions, "BOOKING_VIEW");
  }

  return true;
}
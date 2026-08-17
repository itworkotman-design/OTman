import type { AppModule } from "@prisma/client";
import type { MembershipAppAccess } from "@/lib/auth/membership";
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

export function canAccessArchive(role: Role, permissions: AppPermission[]) {
  if (hasFullAccess(role)) return true;
  return hasPermission(permissions, "ARCHIVE_VIEW");
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

// ─── Per-app module access (MembershipAppAccess) ─────────────────────────────
// New, additive gate model: "enabled" controls whether a module even shows
// up for this person at all (set per-person, independent of company Role —
// even an OWNER can have a module individually disabled), "level" is a flat
// Viewer/Admin split (Viewer can browse an enabled module; Admin can also
// reach its settings/mutation surface). Deliberately separate from the
// legacy Role+Permission functions above rather than replacing them — those
// still back a large amount of unrelated per-order permission logic
// (attachments, contact info, pricing visibility) that this redesign never
// touched.
const NO_MODULE_ACCESS = { enabled: false, level: "VIEWER" as const };

export function getModuleAccess(
  membership: { appAccess: MembershipAppAccess[] },
  module: AppModule,
): { enabled: boolean; level: "VIEWER" | "ADMIN" } {
  const row = membership.appAccess.find((a) => a.module === module);
  return row ? { enabled: row.enabled, level: row.level } : NO_MODULE_ACCESS;
}

export function hasAnyAppAccess(membership: { appAccess: MembershipAppAccess[] }): boolean {
  return membership.appAccess.some((a) => a.enabled);
}

// A person can hold USER_MANAGEMENT at Admin level independent of their
// company Role (that's the whole point of the appAccess redesign — Role and
// app grants are decoupled). This is the actual authority check for every
// user-management mutation: company OWNER always qualifies (even if their
// appAccess rows are stale/missing pre-backfill, since Role is the
// authoritative super-user signal, not a per-module grant); everyone else
// needs an explicit USER_MANAGEMENT/Admin grant. A VIEWER-level grant (or no
// grant) never qualifies, even though `.enabled` alone would let them browse.
export function isUserManagementAdmin(membership: {
  role: Role;
  appAccess: MembershipAppAccess[];
}): boolean {
  return membership.role === "OWNER" || getModuleAccess(membership, "USER_MANAGEMENT").level === "ADMIN";
}

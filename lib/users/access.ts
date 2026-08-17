import type { AppModule, DashboardSection } from "@prisma/client";
import type { MembershipAppAccess } from "@/lib/auth/membership";
import type { AppPermission, Role } from "@/lib/users/types";
import { ALL_DASHBOARD_SECTIONS, SECTIONS_REQUIRING_BOOKING_ADMIN } from "@/lib/users/dashboardSections";

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

type DashboardSectionMembership = {
  appAccess: MembershipAppAccess[];
  dashboardSections: { section: DashboardSection; enabled: boolean }[];
};

// A missing dashboardSections row means visible — this is a sub-setting of
// an already-granted DASHBOARD module, not a grant in its own right, so "no
// explicit restriction yet" defaults to showing the section (opposite
// fallback direction from getModuleAccess's NO_MODULE_ACCESS, deliberately —
// see the MembershipDashboardSection model comment in schema.prisma).
function getDashboardSectionAccess(membership: DashboardSectionMembership, section: DashboardSection): boolean {
  const row = membership.dashboardSections.find((s) => s.section === section);
  return row ? row.enabled : true;
}

// Each Dashboard Home section is independently controllable per-person, on
// top of the base DASHBOARD module grant. BOOKING_OVERVIEW/QUICK_TASKS
// additionally require company-wide (Admin-level) Booking access regardless
// of the section toggle — that's real order revenue/profit data, same bar
// as the booking archive's own ADMIN viewMode. Without this, an Owner could
// hand out DASHBOARD without BOOKING and the grantee would see sensitive
// order amounts/profit they have no other access to. The other sections
// (GDPR, Reviews, People online) deliberately do NOT require Booking access,
// so an Owner can grant e.g. GDPR visibility without booking data visibility.
export function canViewDashboardSection(membership: DashboardSectionMembership, section: DashboardSection): boolean {
  if (!getModuleAccess(membership, "DASHBOARD").enabled) return false;
  if (!getDashboardSectionAccess(membership, section)) return false;

  if (SECTIONS_REQUIRING_BOOKING_ADMIN.includes(section)) {
    const booking = getModuleAccess(membership, "BOOKING");
    if (!booking.enabled || booking.level !== "ADMIN") return false;
  }

  return true;
}

// Whether landing on bare /dashboard shows anything at all for this person —
// used to gate the Sidebar's "Home" link and the page's own entry redirect.
export function hasAnyVisibleDashboardSection(membership: DashboardSectionMembership): boolean {
  return ALL_DASHBOARD_SECTIONS.some((section) => canViewDashboardSection(membership, section));
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

import type { AppAccessLevel, AppModule } from "@prisma/client";
import { hasFullAccess, hasPermission } from "@/lib/users/access";
import type { AppPermission, Role } from "@/lib/users/types";

export const ALL_MODULES: AppModule[] = [
  "ARCHIVE",
  "BOOKING",
  "WEBSITE_EDITOR",
  "WEBSITE_ORDERS",
  "SCHEDULER",
  "USER_MANAGEMENT",
];

export const MODULE_LABELS: Record<AppModule, string> = {
  ARCHIVE: "Archive",
  BOOKING: "Booking",
  WEBSITE_EDITOR: "Website editor",
  WEBSITE_ORDERS: "Website orders",
  SCHEDULER: "Scheduler orders",
  USER_MANAGEMENT: "User management",
};

// Purely a visual accent (used by the Edit User modal's per-app cards) so
// six otherwise-identical cards are easy to tell apart at a glance — no
// meaning attached to which module gets which color.
export const MODULE_COLORS: Record<AppModule, string> = {
  ARCHIVE: "#273097",
  BOOKING: "#7a5cc7",
  WEBSITE_EDITOR: "#2e9e6b",
  WEBSITE_ORDERS: "#c67139",
  SCHEDULER: "#c0507a",
  USER_MANAGEMENT: "#3a8fb7",
};

// Modules with no granular permission today — access is strictly whatever
// hasFullAccess(role) already grants, so the default preserves that exactly.
const BINARY_ADMIN_ONLY_MODULES: AppModule[] = [
  "WEBSITE_EDITOR",
  "WEBSITE_ORDERS",
  "SCHEDULER",
  "USER_MANAGEMENT",
];

export type AppAccessDefaults = Record<AppModule, { enabled: boolean; level: AppAccessLevel }>;

// Single source of truth for deriving MembershipAppAccess/InviteAppAccess
// defaults from the legacy Role + AppPermission[] shape — used by the
// one-time backfill script and by every membership/invite creation path so
// both compute the exact same thing.
export function computeDefaultAppAccess(
  role: Role,
  permissions: AppPermission[],
): AppAccessDefaults {
  const fullAccess = hasFullAccess(role);

  const result = {
    ARCHIVE: {
      enabled: fullAccess || hasPermission(permissions, "ARCHIVE_VIEW"),
      level: "ADMIN" as AppAccessLevel,
    },
    BOOKING: {
      enabled: fullAccess || hasPermission(permissions, "BOOKING_VIEW"),
      level: (fullAccess || hasPermission(permissions, "BOOKING_CREATE")
        ? "ADMIN"
        : "VIEWER") as AppAccessLevel,
    },
  } as AppAccessDefaults;

  for (const appModule of BINARY_ADMIN_ONLY_MODULES) {
    result[appModule] = { enabled: fullAccess, level: "ADMIN" };
  }

  return result;
}

export function defaultAppAccessRows(role: Role, permissions: AppPermission[]) {
  const access = computeDefaultAppAccess(role, permissions);

  return ALL_MODULES.map((appModule) => ({
    module: appModule,
    enabled: access[appModule].enabled,
    level: access[appModule].level,
  }));
}

export type AppAccessRow = { module: AppModule; enabled: boolean; level: AppAccessLevel };

// Parses the client-submitted access matrix for both membership creation and
// the Edit User "Access" tab. Requires all 6 modules to be present — the
// modal always renders (and submits) the full set, so a partial payload
// means malformed/stale client state rather than an intentional partial
// update, and a strict "all or nothing" input keeps the write side from
// having to guess what an omitted module should default to.
export function normalizeAppAccessInput(value: unknown): AppAccessRow[] | null {
  if (!Array.isArray(value)) return null;

  const byModule = new Map<AppModule, { enabled: boolean; level: AppAccessLevel }>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const appModule = (entry as { module?: unknown }).module;
    if (!ALL_MODULES.includes(appModule as AppModule)) continue;
    const enabled = Boolean((entry as { enabled?: unknown }).enabled);
    const level: AppAccessLevel = (entry as { level?: unknown }).level === "ADMIN" ? "ADMIN" : "VIEWER";
    byModule.set(appModule as AppModule, { enabled, level });
  }

  if (byModule.size !== ALL_MODULES.length) return null;

  return ALL_MODULES.map((appModule) => ({ module: appModule, ...byModule.get(appModule)! }));
}

// The legacy Permission system (MembershipPermission/InvitePermission) still
// backs a large amount of unrelated per-order business logic — see
// lib/users/access.ts. Rather than exposing a second, separately-editable
// UI for it, every write path derives it straight from the new appAccess
// matrix so the two can never drift apart.
export function derivePermissionsFromAppAccess(appAccess: AppAccessRow[]): AppPermission[] {
  const archive = appAccess.find((a) => a.module === "ARCHIVE");
  const booking = appAccess.find((a) => a.module === "BOOKING");

  const permissions: AppPermission[] = [];
  if (booking?.enabled) permissions.push("BOOKING_VIEW");
  if (booking?.enabled && booking.level === "ADMIN") permissions.push("BOOKING_CREATE");
  if (archive?.enabled) permissions.push("ARCHIVE_VIEW");

  return permissions;
}

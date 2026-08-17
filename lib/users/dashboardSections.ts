import type { DashboardSection } from "@prisma/client";

export const ALL_DASHBOARD_SECTIONS: DashboardSection[] = [
  "BOOKING_OVERVIEW",
  "PEOPLE_ONLINE",
  "REVIEWS",
  "GDPR",
  "QUICK_TASKS",
];

export const DASHBOARD_SECTION_LABELS: Record<DashboardSection, string> = {
  BOOKING_OVERVIEW: "Booking overview",
  PEOPLE_ONLINE: "People online",
  REVIEWS: "Reviews",
  GDPR: "GDPR",
  QUICK_TASKS: "Quick tasks",
};

// These two sections surface order financial data (revenue/profit, order
// email settings) — seeing them additionally requires company-wide
// (Admin-level) Booking access, same bar as the booking archive's own ADMIN
// viewMode, regardless of the section toggle below. GDPR/Reviews/People
// online deliberately do NOT require Booking access — an Owner can grant
// e.g. GDPR visibility without granting booking data visibility.
export const SECTIONS_REQUIRING_BOOKING_ADMIN: DashboardSection[] = [
  "BOOKING_OVERVIEW",
  "QUICK_TASKS",
];

export type DashboardSectionRow = { section: DashboardSection; enabled: boolean };

// Parses the client-submitted section-visibility matrix for the Edit User
// "Access" tab. Same all-or-nothing shape as normalizeAppAccessInput — the
// modal always renders (and submits) the full set once DASHBOARD is shown,
// so a partial payload means malformed/stale client state. Unlike
// normalizeAppAccessInput this field can be legitimately *omitted* entirely
// (e.g. a non-owner actor's request never includes it) — callers should
// treat `value === undefined` as "no change" before calling this, and only
// treat a non-undefined-but-invalid value as a rejection.
export function normalizeDashboardSectionsInput(value: unknown): DashboardSectionRow[] | null {
  if (!Array.isArray(value)) return null;

  const bySection = new Map<DashboardSection, boolean>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const section = (entry as { section?: unknown }).section;
    if (!ALL_DASHBOARD_SECTIONS.includes(section as DashboardSection)) continue;
    const enabled = Boolean((entry as { enabled?: unknown }).enabled);
    bySection.set(section as DashboardSection, enabled);
  }

  if (bySection.size !== ALL_DASHBOARD_SECTIONS.length) return null;

  return ALL_DASHBOARD_SECTIONS.map((section) => ({ section, enabled: bySection.get(section)! }));
}

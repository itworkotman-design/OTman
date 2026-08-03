"use client";

import { useState } from "react";
import type { AppModule, Membership } from "@/lib/users/types";
import { ALL_MODULES, MODULE_LABELS } from "@/lib/users/appAccessDefaults";
import { hasFullAccess } from "@/lib/users/access";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { ArchiveRolesPanel } from "@/app/_components/Dahsboard/users/ArchiveRolesPanel";

// Every module's access is really just this pair of levels — Admin and
// Viewer aren't something anyone creates or deletes, they're the two fixed
// rungs `getModuleAccess` recognizes. Showing them here (with a live count
// of who currently holds each) makes that concrete instead of leaving the
// "roles" tab implying there's nothing to see for the five modules that
// don't have Archive's extra named-group system.
const BUILT_IN_LEVELS: { id: "ADMIN" | "VIEWER"; name: string; color: string }[] = [
  { id: "ADMIN", name: "Admin", color: "#273097" },
  { id: "VIEWER", name: "Viewer", color: "#838383" },
];

// Booking is the one module where the legacy Permission system already
// draws a real three-way distinction (lib/users/access.ts: hasFullAccess,
// isSubcontractorAccess, isOrderCreatorAccess) that predates and outlives
// this redesign — attachments/contact-info/pricing visibility deep in the
// booking flow still branch on it. "Admin" here tracks company Role, not
// the per-app level, because a company OWNER/ADMIN administers Booking
// regardless of what Viewer/Admin their own Booking row happens to say.
const BOOKING_ROLES: { id: "ADMIN" | "ORDER_CREATOR" | "SUBCONTRACTOR"; name: string; color: string }[] = [
  { id: "ADMIN", name: "Admin", color: "#273097" },
  { id: "ORDER_CREATOR", name: "Order creator", color: "#2e9e6b" },
  { id: "SUBCONTRACTOR", name: "Subcontractor", color: "#838383" },
];

function countBuiltInLevels(module: AppModule, memberships: Membership[]): Record<"ADMIN" | "VIEWER", number> {
  const counts = { ADMIN: 0, VIEWER: 0 };
  for (const membership of memberships) {
    const row = membership.appAccess?.find((a) => a.module === module);
    if (row?.enabled) counts[row.level] += 1;
  }
  return counts;
}

function countBookingRoles(memberships: Membership[]): Record<"ADMIN" | "ORDER_CREATOR" | "SUBCONTRACTOR", number> {
  const counts = { ADMIN: 0, ORDER_CREATOR: 0, SUBCONTRACTOR: 0 };
  for (const membership of memberships) {
    const row = membership.appAccess?.find((a) => a.module === "BOOKING");
    if (!row?.enabled) continue;

    if (hasFullAccess(membership.role)) {
      counts.ADMIN += 1;
    } else if (row.level === "ADMIN") {
      counts.ORDER_CREATOR += 1;
    } else {
      counts.SUBCONTRACTOR += 1;
    }
  }
  return counts;
}

function BuiltInRolesCard({ module, memberships }: { module: AppModule; memberships: Membership[] }) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);

  const rows =
    module === "BOOKING"
      ? BOOKING_ROLES.map((role) => ({ ...role, count: countBookingRoles(memberships)[role.id] }))
      : BUILT_IN_LEVELS.map((level) => ({ ...level, count: countBuiltInLevels(module, memberships)[level.id] }));

  return (
    <div className="customContainer mb-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[19px] font-bold text-textcolor">
          {MODULE_LABELS[module]} {locale === "nb" ? "roller" : "roles"}
        </h2>
        <span className="text-[12.5px] text-textColorThird">
          {locale === "nb" ? "Standard — kan ikke fjernes eller endres" : "Built in — can't be renamed or removed"}
        </span>
      </div>

      <div className="grid gap-3">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-4 rounded-2xl border border-black/8 px-4 py-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="min-w-35 text-sm font-bold text-textcolor">{row.name}</span>
            <span className="text-[12.5px] text-textColorThird">
              {row.count} {locale === "nb" ? "brukere" : row.count === 1 ? "user" : "users"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Only Archive has a real company-level role concept beyond Admin/Viewer
// (named groups for per-folder sharing, already built at the API layer).
// The other four (Booking gets its own note below) only ever get a
// per-person enabled+level grant — there is no additional company-wide
// role to manage for them here.
function GenericAppPanel({ module }: { module: AppModule }) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);

  if (module === "BOOKING") {
    return (
      <div className="customContainer flex items-center justify-center py-8 text-center text-sm text-textColorThird">
        {locale === "nb"
          ? "Admin følger personens firmarolle. Order creator/Subcontractor kommer fra Booking-nivået (Viewer/Admin) under tilgangsfanen på en bruker."
          : "Admin follows a person's company Role. Order creator vs Subcontractor comes from the Booking level (Viewer/Admin) in a user's Access tab."}
      </div>
    );
  }

  return (
    <div className="customContainer flex items-center justify-center py-8 text-center text-sm text-textColorThird">
      {locale === "nb"
        ? `Hvem som er Admin eller Viewer for ${MODULE_LABELS[module]} settes per person. Åpne en bruker under fanen "Brukere" og bruk tilgangsfanen for å endre det.`
        : `Who's Admin or Viewer for ${MODULE_LABELS[module]} is set per-person. Open a user under the Users tab and use the Access tab to change it.`}
    </div>
  );
}

export function AppsRolesTab({ memberships }: { memberships: Membership[] }) {
  const [selectedModule, setSelectedModule] = useState<AppModule>("ARCHIVE");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {ALL_MODULES.map((module) => (
          <button
            key={module}
            type="button"
            onClick={() => setSelectedModule(module)}
            className={`rounded-full border px-4 py-2 text-[13px] font-bold transition-colors ${
              selectedModule === module
                ? "border-logoblue bg-logoblue text-white"
                : "border-logoblue/30 bg-white text-logoblue hover:bg-logoblue/4"
            }`}
          >
            {MODULE_LABELS[module]}
          </button>
        ))}
      </div>

      <BuiltInRolesCard module={selectedModule} memberships={memberships} />

      {selectedModule === "ARCHIVE" ? <ArchiveRolesPanel /> : <GenericAppPanel module={selectedModule} />}
    </div>
  );
}

import { NextResponse } from "next/server";
import type { DashboardSection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewDashboardSection } from "@/lib/users/access";

// Shared auth check for every Dashboard Home data endpoint (Reviews, People
// online, GDPR, and the Booking-overview/Quick-tasks fields of
// /api/dashboard/home) — call at the top of the handler; on success it
// returns nothing further needed, on failure it returns the NextResponse to
// return directly from the route.
export async function requireDashboardSection(
  session: { userId: string; activeCompanyId: string | null } | null,
  section: DashboardSection,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  if (!session.activeCompanyId) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 }),
    };
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      appAccess: {
        where: { module: { in: ["DASHBOARD", "BOOKING"] } },
        select: { module: true, enabled: true, level: true },
      },
      dashboardSections: {
        select: { section: true, enabled: true },
      },
    },
  });

  if (!membership || !canViewDashboardSection(membership, section)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
    };
  }

  return { ok: true };
}

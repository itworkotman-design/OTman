import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: session.userId,
      status: "ACTIVE",
      company: {
        status: "ACTIVE",
      },
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      //RALFS ADDED
      permissions: {
        select: {
          permission: true,
        },
      },
    },
  });

  const selectableMemberships = memberships.map((m) => ({
    companyId: m.companyId,
    companyName: m.company.name,
    companySlug: m.company.slug,
    role: m.role,
    status: m.status,
    //RALFS ADDED
    permissions: (m.permissions ?? []).map(
  (p: { permission: "BOOKING_VIEW" | "BOOKING_CREATE" }) => p.permission
),
  }));

  const activeMembership =
    session.activeCompanyId === null
      ? null
      : selectableMemberships.find((m) => m.companyId === session.activeCompanyId) ?? null;

  const requiresTenantSelection =
    selectableMemberships.length > 1 && activeMembership === null;

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: session.userId,
        email: session.email,
        status: session.userStatus,
      },
      session: {
        id: session.sessionId,
        expiresAt: session.expiresAt,
        activeCompanyId: activeMembership?.companyId ?? null,
      },
      requiresTenantSelection,
      activeTenant: activeMembership
        ? {
            companyId: activeMembership.companyId,
            companyName: activeMembership.companyName,
            companySlug: activeMembership.companySlug,
          }
        : null,
      memberships: selectableMemberships,
    },
    { status: 200 }
  );
}

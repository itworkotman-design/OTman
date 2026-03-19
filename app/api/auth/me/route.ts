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
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

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
        activeCompanyId: session.activeCompanyId,
      },
      activeTenant: session.activeCompanyId
        ? {
            companyId: session.activeCompanyId,
            companyName: session.activeCompanyName,
            companySlug: session.activeCompanySlug,
          }
        : null,
      memberships: memberships.map((m) => ({
        companyId: m.companyId,
        companyName: m.company.name,
        companySlug: m.company.slug,
        role: m.role,
        status: m.status,
      })),
    },
    { status: 200 }
  );
}
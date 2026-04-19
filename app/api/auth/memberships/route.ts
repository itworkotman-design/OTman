import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 }
    );
  }

  const actorMembership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (
    !actorMembership ||
    (actorMembership.role !== "OWNER" && actorMembership.role !== "ADMIN")
  ) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const memberships = await prisma.membership.findMany({
    where: {
      companyId: session.activeCompanyId,
    },
    select: {
      id: true,
      role: true,
      status: true,
      createdAt: true,
      priceListId: true,
      permissions: {
        select: {
          permission: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          phoneNumber: true,
          address: true,
          description: true,
          status: true,
        },
      },
    },
    orderBy: [
      { role: "asc" },
      { createdAt: "desc" },
    ],
  });

  const onlineThreshold = new Date(Date.now() - 180_000);
  const onlineSessions =
    memberships.length === 0
      ? []
      : await prisma.session.findMany({
          where: {
            userId: {
              in: memberships.map((membership) => membership.user.id),
            },
            activeCompanyId: session.activeCompanyId,
            revokedAt: null,
            expiresAt: {
              gt: new Date(),
            },
            lastSeenAt: {
              gte: onlineThreshold,
            },
          },
          select: {
            userId: true,
          },
          distinct: ["userId"],
        });

  const onlineUserIds = new Set(onlineSessions.map((item) => item.userId));

  return NextResponse.json(
    {
      ok: true,
      memberships: memberships.map((membership) => ({
        ...membership,
        isOnline: onlineUserIds.has(membership.user.id),
      })),
    },
    { status: 200 }
  );
}

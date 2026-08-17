import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireDashboardSection } from "@/lib/users/requireDashboardSection";

// Dedicated, lightweight endpoint for the Dashboard "People Online" widget —
// deliberately separate from GET /api/auth/memberships (shared with the
// Users Management list page, gated by the unrelated USER_MANAGEMENT
// module) so this section's visibility is controlled purely by its own
// per-person Dashboard section setting.
export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  const gate = await requireDashboardSection(session, "PEOPLE_ONLINE");
  if (!gate.ok) return gate.response;
  if (!session?.activeCompanyId) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });

  const activeCompanyId = session.activeCompanyId;

  const memberships = await prisma.membership.findMany({
    where: {
      companyId: activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          description: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });

  const onlineThreshold = new Date(Date.now() - 180_000);
  const onlineSessions =
    memberships.length === 0
      ? []
      : await prisma.session.findMany({
          where: {
            userId: { in: memberships.map((m) => m.user.id) },
            activeCompanyId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
            lastSeenAt: { gte: onlineThreshold },
          },
          select: { userId: true },
          distinct: ["userId"],
        });

  const onlineUserIds = new Set(onlineSessions.map((item) => item.userId));

  return NextResponse.json(
    {
      ok: true,
      members: memberships
        .filter((m) => onlineUserIds.has(m.user.id))
        .map(({ user, ...m }) => ({
          id: m.id,
          role: m.role,
          user: {
            email: user.email,
            username: user.username,
            description: user.description,
          },
        })),
    },
    { status: 200 },
  );
}

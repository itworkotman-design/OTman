import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canAccessShiftLeader } from "@/lib/booking/shiftLeaderAccess";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const companyId = session.activeCompanyId;
  if (!companyId) {
    return NextResponse.json({ ok: true, admins: [] });
  }

  if (!(await canAccessShiftLeader(session.userId, companyId))) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const memberships = await prisma.membership.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      role: { in: ["ADMIN", "OWNER"] },
    },
    select: {
      user: { select: { id: true, username: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const admins = memberships.map((m) => ({
    id: m.user.id,
    username: m.user.username ?? m.user.email,
  }));

  return NextResponse.json({ ok: true, admins });
}

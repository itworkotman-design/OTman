import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getModuleAccess } from "@/lib/users/access";
import { requireArchiveMembership } from "@/lib/docArchive/route";

export async function GET(req: Request) {
  const result = await requireArchiveMembership(req, { requireAdmin: true });
  if ("error" in result) return result.error;

  const { session, membership } = result;

  const memberships = await prisma.membership.findMany({
    where: {
      companyId: membership.companyId,
      status: "ACTIVE",
    },
    select: {
      role: true,
      appAccess: { select: { module: true, enabled: true, level: true } },
      user: { select: { id: true, email: true, username: true } },
    },
  });

  const coworkers = memberships
    .filter((m) => m.user.id !== session.userId)
    .filter((m) => getModuleAccess(m, "ARCHIVE").enabled)
    .map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      username: m.user.username,
    }));

  return NextResponse.json({ ok: true, coworkers });
}

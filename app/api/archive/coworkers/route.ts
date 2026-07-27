import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canAccessArchive } from "@/lib/users/access";
import { requireArchiveMembership } from "@/lib/docArchive/route";

export async function GET(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const { session, membership } = result;

  const memberships = await prisma.membership.findMany({
    where: {
      companyId: membership.companyId,
      status: "ACTIVE",
    },
    select: {
      role: true,
      permissions: { select: { permission: true } },
      user: { select: { id: true, email: true, username: true } },
    },
  });

  const coworkers = memberships
    .filter((m) => m.user.id !== session.userId)
    .filter((m) => canAccessArchive(m.role, m.permissions.map((p) => p.permission)))
    .map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      username: m.user.username,
    }));

  return NextResponse.json({ ok: true, coworkers });
}

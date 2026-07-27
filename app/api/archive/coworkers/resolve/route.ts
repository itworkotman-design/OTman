import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireArchiveMembership } from "@/lib/docArchive/route";

// Backs the archive-ui bridge's `identity.resolvePlatformUsers` — resolving
// DISPLAY info for specific ids already referenced by a permission rule, role
// assignment, or history entry. Deliberately not filtered by ARCHIVE_VIEW or
// active status (per bridge.tsx's own contract: "may resolve
// inactive/disabled/historical company members"), but still company-scoped —
// it will never resolve a user outside the caller's active company.
export async function POST(req: Request) {
  const result = await requireArchiveMembership(req);
  if ("error" in result) return result.error;

  const body = await req.json().catch(() => null);
  const userIds = Array.isArray(body?.userIds)
    ? body.userIds.filter((id: unknown): id is string => typeof id === "string")
    : [];

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, users: [] });
  }

  const memberships = await prisma.membership.findMany({
    where: {
      companyId: result.membership.companyId,
      userId: { in: userIds },
    },
    select: {
      user: { select: { id: true, email: true, username: true } },
    },
  });

  const users = memberships.map((m) => ({
    userId: m.user.id,
    email: m.user.email,
    username: m.user.username,
  }));

  return NextResponse.json({ ok: true, users });
}

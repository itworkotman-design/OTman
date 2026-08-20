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
      // Drives FolderSharingPanel's action bundle when sharing with this
      // person directly — capability always follows their real Archive
      // role, never a level picked ad hoc per share (see
      // grantDefaultRoleAccessOnRootFolder in lib/docArchive/context.ts for
      // the same Admin=edit/Viewer=view rule applied to the default cascade).
      archiveLevel: getModuleAccess(m, "ARCHIVE").level,
    }));

  return NextResponse.json({ ok: true, coworkers });
}

import { NextResponse } from "next/server";
import type { ArchiveHostAdapterErrorCategory } from "@customprojects/custom-archive";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { canAccessArchive } from "@/lib/users/access";

export function archiveErrorStatus(category: ArchiveHostAdapterErrorCategory): number {
  switch (category) {
    case "unauthorized":
      return 401;
    case "not_found":
      return 404;
    case "validation":
      return 400;
    default:
      return 500;
  }
}

export async function requireArchiveMembership(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "UNAUTHORIZED" },
        { status: 401 },
      ),
    } as const;
  }

  if (!session.activeCompanyId) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
        { status: 409 },
      ),
    } as const;
  }

  const membership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (!membership || !canAccessArchive(membership.role, membership.permissions)) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "FORBIDDEN" },
        { status: 403 },
      ),
    } as const;
  }

  return { session, membership } as const;
}

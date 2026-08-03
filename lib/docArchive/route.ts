import { NextResponse } from "next/server";
import type { ArchiveHostAdapterErrorCategory } from "@customprojects/custom-archive";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { getModuleAccess } from "@/lib/users/access";

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

// requireAdmin gates the mutation surface (create/upload/edit/delete/status/
// sharing/etc.) — Viewer-level access only ever satisfies plain browsing and
// read routes. Every call site below was classified by its own HTTP method,
// not by file, since several route files mix a read GET with a mutating
// POST/PATCH/DELETE.
export async function requireArchiveMembership(
  req: Request,
  opts?: { requireAdmin?: boolean },
) {
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

  if (!membership) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "FORBIDDEN" },
        { status: 403 },
      ),
    } as const;
  }

  const access = getModuleAccess(membership, "ARCHIVE");

  if (!access.enabled || (opts?.requireAdmin && access.level !== "ADMIN")) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "FORBIDDEN" },
        { status: 403 },
      ),
    } as const;
  }

  return { session, membership } as const;
}

import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { getModuleAccess } from "@/lib/users/access";
import { prisma } from "@/lib/db";
import {
  getUserLogoDisplayPath,
  normalizeUserLogoPath,
} from "@/lib/users/profileAppearance";

// Lists the profile pictures already in use by members of the active
// company, so the user modal can offer them for reuse instead of uploading
// the same file again.
export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const actorMembership = await getActiveMembership({
    userId: session.userId,
    companyId: session.activeCompanyId,
  });

  if (!actorMembership || !getModuleAccess(actorMembership, "USER_MANAGEMENT").enabled) {
    return NextResponse.json(
      { ok: false, reason: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const users = await prisma.user.findMany({
    where: {
      logoPath: { not: null },
      memberships: { some: { companyId: session.activeCompanyId } },
    },
    select: { logoPath: true },
    distinct: ["logoPath"],
    orderBy: { updatedAt: "desc" },
  });

  const logos = users.flatMap(({ logoPath }) => {
    const normalized = normalizeUserLogoPath(logoPath);
    const displayPath = getUserLogoDisplayPath(normalized);
    return normalized && displayPath ? [{ logoPath: normalized, displayPath }] : [];
  });

  return NextResponse.json({ ok: true, logos }, { status: 200 });
}

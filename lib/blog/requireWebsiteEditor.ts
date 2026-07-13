import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession, type AuthenticatedSession } from "@/lib/auth/session";
import type { ActiveMembership } from "@/lib/auth/membership";

type RequireWebsiteEditorResult =
  | { error: NextResponse }
  | { session: AuthenticatedSession; membership: ActiveMembership };

export async function requireWebsiteEditor(
  req: Request,
  opts?: { ownerOnly?: boolean },
): Promise<RequireWebsiteEditorResult> {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return { error: NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 }) };
  }

  if (!session.activeCompanyId) {
    return {
      error: NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 }),
    };
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: {
      userId: true,
      companyId: true,
      role: true,
      membershipPriceLists: { select: { priceListId: true } },
      permissions: { select: { permission: true } },
    },
  });

  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    return { error: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }) };
  }

  if (opts?.ownerOnly && membership.role !== "OWNER") {
    return { error: NextResponse.json({ ok: false, reason: "OWNER_ONLY" }, { status: 403 }) };
  }

  return {
    session,
    membership: {
      userId: membership.userId,
      companyId: membership.companyId,
      role: membership.role,
      status: "ACTIVE",
      priceListIds: membership.membershipPriceLists.map((mpl) => mpl.priceListId),
      permissions: membership.permissions.map((p) => p.permission),
    },
  };
}

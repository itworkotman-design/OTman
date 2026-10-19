import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getModuleAccess } from "@/lib/users/access";

// Who may act on a website order's money (decline, refund the difference):
// company owner/admin, or anyone with Website orders at ADMIN level — the
// same rule as the admin website-order editor (website-items route).
export async function authorizeWebsiteOrderAdmin(req: Request) {
  const session = await getAuthenticatedSession(req);
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 }) };
  }
  if (!session.activeCompanyId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 }),
    };
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId: session.activeCompanyId, status: "ACTIVE" },
    select: { id: true, role: true, appAccess: true, user: { select: { username: true, email: true } } },
  });
  const websiteOrders = membership ? getModuleAccess(membership, "WEBSITE_ORDERS") : null;
  const canEdit =
    !!membership &&
    (membership.role === "OWNER" ||
      membership.role === "ADMIN" ||
      (!!websiteOrders?.enabled && websiteOrders.level === "ADMIN"));
  if (!membership || !canEdit) {
    return { ok: false as const, response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }) };
  }

  const actor = {
    membershipId: membership.id,
    name: membership.user.username ?? null,
    email: membership.user.email,
    source: "USER",
  } as const;

  return { ok: true as const, companyId: session.activeCompanyId, membership, actor };
}

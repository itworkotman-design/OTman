import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasFullAccess } from "@/lib/users/access";
import type { Role } from "@/lib/users/types";

// Price-list mutation routes (create/update/delete pricelists, items,
// special options) are Owner/Admin only — the read-only "Price lists" page
// only ever needs GET (list ?mine=true, or a single pricelist by id), which
// stays open to any authenticated member. Call this at the top of any
// mutating handler under app/api/products/pricelists/**; on success it
// returns the membership, on failure it returns the NextResponse to return
// directly from the route.
export async function requireFullAccessMembership(session: {
  userId: string;
  activeCompanyId: string | null;
} | null): Promise<
  | { ok: true; membership: { role: Role } }
  | { ok: false; response: NextResponse }
> {
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  if (!session.activeCompanyId) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 }),
    };
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.userId,
      companyId: session.activeCompanyId,
      status: "ACTIVE",
    },
    select: { role: true },
  });

  if (!membership || !hasFullAccess(membership.role as Role)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }),
    };
  }

  return { ok: true, membership: { role: membership.role as Role } };
}

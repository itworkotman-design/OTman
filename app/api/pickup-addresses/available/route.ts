import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getActiveMembership } from "@/lib/auth/membership";
import { hasFullAccess } from "@/lib/users/access";

// User-scoped list of usable custom pickup addresses — this is the only
// source order creation (and the warehouse-default lookup) may read from.
// It must never be inferred from a client-supplied list, since the whole
// point is that a manipulated request can't surface an address that isn't
// assigned to the caller. The one exception is full-access (Owner/Admin)
// callers, who — like everywhere else full access shortcuts a permission
// check — can see and use every active address regardless of assignment.
export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const membership = await getActiveMembership({ userId: session.userId, companyId: session.activeCompanyId });
  const isFullAccess = Boolean(membership && hasFullAccess(membership.role));

  const pickupAddresses = await prisma.customPickupAddress.findMany({
    where: isFullAccess
      ? { isActive: true }
      : { isActive: true, users: { some: { userId: session.userId } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      icon: true,
      color: true,
      phone: true,
    },
  });

  return NextResponse.json({ ok: true, pickupAddresses });
}

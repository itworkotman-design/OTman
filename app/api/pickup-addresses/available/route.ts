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

  // Optional delivery-date range (booking archive Pickup filter): only
  // addresses that this company's orders in that range are picked up from,
  // same as the Store filter's order-creators?hasOrders=true&fromDate=…
  const url = new URL(req.url);
  const fromDate = url.searchParams.get("fromDate") || null;
  const toDate = url.searchParams.get("toDate") || null;
  const ordersInRange =
    fromDate || toDate
      ? {
          ordersUsingThis: {
            some: {
              companyId: session.activeCompanyId,
              deliveryDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) },
            },
          },
        }
      : {};

  const pickupAddresses = await prisma.customPickupAddress.findMany({
    where: isFullAccess
      ? { isActive: true, ...ordersInRange }
      : { isActive: true, users: { some: { userId: session.userId } }, ...ordersInRange },
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

// User-scoped list of usable custom pickup addresses — this is the only
// source order creation (and the warehouse-default lookup) may read from.
// It must never be inferred from a client-supplied list, since the whole
// point is that a manipulated request can't surface an address that isn't
// assigned to the caller.
export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const pickupAddresses = await prisma.customPickupAddress.findMany({
    where: { isActive: true, users: { some: { userId: session.userId } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, address: true, latitude: true, longitude: true, icon: true, color: true },
  });

  return NextResponse.json({ ok: true, pickupAddresses });
}

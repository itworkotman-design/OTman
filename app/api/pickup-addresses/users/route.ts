import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { requireFullAccessMembership } from "@/lib/products/pricelistAccess";
import { getUserAccessType } from "@/lib/users/access";
import type { AppPermission, Role } from "@/lib/users/types";

// Lightweight cross-tenant user listing — used to populate the per-user
// visibility multi-select on the pickup-addresses settings page. Custom
// pickup addresses are only ever meant to be handed to people who actually
// create orders, so this only surfaces users who hold Order-creator booking
// access (Booking enabled at Admin level, short of full company access) in
// at least one active membership — full-access Owners/Admins already see
// every address regardless of assignment (see /api/pickup-addresses/available),
// and Subcontractors/no-booking-access users have no use for one at all.
export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);
  const auth = await requireFullAccessMembership(session);

  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      username: true,
      mainPickupAddress: { select: { id: true, name: true } },
      mainReturnAddress: { select: { id: true, name: true } },
      memberships: {
        where: { status: "ACTIVE" },
        select: {
          role: true,
          permissions: { select: { permission: true } },
        },
      },
    },
  });

  const orderCreators = users
    .filter((user) =>
      user.memberships.some(
        (membership) =>
          getUserAccessType(
            membership.role as Role,
            membership.permissions.map((p) => p.permission as AppPermission),
          ) === "ORDER_CREATOR",
      ),
    )
    .map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      mainPickupAddress: user.mainPickupAddress,
      mainReturnAddress: user.mainReturnAddress,
    }));

  return NextResponse.json({ ok: true, users: orderCreators });
}

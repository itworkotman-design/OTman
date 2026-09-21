import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { requireFullAccessMembership } from "@/lib/products/pricelistAccess";

function toIdArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
}

// Nominates/clears a user's "main" pickup address (the one that makes their
// warehouse address field read-only). A user can only be nominated for an
// address that's already directly assigned to them — this is the
// settings-page write path described in the plan; UserModal itself never
// writes this field.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthenticatedSession(req);
  const auth = await requireFullAccessMembership(session);

  if (!auth.ok) return auth.response;

  const pickupAddress = await prisma.customPickupAddress.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!pickupAddress) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const addUserIds = toIdArray(body?.addUserIds);
  const removeUserIds = toIdArray(body?.removeUserIds);
  // The same nomination, for the user's default return to gjenvinning address.
  const addReturnUserIds = toIdArray(body?.addReturnUserIds);
  const removeReturnUserIds = toIdArray(body?.removeReturnUserIds);

  const nominatedUserIds = [...new Set([...addUserIds, ...addReturnUserIds])];

  if (nominatedUserIds.length > 0) {
    const assignments = await prisma.userCustomPickupAddress.findMany({
      where: { customPickupAddressId: id, userId: { in: nominatedUserIds } },
      select: { userId: true },
    });
    const eligibleUserIds = new Set(assignments.map((a) => a.userId));
    const ineligible = nominatedUserIds.filter((userId) => !eligibleUserIds.has(userId));

    if (ineligible.length > 0) {
      return NextResponse.json(
        { ok: false, reason: "USER_NOT_ELIGIBLE", message: "One or more users don't have this pickup address assigned." },
        { status: 400 },
      );
    }
  }

  if (addUserIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: addUserIds } },
      data: { mainPickupAddressId: id },
    });
  }

  if (removeUserIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: removeUserIds }, mainPickupAddressId: id },
      data: { mainPickupAddressId: null },
    });
  }

  if (addReturnUserIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: addReturnUserIds } },
      data: { mainReturnAddressId: id },
    });
  }

  if (removeReturnUserIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: removeReturnUserIds }, mainReturnAddressId: id },
      data: { mainReturnAddressId: null },
    });
  }

  return NextResponse.json({ ok: true });
}

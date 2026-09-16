import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { requireFullAccessMembership } from "@/lib/products/pricelistAccess";
import { validateCustomPickupAddressInput } from "@/lib/pickupAddresses/validateInput";

function toUserList(entry: { users: { user: { id: string; email: string; username: string | null } }[] }) {
  return entry.users.map((u) => u.user);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthenticatedSession(req);
  const auth = await requireFullAccessMembership(session);

  if (!auth.ok) return auth.response;

  const pickupAddress = await prisma.customPickupAddress.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      isActive: true,
      users: { select: { user: { select: { id: true, email: true, username: true } } } },
    },
  });

  if (!pickupAddress) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  const users = toUserList(pickupAddress);

  const mainUsers = await prisma.user.findMany({
    where: { mainPickupAddressId: id },
    select: { id: true, email: true, username: true },
  });

  return NextResponse.json({
    ok: true,
    pickupAddress: { ...pickupAddress, users },
    mainUsers,
    eligibleUsers: users,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAuthenticatedSession(req);
  const auth = await requireFullAccessMembership(session);

  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const isTogglingOnly =
    Object.prototype.hasOwnProperty.call(body, "isActive") &&
    body.name === undefined &&
    body.address === undefined &&
    body.latitude === undefined &&
    body.longitude === undefined &&
    body.userIds === undefined;

  if (isTogglingOnly) {
    await prisma.customPickupAddress.update({
      where: { id },
      data: { isActive: Boolean(body.isActive) },
    });

    return NextResponse.json({ ok: true });
  }

  const validated = validateCustomPickupAddressInput(body);

  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, reason: validated.error.reason, message: validated.error.message },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {
    name: validated.value.name,
    address: validated.value.address,
    latitude: validated.value.latitude,
    longitude: validated.value.longitude,
  };

  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((v): v is string => typeof v === "string" && v.length > 0)
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.customPickupAddress.update({ where: { id }, data });

    if (userIds !== null) {
      await tx.userCustomPickupAddress.deleteMany({ where: { customPickupAddressId: id } });

      if (userIds.length > 0) {
        await tx.userCustomPickupAddress.createMany({
          data: userIds.map((userId) => ({ customPickupAddressId: id, userId })),
        });
      }

      // A user dropped from visibility can't stay "main" for this address —
      // otherwise their warehouse address field stays locked read-only to an
      // address they can no longer see or select.
      await tx.user.updateMany({
        where: { mainPickupAddressId: id, id: { notIn: userIds } },
        data: { mainPickupAddressId: null },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

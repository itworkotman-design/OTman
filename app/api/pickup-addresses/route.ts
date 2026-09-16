import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { requireFullAccessMembership } from "@/lib/products/pricelistAccess";
import { validateCustomPickupAddressInput } from "@/lib/pickupAddresses/validateInput";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);
  const auth = await requireFullAccessMembership(session);

  if (!auth.ok) return auth.response;

  const pickupAddresses = await prisma.customPickupAddress.findMany({
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
      isActive: true,
      users: { select: { user: { select: { id: true, email: true, username: true } } } },
    },
  });

  return NextResponse.json({
    ok: true,
    pickupAddresses: pickupAddresses.map((address) => ({
      id: address.id,
      name: address.name,
      address: address.address,
      latitude: address.latitude,
      longitude: address.longitude,
      icon: address.icon,
      color: address.color,
      phone: address.phone,
      isActive: address.isActive,
      users: address.users.map((entry) => entry.user),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);
  const auth = await requireFullAccessMembership(session);

  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const validated = validateCustomPickupAddressInput(body);

  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, reason: validated.error.reason, message: validated.error.message },
      { status: 400 },
    );
  }

  const userIds = Array.isArray((body as Record<string, unknown> | null)?.userIds)
    ? ((body as { userIds: unknown[] }).userIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ))
    : [];

  const pickupAddress = await prisma.customPickupAddress.create({
    data: {
      name: validated.value.name,
      address: validated.value.address,
      latitude: validated.value.latitude,
      longitude: validated.value.longitude,
      icon: validated.value.icon,
      color: validated.value.color,
      phone: validated.value.phone,
      ...(userIds.length > 0
        ? { users: { create: userIds.map((userId) => ({ userId })) } }
        : {}),
    },
  });

  return NextResponse.json({ ok: true, pickupAddressId: pickupAddress.id });
}

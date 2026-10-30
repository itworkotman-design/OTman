// app/api/orders/prepare-email-groups/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { canEditOrders } from "@/lib/users/orderAccess";
import type { AppPermission } from "@/lib/users/types";
import {
  buildContactRecipients,
  getOrderStoreMembershipId,
  groupOrdersForPrepareEmail,
  type PrepareEmailContact,
} from "@/lib/orders/prepareOrdersEmailGroups";
import { readStoredExtraPickups } from "@/lib/orders/extraPickups";

// Resolves who each selected order's "prepare orders" email goes to, so the
// booking archive can send them all in one click. Only resolves recipients —
// the client then sends each group through /api/orders/send-prepare-email.
export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!session.activeCompanyId) {
    return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  }

  const companyId = session.activeCompanyId;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId, status: "ACTIVE" },
    select: { id: true, role: true, permissions: { select: { permission: true } } },
  });

  const permissions = (membership?.permissions ?? []).map((p): AppPermission => p.permission);

  if (!membership || !canEditOrders(membership.role, permissions)) {
    return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const orderIds: string[] = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (orderIds.length === 0) {
    return NextResponse.json({ ok: false, reason: "INVALID_ORDER_IDS" }, { status: 400 });
  }

  const rows = await prisma.order.findMany({
    where: { id: { in: orderIds }, companyId },
    select: {
      id: true,
      customPickupAddressId: true,
      customerMembershipId: true,
      createdByMembershipId: true,
      pickupAddress: true,
      extraPickupContacts: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const orders = rows.map(({ extraPickupContacts, ...order }) => ({
    ...order,
    pickupAddress: order.pickupAddress ?? "",
    extraPickups: readStoredExtraPickups(extraPickupContacts),
  }));

  const pickupIds = [
    ...new Set(
      orders
        .flatMap((order) => [order.customPickupAddressId, ...order.extraPickups.map((pickup) => pickup.customPickupAddressId)])
        .filter((id): id is string => !!id),
    ),
  ];
  const storeIds = [...new Set(orders.map(getOrderStoreMembershipId))];

  const [pickupMemberships, storeMemberships] = await Promise.all([
    pickupIds.length > 0
      ? prisma.membership.findMany({
          where: {
            companyId,
            status: "ACTIVE",
            user: { status: "ACTIVE", mainPickupAddressId: { in: pickupIds } },
          },
          select: {
            id: true,
            warehouseEmail: true,
            user: {
              select: {
                email: true,
                username: true,
                mainPickupAddressId: true,
                mainPickupAddress: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.membership.findMany({
      where: { id: { in: storeIds }, companyId },
      select: {
        id: true,
        warehouseEmail: true,
        user: { select: { email: true, username: true } },
      },
    }),
  ]);

  const pickupContacts = new Map<string, PrepareEmailContact>();
  for (const item of pickupMemberships) {
    const pickupId = item.user.mainPickupAddressId;
    // Settings links one main user per pickup; if several exist, the oldest wins.
    if (!pickupId || pickupContacts.has(pickupId)) continue;
    const name = item.user.mainPickupAddress?.name || item.user.username?.trim() || item.user.email;
    pickupContacts.set(pickupId, { name, recipients: buildContactRecipients(name, item.user.email, item.warehouseEmail) });
  }

  const storeContacts = new Map<string, PrepareEmailContact>();
  for (const item of storeMemberships) {
    const name = item.user.username?.trim() || item.user.email;
    storeContacts.set(item.id, { name, recipients: buildContactRecipients(name, item.user.email, item.warehouseEmail) });
  }

  const { groups, unresolved } = groupOrdersForPrepareEmail(orders, pickupContacts, storeContacts);

  return NextResponse.json({ ok: true, groups, unresolved });
}

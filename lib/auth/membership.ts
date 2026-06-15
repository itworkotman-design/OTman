import { prisma } from "@/lib/db";

export type AppPermission = "BOOKING_VIEW" | "BOOKING_CREATE";

export type ActiveMembership = {
  userId: string;
  companyId: string;
  role: "OWNER" | "ADMIN" | "USER";
  status: "ACTIVE";
  priceListIds: string[];
  permissions: AppPermission[];
};

export async function getActiveMembership(params: {
  userId: string;
  companyId: string;
}): Promise<ActiveMembership | null> {
  const membership = await prisma.membership.findFirst({
    where: {
      userId: params.userId,
      companyId: params.companyId,
      status: "ACTIVE",
    },
    select: {
      userId: true,
      companyId: true,
      role: true,
      status: true,
      membershipPriceLists: {
        select: {
          priceListId: true,
        },
      },
      permissions: {
        select: {
          permission: true,
        },
      },
    },
  });

  if (!membership) return null;

  return {
    userId: membership.userId,
    companyId: membership.companyId,
    role: membership.role,
    status: "ACTIVE",
    priceListIds: membership.membershipPriceLists.map((mpl) => mpl.priceListId),
    permissions: (membership.permissions ?? []).map(
      (p: { permission: AppPermission }) => p.permission,
    ),
  };
}

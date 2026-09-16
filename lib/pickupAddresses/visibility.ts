import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/auth/membership";
import { hasFullAccess } from "@/lib/users/access";

export type VisibleCustomPickupAddress = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
};

// Re-resolves a custom pickup address by id, scoped to a specific user's
// visibility grant. Never trust a client-submitted name/address/lat/lng for a
// custom pickup address — always look it up through here so a manipulated
// request can't use an address that isn't assigned to the caller, or
// one that's been soft-deleted. Mirrors GET /api/pickup-addresses/available
// (the list this id was picked from): a full-access (Owner/Admin) caller can
// use any active address regardless of assignment, not just ones explicitly
// assigned to them — otherwise an address the list lets them pick would fail
// to resolve here and reject the order/distance-calc with a false
// "not available".
export async function getVisibleCustomPickupAddress(
  customPickupAddressId: string,
  userId: string,
  companyId: string,
): Promise<VisibleCustomPickupAddress | null> {
  const membership = await getActiveMembership({ userId, companyId });
  const isFullAccess = Boolean(membership && hasFullAccess(membership.role));

  return prisma.customPickupAddress.findFirst({
    where: isFullAccess
      ? { id: customPickupAddressId, isActive: true }
      : { id: customPickupAddressId, isActive: true, users: { some: { userId } } },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      latitude: true,
      longitude: true,
    },
  });
}

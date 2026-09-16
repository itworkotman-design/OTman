import { prisma } from "@/lib/db";

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
// one that's been soft-deleted.
export async function getVisibleCustomPickupAddress(
  customPickupAddressId: string,
  userId: string,
): Promise<VisibleCustomPickupAddress | null> {
  return prisma.customPickupAddress.findFirst({
    where: {
      id: customPickupAddressId,
      isActive: true,
      users: { some: { userId } },
    },
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

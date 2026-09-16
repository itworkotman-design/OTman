import type { ExtraPickupInput } from "@/lib/orders/extraPickups";
import { getVisibleCustomPickupAddress } from "@/lib/pickupAddresses/visibility";

export type ExtraPickupResolutionResult = {
  extraPickups: ExtraPickupInput[];
  // Index of the first pickup whose customPickupAddressId isn't visible to
  // this user (deleted, deactivated, or never assigned to them) — the
  // caller should reject the whole request, mirroring how an invalid main
  // pickup/return customPickupAddressId is handled.
  invalidPickupIndex: number | null;
};

// Re-resolves each extra pickup's saved-address reference against the
// authoritative record, the same way the main pickup/return address fields
// are re-resolved in the order routes — a client-submitted
// customPickupAddressId is never trusted for the address text or
// coordinates it implies.
//
// Deliberately kept out of lib/orders/extraPickups.ts: that module (and its
// pure parse/normalize helpers) is imported by BookingEditor.tsx, a client
// component. getVisibleCustomPickupAddress pulls in lib/db.ts (Prisma / the
// `pg` driver), which must never end up in the client bundle — this file
// should only ever be imported by server-side route handlers.
export async function resolveExtraPickupCustomAddresses(
  extraPickups: ExtraPickupInput[],
  userId: string,
  companyId: string,
): Promise<ExtraPickupResolutionResult> {
  const resolved: ExtraPickupInput[] = [];

  for (const [index, pickup] of extraPickups.entries()) {
    if (!pickup.customPickupAddressId) {
      // Not a saved address — keep whatever coordinate parseExtraPickups
      // already validated from the client's own manual pick (Mapbox, via our
      // retrieve proxy), rather than discarding it.
      resolved.push({ ...pickup, customPickupAddressName: null, customPickupAddressPhone: null });
      continue;
    }

    const customAddress = await getVisibleCustomPickupAddress(pickup.customPickupAddressId, userId, companyId);

    if (!customAddress) {
      return { extraPickups: resolved, invalidPickupIndex: index };
    }

    resolved.push({
      ...pickup,
      address: customAddress.address,
      customPickupAddressId: customAddress.id,
      customPickupAddressName: customAddress.name,
      customPickupAddressPhone: customAddress.phone,
      latitude: customAddress.latitude,
      longitude: customAddress.longitude,
    });
  }

  return { extraPickups: resolved, invalidPickupIndex: null };
}

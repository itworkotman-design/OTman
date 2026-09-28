import { DELIVERY_TYPES } from "@/lib/booking/constants";
import { isNoPickupAddress } from "@/lib/orders/noPickupAddress";

// Mirrors the booking form: the pickup is locked (and legitimately submitted as
// the "No shop pickup address" placeholder) only when every product card is
// install-only or return-only.
export function isPickupLockedForCards(cards: Array<{ deliveryType?: string | null }>) {
  return (
    cards.length > 0 &&
    cards.every(
      (card) => card.deliveryType === DELIVERY_TYPES.INSTALL_ONLY || card.deliveryType === DELIVERY_TYPES.RETURN_ONLY,
    )
  );
}

// Only admins may take a pickup or delivery address off an order — a stray
// removal sends a GSM driver to the wrong place or leaves the task without a
// destination. Return is excluded: it clears itself when the return option is
// deselected. Returns the first field a non-admin isn't allowed to remove.
// `existing` is the stored order on an update (removal only counts if it had
// an address); omit it on create, where any blank submission counts.
export function findForbiddenAddressRemoval(input: {
  isAdmin: boolean;
  pickupLocked: boolean;
  submitted: { pickupAddress?: unknown; deliveryAddress?: unknown };
  existing?: { pickupAddress: string | null; deliveryAddress: string | null };
}): "pickupAddress" | "deliveryAddress" | null {
  if (input.isAdmin) {
    return null;
  }

  const { pickupAddress, deliveryAddress } = input.submitted;

  if (typeof pickupAddress === "string") {
    const removed = isNoPickupAddress(pickupAddress) && (!pickupAddress.trim() || !input.pickupLocked);
    const hadAddress = input.existing ? !isNoPickupAddress(input.existing.pickupAddress) : true;

    if (removed && hadAddress) {
      return "pickupAddress";
    }
  }

  if (typeof deliveryAddress === "string" && !deliveryAddress.trim()) {
    const hadAddress = input.existing ? Boolean(input.existing.deliveryAddress?.trim()) : true;

    if (hadAddress) {
      return "deliveryAddress";
    }
  }

  return null;
}

// Stored in Order.pickupAddress for orders that need no shop pickup (install
// only / return only) — GSM and route-distance code treat it as "no pickup".
export const NO_PICKUP_ADDRESS_LABEL = "No shop pickup address";

export function isNoPickupAddress(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";

  return !normalized || normalized === NO_PICKUP_ADDRESS_LABEL.toLowerCase();
}

// The address to show once a locked pickup (install/return only) unlocks
// again. The placeholder itself is never a valid restored value — an order
// saved as install-only reopens with the placeholder as its "last address",
// and restoring that would leave an unlocked order silently without a pickup.
export function restorePickupAfterUnlock(input: {
  current: string;
  lastUnlocked: string;
  customerAddress: string;
}) {
  if (!isNoPickupAddress(input.current) || input.current.trim() === "") {
    return input.current;
  }

  return isNoPickupAddress(input.lastUnlocked) ? input.customerAddress : input.lastUnlocked;
}

// The pickup fields as submitted by the order form. When the pickup is locked
// (install/return only) or was cleared, the saved-location id and coordinates
// kept in form state must not be sent — the server would otherwise re-fill the
// address from that saved location.
export function resolvePickupForSubmit(input: {
  locked: boolean;
  pickupAddress: string;
  customPickupAddressId: string | null;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
}) {
  const pickupAddress = input.locked ? NO_PICKUP_ADDRESS_LABEL : input.pickupAddress;

  if (isNoPickupAddress(pickupAddress)) {
    return { pickupAddress, customPickupAddressId: null, pickupLatitude: null, pickupLongitude: null };
  }

  return {
    pickupAddress,
    customPickupAddressId: input.customPickupAddressId,
    pickupLatitude: input.pickupLatitude,
    pickupLongitude: input.pickupLongitude,
  };
}

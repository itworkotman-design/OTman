import { isTimeWindowComplete } from "@/lib/booking/timeWindows";

// Whether the order-details step's required fields are all filled — gates
// auto-advancing to the contact step, same as isPickupContactStepReady does
// for the pickup step. Floors count from 1 (ground floor); null = not chosen.
export function isOrderDetailsStepReady(params: {
  deliveryAddress: string;
  // A free-typed address that was never picked from the suggestions isn't
  // good enough — see AddressAutocompleteInput.
  deliveryAddressSelected: boolean;
  deliveryFloor: number | null;
  preferredDate: string;
  timeWindow: string;
}): boolean {
  return (
    params.deliveryAddress.trim().length > 0 &&
    params.deliveryAddressSelected &&
    params.deliveryFloor !== null &&
    params.deliveryFloor >= 1 &&
    params.preferredDate.trim().length > 0 &&
    isTimeWindowComplete(params.timeWindow)
  );
}

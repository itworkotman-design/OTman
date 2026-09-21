export const RETURN_TO_RECYCLING_CODE = "RETURNREC";

type AddressRef = { id: string; address: string };

// Default return address for a new order. A user's main return address only
// applies to "Retur til gjenvinning" — "Retur til butikk" (and anything else)
// keeps returning to the customer's own address.
export function resolveDefaultReturnAddress({
  selectedReturnOptionCodes,
  mainReturnAddress,
  mainPickupAddress,
  customerAddress,
}: {
  selectedReturnOptionCodes: string[];
  mainReturnAddress?: AddressRef | null;
  mainPickupAddress?: AddressRef | null;
  customerAddress: string;
}): { address: string; customAddressId: string | null } {
  if (mainReturnAddress && selectedReturnOptionCodes.includes(RETURN_TO_RECYCLING_CODE)) {
    return { address: mainReturnAddress.address, customAddressId: mainReturnAddress.id };
  }

  return { address: customerAddress, customAddressId: mainPickupAddress?.id ?? null };
}

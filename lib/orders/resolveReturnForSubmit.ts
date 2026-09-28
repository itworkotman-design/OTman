// The return fields as submitted by the order form. A hidden return section
// (no return option selected) or a blank address must never carry the saved
// return location or coordinates kept in form state — the server would
// otherwise re-fill the return address from that saved location and GSM would
// create a return task for an order that has none.
export function resolveReturnForSubmit(input: {
  shown: boolean;
  returnAddress: string;
  customReturnAddressId: string | null;
  returnLatitude: number | null;
  returnLongitude: number | null;
}) {
  if (!input.shown) {
    return { returnAddress: "", customReturnAddressId: null, returnLatitude: null, returnLongitude: null };
  }

  if (!input.returnAddress.trim()) {
    return {
      returnAddress: input.returnAddress,
      customReturnAddressId: null,
      returnLatitude: null,
      returnLongitude: null,
    };
  }

  return {
    returnAddress: input.returnAddress,
    customReturnAddressId: input.customReturnAddressId,
    returnLatitude: input.returnLatitude,
    returnLongitude: input.returnLongitude,
  };
}

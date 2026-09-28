// Decides whether the booking form should overwrite the pickup address with
// the selected customer's default. A customer without an address must never
// erase a pickup the user entered by hand; an auto-filled default is still
// cleared so the previous customer's store doesn't stay on the order.
export function shouldApplyCustomerPickup(input: {
  isInitialSync: boolean;
  hasUserEditedPickup: boolean;
  customerAddress: string;
}) {
  if (!input.customerAddress.trim()) {
    return !input.hasUserEditedPickup;
  }

  // On the initial sync the user may have already entered an address while
  // the customer list was loading; a later, deliberate switch overwrites.
  return !input.isInitialSync || !input.hasUserEditedPickup;
}

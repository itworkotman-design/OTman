// Non-blocking warning shown under the delivery date when it is set to today,
// or to a past date by someone allowed to pick one. Returns a bookingUiText key.
export function getDeliveryDateWarning({
  deliveryDate,
  today,
  deliveryDateChanged,
  allowPastDeliveryDates,
}: {
  deliveryDate: string;
  today: string;
  deliveryDateChanged: boolean;
  allowPastDeliveryDates: boolean;
}): "Warning: delivery date is in the past" | "Warning: delivery date is today" | null {
  const date = deliveryDate.trim();
  if (!date || !deliveryDateChanged) {
    return null;
  }

  if (date === today) {
    return "Warning: delivery date is today";
  }

  if (allowPastDeliveryDates && date < today) {
    return "Warning: delivery date is in the past";
  }

  return null;
}

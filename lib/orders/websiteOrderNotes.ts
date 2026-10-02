// The pickup/floor/lift lines a public white-goods order adds to its
// description, one per line. The order also stores one combined floor/lift
// pair (Order.floorNo/lift), which GSM dispatch already prints on every task
// ("Etasje - 5", "Heis - Nei" — see lib/integrations/gsm/buildOrderPayload.ts),
// so the delivery floor/lift lines are left out whenever that pair says
// exactly the same thing, to not repeat them. When the stored pair came from
// the pickup instead (see costliestFloor), they're kept.
export function buildWebsiteOrderNoteLines(params: {
  pickupSourceLabel: string | null;
  pickupPlaceName: string | null;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  isStorePickup: boolean;
  pickupFloor: number;
  pickupLiftAvailable: boolean;
  deliveryFloor: number;
  deliveryLiftAvailable: boolean;
  orderFloorNo: string;
  orderLift: "yes" | "no";
}): string[] {
  const yesNo = (value: boolean) => (value ? "yes" : "no");
  const deliveryShownByGsm =
    params.orderFloorNo === String(params.deliveryFloor) && params.orderLift === yesNo(params.deliveryLiftAvailable);

  return [
    params.pickupSourceLabel ? `Picking up from: ${params.pickupSourceLabel}` : null,
    params.pickupPlaceName ? `Store/business name: ${params.pickupPlaceName}` : null,
    params.pickupContactName ? `Pickup contact: ${params.pickupContactName}` : null,
    params.pickupContactPhone ? `Pickup contact phone: ${params.pickupContactPhone}` : null,
    !params.isStorePickup && params.pickupFloor !== 0 ? `Pickup floor: ${params.pickupFloor}` : null,
    !params.isStorePickup ? `Lift available at pickup: ${yesNo(params.pickupLiftAvailable)}` : null,
    !deliveryShownByGsm && params.deliveryFloor !== 0 ? `Delivery floor: ${params.deliveryFloor}` : null,
    !deliveryShownByGsm ? `Lift available at delivery: ${yesNo(params.deliveryLiftAvailable)}` : null,
  ].filter((line): line is string => line !== null);
}

// Splits a website order's free text into its two order fields: the
// customer's own comment (the flow's last "comments" box) goes to
// customerComments, which GSM and the dashboard show as the customer's words;
// the generated note/multi-pickup lines go to the internal description.
export function buildWebsiteOrderTextFields(params: {
  customerComment: string | null;
  noteLines: string[];
  multiPickupLines: string[];
}): { customerComments: string | null; description: string | null } {
  const description = [params.noteLines.join("\n"), params.multiPickupLines.join("\n")]
    .filter((block) => block.length > 0)
    .join("\n\n");
  return { customerComments: params.customerComment || null, description: description || null };
}

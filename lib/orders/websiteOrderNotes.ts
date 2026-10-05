// The pickup lines a homepage website order writes into its internal
// description (read by staff and drivers, also in GSM): one line per pickup
// stop — its type, name/contact, address and, once the order is split
// across stops, which products it collects — with a "*floor N, lift" line
// under it when the stop has a floor (never for a store), and the delivery's
// floor/lift when the order's one stored floor/lift pair (Order.floorNo/
// lift, which GSM prints on every task) doesn't already say it:
//
//   Pickup 1 - Store: Power (Smalvollveien 65, 0667 Oslo) - picking up: Mikrobølgeovn
//
//   Pickup 2 - Private: Troll / 00000000 (Eivind Olsens vei, Drammen) - picking up: Kommode
//       *floor 10, no lift

export type PickupNoteStop = {
  source: string | null;
  placeName: string | null;
  address: string | null;
  // 0 = not given.
  floor: number;
  liftAvailable: boolean;
  contactName: string | null;
  contactPhone: string | null;
  productNames: string[];
};

const STOP_TYPE_LABELS: Record<string, string> = {
  store: "Store",
  private: "Private",
  business: "Business",
};

function capitalize(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : "";
}

function floorLine(floor: number, liftAvailable: boolean): string {
  return `    *floor ${floor}, ${liftAvailable ? "lift" : "no lift"}`;
}

function stopLine(stop: PickupNoteStop, index: number): string {
  const type = stop.source ? STOP_TYPE_LABELS[stop.source] : undefined;
  const contact = [capitalize(stop.contactName), stop.contactPhone?.trim()].filter(Boolean).join(" / ");
  const name = [capitalize(stop.placeName), contact].filter(Boolean).join(", ");
  const who = type ? ` - ${type}${name ? `: ${name}` : ""}` : name ? ` - ${name}` : "";
  const where = stop.address?.trim() ? ` (${stop.address.trim()})` : "";
  const what = stop.productNames.length > 0 ? ` - picking up: ${stop.productNames.join(", ")}` : "";
  return `Pickup ${index + 1}${who}${where}${what}`;
}

export function buildPickupNoteLines(params: {
  stops: PickupNoteStop[];
  deliveryFloor: number;
  deliveryLiftAvailable: boolean;
  orderFloorNo: string;
  orderLift: "yes" | "no";
}): string[] {
  const blocks = params.stops.map((stop, i) => [
    stopLine(stop, i),
    ...(stop.source !== "store" && stop.floor !== 0 ? [floorLine(stop.floor, stop.liftAvailable)] : []),
  ]);

  const deliveryShownByGsm =
    params.orderFloorNo === String(params.deliveryFloor) &&
    params.orderLift === (params.deliveryLiftAvailable ? "yes" : "no");
  if (!deliveryShownByGsm) {
    blocks.push([
      "Delivery",
      params.deliveryFloor !== 0
        ? floorLine(params.deliveryFloor, params.deliveryLiftAvailable)
        : `    *${params.deliveryLiftAvailable ? "lift" : "no lift"}`,
    ]);
  }

  return blocks.flatMap((block, i) => (i === 0 ? block : ["", ...block]));
}

// LEGACY — the note format before buildPickupNoteLines. Only still used to
// recognise (and replace) those notes on older orders when an admin edits
// them (websiteOrderDetailsEdit.ts).
//
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

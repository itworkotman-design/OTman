// What "My order" sends when the customer saves: only the parts they
// actually changed (compared with the order as it was loaded), so an
// untouched section is never mistaken for a change. The date, the stops, the
// delivery and a move's addresses/ends are left out after the 24h cutoff —
// the page locks them then, and the server would refuse them anyway
// (lib/orders/customerOrderEditPolicy.ts); a move can still get services.

// A move as "My order" edits it (lib/orders/movingOrderEdit.ts's MovingEdit).
export type CustomerMovingDraft = { serviceCodes: string[] } & Record<string, unknown>;

export type CustomerEditDraft = {
  customer: { name: string; phone: string; email: string; comments: string };
  preferredDate: string;
  timeWindow: string;
  pickups?: unknown[];
  delivery?: unknown;
  productCards?: unknown[];
  moving?: CustomerMovingDraft;
};

export type CustomerEditPayload = Partial<Omit<CustomerEditDraft, "pickups" | "delivery" | "productCards" | "moving">> & {
  pickups?: unknown[];
  delivery?: unknown;
  productCards?: unknown[];
  moving?: CustomerMovingDraft;
};

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export function buildCustomerEditPayload(
  initial: CustomerEditDraft,
  current: CustomerEditDraft,
  beforeCutoff: boolean,
): CustomerEditPayload {
  const payload: CustomerEditPayload = {};
  if (changed(initial.customer, current.customer)) payload.customer = current.customer;
  if (current.productCards && changed(initial.productCards, current.productCards)) payload.productCards = current.productCards;
  if (beforeCutoff) {
    if (initial.preferredDate !== current.preferredDate || initial.timeWindow !== current.timeWindow) {
      payload.preferredDate = current.preferredDate;
      payload.timeWindow = current.timeWindow;
    }
    if (current.pickups && changed(initial.pickups, current.pickups)) payload.pickups = current.pickups;
    if (current.delivery !== undefined && changed(initial.delivery, current.delivery)) payload.delivery = current.delivery;
    if (current.moving && changed(initial.moving, current.moving)) payload.moving = current.moving;
  } else if (initial.moving && current.moving) {
    // Within 24h a move can only get more services: sent on the move exactly
    // as loaded, so nothing else about it can slip through.
    if (changed(initial.moving.serviceCodes, current.moving.serviceCodes)) {
      payload.moving = { ...initial.moving, serviceCodes: current.moving.serviceCodes };
    }
  } else if (initial.pickups && current.pickups) {
    // A pickup's contact person can still change: sent on the stops exactly
    // as loaded, so nothing else about them can slip through.
    const withContacts = withPickupContacts(initial.pickups, current.pickups);
    if (changed(withPickupContacts(initial.pickups, initial.pickups), withContacts)) payload.pickups = withContacts;
  }
  return payload;
}

type Stop = Record<string, unknown>;

// The stops as the server sent them, with only each one's contact person
// taken from the form — what's compared and sent within 24h of the job, so a
// stop the page rebuilt slightly differently (e.g. card ids worked out from
// an older order's product names) never reads as an address change.
export function withPickupContacts(loaded: unknown[], form: unknown[]): Stop[] {
  return loaded.map((stop, i) => {
    const now = (form[i] ?? {}) as Stop;
    return { ...(stop as Stop), contactName: now.contactName ?? "", contactPhone: now.contactPhone ?? "" };
  });
}

// What the edit bar's main button does. While the whole order can still be
// changed the customer sees the summary (the same one a new order ends on)
// before saving; within 24h the changes are small and saved straight away.
export function customerEditPrimaryAction(params: { beforeCutoff: boolean; summaryOpen: boolean }): "summary" | "save" {
  return params.beforeCutoff && !params.summaryOpen ? "summary" : "save";
}

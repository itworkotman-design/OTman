// What "My order" sends when the customer saves: only the parts they
// actually changed (compared with the order as it was loaded), so an
// untouched section is never mistaken for a change. The date, the stops and
// the delivery are left out after the 24h cutoff — the page locks them then,
// and the server would refuse them anyway (lib/orders/customerOrderEditPolicy.ts).

export type CustomerEditDraft = {
  customer: { name: string; phone: string; email: string; comments: string };
  preferredDate: string;
  timeWindow: string;
  pickups?: unknown[];
  delivery?: unknown;
  productCards?: unknown[];
};

export type CustomerEditPayload = Partial<Omit<CustomerEditDraft, "pickups" | "delivery" | "productCards">> & {
  pickups?: unknown[];
  delivery?: unknown;
  productCards?: unknown[];
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

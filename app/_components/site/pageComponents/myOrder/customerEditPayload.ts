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
  }
  return payload;
}

import type { MovingEdit } from "@/lib/orders/movingOrderEdit";

// What the admin's moving edit tab holds, and what its save sends to
// PUT /api/orders/[orderId]/moving-details: only the parts that changed — the
// move as a whole (re-priced by the server) and/or the contact details.

export type MovingEditDraft = {
  edit: MovingEdit;
  customer: { name: string; phone: string; email: string; comments: string };
};

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export function movingEditBody(initial: MovingEditDraft, current: MovingEditDraft): Partial<MovingEditDraft> {
  const body: Partial<MovingEditDraft> = {};
  if (changed(initial.edit, current.edit)) body.edit = current.edit;
  if (changed(initial.customer, current.customer)) body.customer = current.customer;
  return body;
}

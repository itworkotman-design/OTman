import { isTimeWindowComplete } from "@/lib/booking/timeWindows";
import type { MovingEdit } from "@/lib/orders/movingOrderEdit";
import { parseMovingProperty } from "@/lib/orders/movingProperty";
import type { BookingCustomerType } from "@/lib/orders/websiteBookingDetails";

// What the admin's moving edit tab holds, and what its save sends to
// PUT /api/orders/[orderId]/moving-details: only the parts that changed — the
// move as a whole (re-priced by the server), the contact details, the date and
// time window, and the customer type (as the delivery Edit tab).

export type MovingEditDraft = {
  edit: MovingEdit;
  customer: { name: string; phone: string; email: string; comments: string };
  customerType: BookingCustomerType | null;
  schedule: { preferredDate: string; timeWindow: string };
};

export type MovingEditBody = {
  edit?: MovingEdit;
  customer?: MovingEditDraft["customer"];
  customerType?: BookingCustomerType;
  preferredDate?: string;
  timeWindow?: string;
};

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export function movingEditBody(initial: MovingEditDraft, current: MovingEditDraft): MovingEditBody {
  const body: MovingEditBody = {};
  if (changed(initial.edit, current.edit)) body.edit = current.edit;
  if (changed(initial.customer, current.customer)) body.customer = current.customer;
  if (current.customerType && initial.customerType !== current.customerType) body.customerType = current.customerType;
  if (changed(initial.schedule, current.schedule)) {
    body.preferredDate = current.schedule.preferredDate;
    body.timeWindow = current.schedule.timeWindow;
  }
  return body;
}

// One thing keeping Save disabled: a field of either end (as the server's
// parseMovingProperty checks it, plus its address), or the time window.
export type MovingEditBlocker = {
  end: "origin" | "destination" | null;
  field: "address" | "homeType" | "sizeOptionCode" | "floors" | "floorNumber" | "hasLift" | "parking" | "timeWindow";
};

const PROPERTY_FIELDS = ["homeType", "sizeOptionCode", "floors", "floorNumber", "hasLift", "parking"] as const;

export function movingEditBlockers(draft: MovingEditDraft): MovingEditBlocker[] {
  const blockers: MovingEditBlocker[] = [];
  const ends = [
    ["origin", draft.edit.pickupAddress, draft.edit.origin],
    ["destination", draft.edit.deliveryAddress, draft.edit.destination],
  ] as const;
  for (const [end, address, property] of ends) {
    if (!address.trim()) blockers.push({ end, field: "address" });
    const parsed = parseMovingProperty(property);
    if (!parsed.ok) for (const field of PROPERTY_FIELDS) if (field in parsed.errors) blockers.push({ end, field });
  }
  if (draft.schedule.timeWindow && !isTimeWindowComplete(draft.schedule.timeWindow)) blockers.push({ end: null, field: "timeWindow" });
  return blockers;
}

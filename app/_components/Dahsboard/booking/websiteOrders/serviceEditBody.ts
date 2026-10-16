import { isTimeWindowComplete } from "@/lib/booking/timeWindows";
import { isServiceChoiceReady } from "@/lib/content/serviceRequestCatalog";
import type { ServiceEdit } from "@/lib/orders/serviceOrderEdit";
import type { BookingCustomerType } from "@/lib/orders/websiteBookingDetails";

// What the admin's service Edit tab holds, and what its save sends to
// PUT /api/orders/[orderId]/service-details: only the parts that changed — the
// request as a whole (service, job, address, quote), the contact details, the
// date and time window, and the customer type (as the moving Edit tab).

export type ServiceEditDraft = {
  edit: ServiceEdit;
  customer: { name: string; phone: string; email: string; comments: string };
  customerType: BookingCustomerType | null;
  schedule: { preferredDate: string; timeWindow: string };
};

export type ServiceEditBody = {
  edit?: ServiceEdit;
  customer?: ServiceEditDraft["customer"];
  customerType?: BookingCustomerType;
  preferredDate?: string;
  timeWindow?: string;
};

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export function serviceEditBody(initial: ServiceEditDraft, current: ServiceEditDraft): ServiceEditBody {
  const body: ServiceEditBody = {};
  if (changed(initial.edit, current.edit)) body.edit = current.edit;
  if (changed(initial.customer, current.customer)) body.customer = current.customer;
  if (current.customerType && initial.customerType !== current.customerType) body.customerType = current.customerType;
  if (changed(initial.schedule, current.schedule)) {
    body.preferredDate = current.schedule.preferredDate;
    body.timeWindow = current.schedule.timeWindow;
  }
  return body;
}

// One field keeping Save disabled (the server checks the same: parseServiceEdit).
export type ServiceEditBlocker = "serviceCode" | "customService" | "jobDescription" | "address" | "quote" | "timeWindow";

const badPrice = (value: number | null) => value !== null && (!Number.isFinite(value) || value < 0);

export function serviceEditBlockers(draft: ServiceEditDraft): ServiceEditBlocker[] {
  const { edit } = draft;
  const blockers: ServiceEditBlocker[] = [];
  if (!isServiceChoiceReady(edit.serviceCode, edit.customService)) {
    blockers.push(isServiceChoiceReady(edit.serviceCode, "x") ? "customService" : "serviceCode");
  }
  if (!edit.jobDescription.trim()) blockers.push("jobDescription");
  if (!edit.address.trim()) blockers.push("address");
  if (badPrice(edit.quote.customer) || badPrice(edit.quote.partner)) blockers.push("quote");
  if (draft.schedule.timeWindow && !isTimeWindowComplete(draft.schedule.timeWindow)) blockers.push("timeWindow");
  return blockers;
}

import { parseServiceChoice, SERVICE_REQUEST_CUSTOM_CODE } from "@/lib/content/serviceRequestCatalog";
import type { BookingCustomerType } from "./websiteBookingDetails";

// What the customer answered in the homepage "Services" modal, kept on the
// order (Order.websiteBookingDetails, websiteOrderKind = SERVICE_ORDER_KIND)
// so the admin WebsiteOrderModal can show it as cards and edit it. The
// address, date and time window live on the order's own columns (an edit
// updates those), like a move's.

export const SERVICE_ORDER_KIND = "SERVICE";

export type ServiceBookingDetails = {
  version: 1;
  customerType: BookingCustomerType | null;
  // A SERVICE_REQUEST_OPTIONS code; customService names the custom one.
  serviceCode: string;
  customService: string;
  jobDescription: string;
};

export function buildServiceBookingDetails(input: Omit<ServiceBookingDetails, "version">): ServiceBookingDetails {
  return {
    version: 1,
    customerType: input.customerType,
    serviceCode: input.serviceCode,
    customService: input.serviceCode === SERVICE_REQUEST_CUSTOM_CODE ? input.customService.trim() : "",
    jobDescription: input.jobDescription,
  };
}

// The stored record, re-validated (the same service check as the booking
// route) — null for anything else, e.g. a request sent before this was stored.
export function parseServiceBookingDetails(value: unknown): ServiceBookingDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.jobDescription !== "string") return null;
  const service = parseServiceChoice(raw.serviceCode, raw.customService);
  if (!service.ok) return null;
  const customerType = raw.customerType === "private" || raw.customerType === "business" ? raw.customerType : null;
  return buildServiceBookingDetails({
    customerType,
    serviceCode: service.code,
    customService: service.customService,
    jobDescription: raw.jobDescription,
  });
}

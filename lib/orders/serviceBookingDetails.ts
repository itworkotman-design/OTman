import { parseServiceChoice, SERVICE_REQUEST_CUSTOM_CODE, SERVICE_REQUEST_OPTIONS } from "@/lib/content/serviceRequestCatalog";
import type { BookingCustomerType } from "./websiteBookingDetails";
import { validateTextField } from "./websiteOrderValidation";

// What the customer answered in the homepage "Services" modal, kept on the
// order (Order.websiteBookingDetails, websiteOrderKind = SERVICE_ORDER_KIND)
// so the admin WebsiteOrderModal can show it as cards and edit it: one or
// more services, each with what needs doing. The address, date and time
// window live on the order's own columns (an edit updates those), like a
// move's.

export const SERVICE_ORDER_KIND = "SERVICE";

// One service on the request: a SERVICE_REQUEST_OPTIONS code (customService
// names the custom one) and what needs doing for it.
export type ServiceRequestItem = { serviceCode: string; customService: string; jobDescription: string };

export type ServiceBookingDetails = {
  version: 2;
  customerType: BookingCustomerType | null;
  services: ServiceRequestItem[];
};

const MAX_SERVICES = SERVICE_REQUEST_OPTIONS.length;

function item(input: ServiceRequestItem): ServiceRequestItem {
  return {
    serviceCode: input.serviceCode,
    customService: input.serviceCode === SERVICE_REQUEST_CUSTOM_CODE ? input.customService.trim() : "",
    jobDescription: input.jobDescription,
  };
}

export function buildServiceBookingDetails(input: Omit<ServiceBookingDetails, "version">): ServiceBookingDetails {
  return { version: 2, customerType: input.customerType, services: input.services.map(item) };
}

export type ParsedServiceRequestItems =
  | { ok: true; items: (ServiceRequestItem & { labelEn: string })[] }
  | { ok: false; errors: Record<string, string> };

// The services a request or an edit sends: at least one, each listed service
// at most once, each with what needs doing (no disallowed characters).
// `labelEn` is what staff see on the order. Errors are keyed
// `services.<index>.<field>`.
export function parseServiceRequestItems(raw: unknown): ParsedServiceRequestItems {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, errors: { services: "Required" } };
  if (raw.length > MAX_SERVICES) return { ok: false, errors: { services: "Too many services" } };
  const errors: Record<string, string> = {};
  const items: (ServiceRequestItem & { labelEn: string })[] = [];
  raw.forEach((entry, index) => {
    const input = entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>) : {};
    const jobDescription = typeof input.jobDescription === "string" ? input.jobDescription.trim() : "";
    if (!jobDescription) errors[`services.${index}.jobDescription`] = "Required";
    else if (validateTextField(jobDescription)) errors[`services.${index}.jobDescription`] = "Contains disallowed characters";
    const service = parseServiceChoice(input.serviceCode, input.customService);
    if (!service.ok) {
      for (const [field, message] of Object.entries(service.errors)) errors[`services.${index}.${field}`] = message;
      return;
    }
    items.push({ serviceCode: service.code, customService: service.customService, jobDescription, labelEn: service.labelEn });
  });
  const codes = items.map((i) => i.serviceCode);
  if (new Set(codes).size !== codes.length) errors.services = "Duplicate service";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, items };
}

// The stored record, re-validated (the same service check as the booking
// route) — null for anything else, e.g. a request sent before this was
// stored. A single-service request stored before services were a list
// (version 1) reads as a list of one.
export function parseServiceBookingDetails(value: unknown): ServiceBookingDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const customerType = raw.customerType === "private" || raw.customerType === "business" ? raw.customerType : null;
  const rawServices =
    raw.version === 1 ? [{ serviceCode: raw.serviceCode, customService: raw.customService, jobDescription: raw.jobDescription }] : raw.version === 2 ? raw.services : null;
  if (!Array.isArray(rawServices) || rawServices.length === 0) return null;
  // Stored text is taken as stored (only the services are checked), so an
  // older request with an empty description still opens.
  const services: ServiceRequestItem[] = [];
  for (const entry of rawServices) {
    const input = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    if (typeof input.jobDescription !== "string") return null;
    const service = parseServiceChoice(input.serviceCode, input.customService);
    if (!service.ok) return null;
    services.push({ serviceCode: service.code, customService: service.customService, jobDescription: input.jobDescription });
  }
  return buildServiceBookingDetails({ customerType, services });
}

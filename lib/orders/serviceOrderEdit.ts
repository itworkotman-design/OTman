import type { Prisma } from "@prisma/client";
import type { MovingAdjustments } from "./movingOrderCalculator";
import type { movingHandlingItemRows } from "./movingHandlingLines";
import type { MovingOrderItem } from "./movingOrderView";
import {
  buildServiceBookingDetails,
  parseServiceBookingDetails,
  parseServiceRequestItems,
  type ServiceRequestItem,
} from "./serviceBookingDetails";
import {
  LEGACY_SERVICE_QUOTE_OPTION_CODE,
  SERVICE_QUOTE_PRODUCT_CODE,
  serviceOrderAdjustedPricing,
  serviceQuoteOptionCode,
} from "./serviceOrderCalculator";
import type { CustomerEditKind } from "./customerOrderEditPolicy";
import type { BookingCustomerType } from "./websiteBookingDetails";
import { validateTextField } from "./websiteOrderValidation";

// Changing a homepage service request — shared by the admin edit
// (app/api/orders/[orderId]/service-details) and the customer's own "My
// order" (app/api/customer/orders/[orderNumber]): what the request is, as an
// editable whole — where, and each service with what needs doing and staff's
// quote for it (customer and partner price, kroner ex. VAT; never the
// customer's to change) — how a customer's change is classified, and what a
// save writes. A request lands unpriced; each quoted service is a priced line.

export type ServiceQuote = { customer: number | null; partner: number | null };

export type ServiceEditItem = ServiceRequestItem & { quote: ServiceQuote };

export type ServiceEdit = {
  address: string;
  services: ServiceEditItem[];
};

const MAX_QUOTE_KR = 10_000_000;
const NO_QUOTE: ServiceQuote = { customer: null, partner: null };

const kroner = (cents: number | null) => (cents === null ? null : cents / 100);

export function serviceEditFromOrder(order: {
  deliveryAddress: string | null;
  websiteBookingDetails: unknown;
  items: MovingOrderItem[];
}): ServiceEdit | null {
  const details = parseServiceBookingDetails(order.websiteBookingDetails);
  if (!details) return null;
  const quoteLines = order.items.filter((item) => item.productCode === SERVICE_QUOTE_PRODUCT_CODE);
  const lineFor = (serviceCode: string) =>
    quoteLines.find((line) => line.optionCode === serviceQuoteOptionCode(serviceCode)) ??
    // A single-service request's line from before services were a list.
    (details.services.length === 1 ? quoteLines.find((line) => line.optionCode === LEGACY_SERVICE_QUOTE_OPTION_CODE) : undefined);
  return {
    address: order.deliveryAddress ?? "",
    services: details.services.map((service) => {
      const line = lineFor(service.serviceCode);
      return {
        ...service,
        quote: line ? { customer: kroner(line.customerPriceCents), partner: kroner(line.subcontractorPriceCents) } : NO_QUOTE,
      };
    }),
  };
}

// What the customer answered and may change in "My order" — the request
// without staff's quotes.
export type ServiceAnswers = { address: string; services: ServiceRequestItem[] };

export function serviceAnswersOf(edit: ServiceEdit): ServiceAnswers {
  return {
    address: edit.address,
    services: edit.services.map(({ serviceCode, customService, jobDescription }) => ({ serviceCode, customService, jobDescription })),
  };
}

// A customer's change in a delivery order's terms (customerOrderEditPolicy),
// so the same 24h policy applies: a new address is "addresses", a service
// added, removed or renamed "reconfigure" (both locked within 24h of the
// job), and a job description "notes" — text about the job, open like the
// comment.
export function classifyServiceEdit(before: ServiceAnswers, after: ServiceAnswers): CustomerEditKind[] {
  const kinds: CustomerEditKind[] = [];
  const same = (a: string, b: string) => a.trim() === b.trim();
  const which = (answers: ServiceAnswers) =>
    JSON.stringify(answers.services.map((s) => `${s.serviceCode}:${s.customService.trim()}`).sort());
  if (!same(before.address, after.address)) kinds.push("addresses");
  if (which(before) !== which(after)) kinds.push("reconfigure");
  const jobChanged = after.services.some((service) => {
    const was = before.services.find((s) => s.serviceCode === service.serviceCode);
    return was && !same(was.jobDescription, service.jobDescription);
  });
  if (jobChanged) kinds.push("notes");
  return kinds;
}

export type ParsedServiceEdit =
  | { ok: true; edit: ServiceEdit; labels: string[] }
  | { ok: false; errors: Record<string, string> };

export function parseServiceEdit(raw: unknown): ParsedServiceEdit {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};
  const address = typeof input.address === "string" ? input.address.trim() : "";
  if (!address) errors.address = "Required";
  else if (validateTextField(address)) errors.address = "Contains disallowed characters";

  const parsedItems = parseServiceRequestItems(input.services);
  if (!parsedItems.ok) Object.assign(errors, parsedItems.errors);

  const rawServices = Array.isArray(input.services) ? input.services : [];
  const quoteOf = (index: number): ServiceQuote => {
    const entry = rawServices[index] && typeof rawServices[index] === "object" ? (rawServices[index] as Record<string, unknown>) : {};
    const rawQuote = entry.quote && typeof entry.quote === "object" ? (entry.quote as Record<string, unknown>) : {};
    const price = (side: "customer" | "partner") => {
      const value = rawQuote[side];
      if (value === null || value === undefined) return null;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_QUOTE_KR) {
        errors[`services.${index}.quote.${side}`] = "Invalid price";
        return null;
      }
      return Math.round(value * 100) / 100;
    };
    return { customer: price("customer"), partner: price("partner") };
  };
  const quotes = rawServices.map((_, index) => quoteOf(index));

  if (!parsedItems.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    edit: {
      address,
      services: parsedItems.items.map(({ serviceCode, customService, jobDescription }, index) => ({
        serviceCode,
        customService,
        jobDescription,
        quote: quotes[index],
      })),
    },
    labels: parsedItems.items.map((service) => service.labelEn),
  };
}

// Each quoted service as an order line (labelled with its English name) —
// none for a service not priced yet; a side left empty counts as 0.
export function serviceQuoteItemRows(services: ServiceEditItem[], labels: string[]) {
  return services.flatMap((service, index) =>
    service.quote.customer === null && service.quote.partner === null
      ? []
      : [
          {
            cardId: 0,
            productCode: SERVICE_QUOTE_PRODUCT_CODE,
            productName: "Service",
            itemType: "product",
            optionCode: serviceQuoteOptionCode(service.serviceCode),
            optionLabel: labels[index] ?? service.serviceCode,
            quantity: 1,
            customerPriceCents: Math.round((service.quote.customer ?? 0) * 100),
            subcontractorPriceCents: Math.round((service.quote.partner ?? 0) * 100),
          },
        ],
  );
}

// Service requests have no columns for the services or the jobs — staff (and
// the regular order views) read them from Order.description.
export function serviceOrderDescription(input: {
  customerType: BookingCustomerType | null;
  services: { labelEn: string; jobDescription: string }[];
}): string {
  const customerType = input.customerType === "business" ? "Business" : input.customerType === "private" ? "Private" : null;
  return [
    customerType ? `Customer type: ${customerType}` : null,
    ...input.services.map((service) => [`Service: ${service.labelEn}`, service.jobDescription].filter(Boolean).join("\n")),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function serviceOrderSummary(labels: string[]): string {
  return `Service request (${labels.join(" + ")})`;
}

// Everything a save of a service request writes on the order, plus its lines:
// the quotes, then express/deviation as staff set them (movingHandlingItemRows).
export function serviceOrderSaveData(params: {
  parsed: Extract<ParsedServiceEdit, { ok: true }>;
  customerType: BookingCustomerType | null;
  adjustments: MovingAdjustments;
  handlingRows: ReturnType<typeof movingHandlingItemRows>;
}) {
  const { parsed } = params;
  const itemRows = [...serviceQuoteItemRows(parsed.edit.services, parsed.labels), ...params.handlingRows];
  const pricing = serviceOrderAdjustedPricing(itemRows, params.adjustments);
  const bookingDetails = buildServiceBookingDetails({
    customerType: params.customerType,
    services: serviceAnswersOf(parsed.edit).services,
  });
  return {
    orderData: {
      deliveryAddress: parsed.edit.address,
      priceExVat: pricing.priceExVat,
      priceSubcontractor: pricing.priceSubcontractor,
      pricingSnapshot: pricing.pricingSnapshot as unknown as Prisma.InputJsonValue,
      productsSummary: serviceOrderSummary(parsed.labels),
      description: serviceOrderDescription({
        customerType: params.customerType,
        services: parsed.edit.services.map((service, index) => ({ labelEn: parsed.labels[index], jobDescription: service.jobDescription })),
      }),
      websiteBookingDetails: bookingDetails as unknown as Prisma.InputJsonValue,
    },
    itemRows,
    pricing,
  };
}

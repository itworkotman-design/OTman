import type { Prisma } from "@prisma/client";
import { parseServiceChoice } from "@/lib/content/serviceRequestCatalog";
import type { MovingAdjustments } from "./movingOrderCalculator";
import type { movingHandlingItemRows } from "./movingHandlingLines";
import type { MovingOrderItem } from "./movingOrderView";
import { buildServiceBookingDetails, parseServiceBookingDetails } from "./serviceBookingDetails";
import { SERVICE_QUOTE_OPTION_CODE, SERVICE_QUOTE_PRODUCT_CODE, serviceOrderAdjustedPricing } from "./serviceOrderCalculator";
import type { CustomerEditKind } from "./customerOrderEditPolicy";
import type { BookingCustomerType } from "./websiteBookingDetails";
import { validateTextField } from "./websiteOrderValidation";

// Changing a homepage service request — shared by the admin edit
// (app/api/orders/[orderId]/service-details) and the customer's own "My
// order" (app/api/customer/orders/[orderNumber]): what the request is, as an
// editable whole — the service, the job, where, and staff's quote (customer
// and partner price, kroner ex. VAT; never the customer's to change) — how a
// customer's change is classified, and what a save writes. A request lands
// unpriced; the quote is its one priced line.

export type ServiceQuote = { customer: number | null; partner: number | null };

export type ServiceEdit = {
  serviceCode: string;
  customService: string;
  jobDescription: string;
  address: string;
  quote: ServiceQuote;
};

const MAX_QUOTE_KR = 10_000_000;

const kroner = (cents: number | null) => (cents === null ? null : cents / 100);

export function serviceEditFromOrder(order: {
  deliveryAddress: string | null;
  websiteBookingDetails: unknown;
  items: MovingOrderItem[];
}): ServiceEdit | null {
  const details = parseServiceBookingDetails(order.websiteBookingDetails);
  if (!details) return null;
  const line = order.items.find((item) => item.productCode === SERVICE_QUOTE_PRODUCT_CODE);
  return {
    serviceCode: details.serviceCode,
    customService: details.customService,
    jobDescription: details.jobDescription,
    address: order.deliveryAddress ?? "",
    quote: line
      ? { customer: kroner(line.customerPriceCents), partner: kroner(line.subcontractorPriceCents) }
      : { customer: null, partner: null },
  };
}

// What the customer answered and may change in "My order" — the request
// without staff's quote.
export type ServiceAnswers = Omit<ServiceEdit, "quote">;

export function serviceAnswersOf(edit: ServiceEdit): ServiceAnswers {
  return { serviceCode: edit.serviceCode, customService: edit.customService, jobDescription: edit.jobDescription, address: edit.address };
}

// A customer's change in a delivery order's terms (customerOrderEditPolicy),
// so the same 24h policy applies: a new address is "addresses", another
// service "reconfigure" (both locked within 24h of the job), and the job
// description "notes" — text about the job, open like the comment.
export function classifyServiceEdit(before: ServiceAnswers, after: ServiceAnswers): CustomerEditKind[] {
  const kinds: CustomerEditKind[] = [];
  const same = (a: string, b: string) => a.trim() === b.trim();
  if (!same(before.address, after.address)) kinds.push("addresses");
  if (before.serviceCode !== after.serviceCode || !same(before.customService, after.customService)) kinds.push("reconfigure");
  if (!same(before.jobDescription, after.jobDescription)) kinds.push("notes");
  return kinds;
}

export type ParsedServiceEdit = { ok: true; edit: ServiceEdit; labelEn: string } | { ok: false; errors: Record<string, string> };

export function parseServiceEdit(raw: unknown): ParsedServiceEdit {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};
  const requiredText = (field: "address" | "jobDescription") => {
    const value = typeof input[field] === "string" ? (input[field] as string).trim() : "";
    if (!value) errors[field] = "Required";
    else if (validateTextField(value)) errors[field] = "Contains disallowed characters";
    return value;
  };
  const address = requiredText("address");
  const jobDescription = requiredText("jobDescription");

  const service = parseServiceChoice(input.serviceCode, input.customService);
  if (!service.ok) Object.assign(errors, service.errors);

  const rawQuote = input.quote && typeof input.quote === "object" ? (input.quote as Record<string, unknown>) : {};
  const price = (side: "customer" | "partner") => {
    const value = rawQuote[side];
    if (value === null || value === undefined) return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_QUOTE_KR) {
      errors[`quote.${side}`] = "Invalid price";
      return null;
    }
    return Math.round(value * 100) / 100;
  };
  const quote = { customer: price("customer"), partner: price("partner") };

  if (!service.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    edit: { serviceCode: service.code, customService: service.customService, jobDescription, address, quote },
    labelEn: service.labelEn,
  };
}

// The quote as the order's line — none until a price is given; a side left
// empty counts as 0.
export function serviceQuoteItemRows(quote: ServiceQuote, labelEn: string) {
  if (quote.customer === null && quote.partner === null) return [];
  return [
    {
      cardId: 0,
      productCode: SERVICE_QUOTE_PRODUCT_CODE,
      productName: "Service",
      itemType: "product",
      optionCode: SERVICE_QUOTE_OPTION_CODE,
      optionLabel: labelEn,
      quantity: 1,
      customerPriceCents: Math.round((quote.customer ?? 0) * 100),
      subcontractorPriceCents: Math.round((quote.partner ?? 0) * 100),
    },
  ];
}

// Service requests have no columns for the service or the job — staff (and
// the regular order views) read them from Order.description.
export function serviceOrderDescription(input: {
  labelEn: string;
  customerType: BookingCustomerType | null;
  jobDescription: string | null;
}): string {
  const customerType = input.customerType === "business" ? "Business" : input.customerType === "private" ? "Private" : null;
  return [`Service: ${input.labelEn}`, customerType ? `Customer type: ${customerType}` : null, input.jobDescription]
    .filter(Boolean)
    .join("\n\n");
}

export function serviceOrderSummary(labelEn: string): string {
  return `Service request (${labelEn})`;
}

// Everything a save of a service request writes on the order, plus its lines:
// the quote, then express/deviation as staff set them (movingHandlingItemRows).
export function serviceOrderSaveData(params: {
  parsed: Extract<ParsedServiceEdit, { ok: true }>;
  customerType: BookingCustomerType | null;
  adjustments: MovingAdjustments;
  handlingRows: ReturnType<typeof movingHandlingItemRows>;
}) {
  const { parsed } = params;
  const itemRows = [...serviceQuoteItemRows(parsed.edit.quote, parsed.labelEn), ...params.handlingRows];
  const pricing = serviceOrderAdjustedPricing(itemRows, params.adjustments);
  const bookingDetails = buildServiceBookingDetails({
    customerType: params.customerType,
    serviceCode: parsed.edit.serviceCode,
    customService: parsed.edit.customService,
    jobDescription: parsed.edit.jobDescription,
  });
  return {
    orderData: {
      deliveryAddress: parsed.edit.address,
      priceExVat: pricing.priceExVat,
      priceSubcontractor: pricing.priceSubcontractor,
      pricingSnapshot: pricing.pricingSnapshot as unknown as Prisma.InputJsonValue,
      productsSummary: serviceOrderSummary(parsed.labelEn),
      description: serviceOrderDescription({
        labelEn: parsed.labelEn,
        customerType: params.customerType,
        jobDescription: parsed.edit.jobDescription,
      }),
      websiteBookingDetails: bookingDetails as unknown as Prisma.InputJsonValue,
    },
    itemRows,
    pricing,
  };
}

export type SmsOrderFields = {
  displayId?: number | null;
  orderNumber?: string | null;
  customerName?: string | null;
  deliveryDate?: string | null;
  timeWindow?: string | null;
  deliveryAddress?: string | null;
  pickupAddress?: string | null;
  productsSummary?: string | null;
  deliveryTypeSummary?: string | null;
  servicesSummary?: string | null;
};

export type SmsTemplateVariables = Record<string, string>;

// Shown in the template editor so admins know what they can use.
export const SMS_TEMPLATE_PLACEHOLDERS = [
  { key: "name", label: "Customer name" },
  { key: "address", label: "Delivery address (pickup address if none)" },
  { key: "date", label: "Delivery date (dd.mm.yyyy)" },
  { key: "timeWindow", label: "Time window" },
  { key: "job", label: "What we're doing: products (delivery type)" },
  { key: "products", label: "Products" },
  { key: "deliveryType", label: "Delivery type" },
  { key: "services", label: "Services" },
  { key: "orderId", label: "Order ID" },
  { key: "orderNumber", label: "Power bilagsnummer" },
] as const;

export type AutomaticSmsKind = "DAY_OF_DELIVERY" | "REVIEW_REQUEST";

const TEMPLATE_KIND_ORDER: Record<AutomaticSmsKind | "MANUAL", number> = { DAY_OF_DELIVERY: 0, REVIEW_REQUEST: 1, MANUAL: 2 };

// Automatic templates first (delivery day, then review request), then manual
// ones in their existing order (stable sort).
export function sortSmsTemplates<T extends { kind: AutomaticSmsKind | "MANUAL" }>(templates: T[]): T[] {
  return [...templates].sort((a, b) => TEMPLATE_KIND_ORDER[a.kind] - TEMPLATE_KIND_ORDER[b.kind]);
}

// Seeded (switched off) per company by GET /api/sms/templates. After that the
// name, description and body live in the DB and are edited in Settings.
export const AUTOMATIC_SMS_TEMPLATE_DEFAULTS: Record<AutomaticSmsKind, { name: string; description: string; body: string }> = {
  DAY_OF_DELIVERY: {
    name: "Automatic SMS on delivery day",
    description:
      "Sent at 09:00 on the order's delivery date to the customer's phone (Phone 2 if Phone is empty). Skips pending, cancelled, rejected and finished orders.",
    body:
      "Hei {name}! Otman kommer til deg i dag ({timeWindow}) på {address}. " +
      "Oppdrag: {job}. Spørsmål? Ring oss på +47 402 84 977. Mvh Otman",
  },
  REVIEW_REQUEST: {
    name: "Automatic review request after completion",
    description:
      "Sent after GSM automatically completes an order (completing it by hand or by bulk update never sends one), only on the same day it was completed and only between 09:00 and 22:00",
    body:
      "Hei {name}! Takk for at du valgte Otman. Vi setter stor pris på om du gir oss en omtale: " +
      "https://otman.no/reviews Mvh Otman",
  },
};

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

export function buildSmsTemplateVariables(order: SmsOrderFields): SmsTemplateVariables {
  const products = clean(order.productsSummary);
  const deliveryType = clean(order.deliveryTypeSummary);
  const services = clean(order.servicesSummary);
  // Services are deliberately left out of {job} to keep the SMS short; they
  // are still available on their own as {services}.
  const job = products && deliveryType ? `${products} (${deliveryType})` : products || deliveryType;

  return {
    name: clean(order.customerName),
    address: clean(order.deliveryAddress) || clean(order.pickupAddress),
    date: formatDate(clean(order.deliveryDate)),
    timeWindow: clean(order.timeWindow).replace("-", " - "),
    products,
    deliveryType,
    services,
    job,
    orderId: order.displayId != null ? String(order.displayId) : "",
    orderNumber: clean(order.orderNumber),
  };
}

// Unknown {placeholders} are left as typed so a typo is visible in the
// preview. Empty values would otherwise leave "()" or " ," behind, so those
// are tidied per line (line breaks are kept).
export function renderSmsTemplate(body: string, variables: SmsTemplateVariables): string {
  const replaced = body.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match,
  );

  return replaced
    .split("\n")
    .map((line) =>
      line
        .replace(/\(\s*\)/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/ +([.,!?:;])/g, "$1")
        .trim(),
    )
    .join("\n")
    .trim();
}

export function renderOrderSms(body: string, order: SmsOrderFields): string {
  return renderSmsTemplate(body, buildSmsTemplateVariables(order));
}

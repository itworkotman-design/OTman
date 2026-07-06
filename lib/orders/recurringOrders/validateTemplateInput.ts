import type { RecurrenceType } from "@prisma/client";
import { getOsloDateKey, parseIsoDate, compareIsoDate } from "@/lib/dates/isoDate";
import { isRecurrenceConfigValid } from "@/lib/orders/recurringOrders/occurrenceDates";

const RECURRENCE_TYPES: RecurrenceType[] = ["WEEKLY", "MONTHLY", "CUSTOM_DATES"];
const DEFAULT_TEMPLATE_NAME = "Untitled scheduler order";

export type ValidatedTemplateInput = {
  name: string;
  recurrenceType: RecurrenceType;
  recurrenceConfig: unknown;
  leadTimeDays: number;
  startDate: string;
  endDate: string | null;
  orderDefaults: unknown;
};

export type TemplateInputError = { reason: string; message: string };

function isNonEmptyProductCards(orderDefaults: unknown): boolean {
  if (!orderDefaults || typeof orderDefaults !== "object") return false;
  const productCards = (orderDefaults as { productCards?: unknown }).productCards;
  return Array.isArray(productCards) && productCards.length > 0;
}

// Mirrors the manual booking route's fallback (`customerMembershipId ||
// membership.id`): picking a customer/store is optional in the order form,
// so a scheduler order template defaults to the template's creator rather
// than requiring it.
function applyCustomerDefaults(
  orderDefaults: unknown,
  fallback: { membershipId: string; label: string },
): Record<string, unknown> {
  const defaults = (orderDefaults && typeof orderDefaults === "object" ? orderDefaults : {}) as Record<
    string,
    unknown
  >;

  const customerMembershipId =
    typeof defaults.customerMembershipId === "string" && defaults.customerMembershipId.trim()
      ? defaults.customerMembershipId
      : fallback.membershipId;

  const customerLabel =
    typeof defaults.customerLabel === "string" && defaults.customerLabel.trim()
      ? defaults.customerLabel
      : fallback.label;

  return { ...defaults, customerMembershipId, customerLabel };
}

// Scheduler Orders is OWNER/ADMIN-only, and admins already get to skip
// required fields in the regular booking form (`allowIncompleteRequiredFields`
// in BookingEditor). This mirrors that for order-detail fields — everything
// is defaulted instead of rejected. The one exception is the recurrence
// selection itself (see below): without it the template can't do anything,
// so it's still required, along with product cards (also required for
// admins in the manual booking flow).
export function validateTemplateInput(
  body: unknown,
  fallbackCustomer: { membershipId: string; label: string },
): { ok: true; value: ValidatedTemplateInput } | { ok: false; error: TemplateInputError } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: { reason: "INVALID_BODY", message: "Request body is required." } };
  }

  const candidate = body as Record<string, unknown>;

  const name = typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : DEFAULT_TEMPLATE_NAME;

  // recurrenceType is a Postgres enum column — an invalid value would crash
  // the insert rather than just leave the template incomplete, so this is
  // the one thing still rejected. The recurrence picker always sends a
  // valid value, so this never fires from normal use.
  const recurrenceType = RECURRENCE_TYPES.includes(candidate.recurrenceType as RecurrenceType)
    ? (candidate.recurrenceType as RecurrenceType)
    : "WEEKLY";

  // recurrenceConfig is a required Json column — fall back to a well-formed
  // (if functionally empty) shape rather than storing `undefined`/garbage,
  // which would crash the insert. An empty rule just never matches a date
  // (surfaced as BROKEN health) instead of erroring.
  const defaultConfigForType: Record<RecurrenceType, unknown> = {
    WEEKLY: { weekdays: [] },
    MONTHLY: { dayOfMonth: 1 },
    CUSTOM_DATES: { dates: [] },
  };
  const recurrenceConfig =
    candidate.recurrenceConfig && typeof candidate.recurrenceConfig === "object"
      ? candidate.recurrenceConfig
      : defaultConfigForType[recurrenceType];

  // Unlike the rest of the template, the recurrence selection stays
  // mandatory: without at least one weekday/date picked, the template would
  // never fire — that's not "incomplete data" the way a missing address is,
  // it's a non-functional automation. (MONTHLY's dayOfMonth always has a
  // valid default from the picker, so this only ever rejects an empty
  // WEEKLY/CUSTOM_DATES selection.)
  if (!isRecurrenceConfigValid(recurrenceType, recurrenceConfig)) {
    return {
      ok: false,
      error: { reason: "RECURRENCE_SELECTION_REQUIRED", message: "Select at least one weekday or date for the recurrence." },
    };
  }

  const leadTimeDays =
    typeof candidate.leadTimeDays === "number" && Number.isInteger(candidate.leadTimeDays) && candidate.leadTimeDays >= 0
      ? candidate.leadTimeDays
      : 0;

  const startDate =
    typeof candidate.startDate === "string" && parseIsoDate(candidate.startDate)
      ? candidate.startDate
      : getOsloDateKey();

  const endDate =
    typeof candidate.endDate === "string" &&
    parseIsoDate(candidate.endDate) &&
    compareIsoDate(candidate.endDate, startDate) >= 0
      ? candidate.endDate
      : null;

  // Still required, matching manual order creation: even OWNER/ADMIN can't
  // submit a booking with zero product lines there either.
  if (!isNonEmptyProductCards(candidate.orderDefaults)) {
    return { ok: false, error: { reason: "INVALID_PRODUCT_CARDS", message: "At least one product is required." } };
  }

  return {
    ok: true,
    value: {
      name,
      recurrenceType,
      recurrenceConfig,
      leadTimeDays,
      startDate,
      endDate,
      orderDefaults: applyCustomerDefaults(candidate.orderDefaults, fallbackCustomer),
    },
  };
}

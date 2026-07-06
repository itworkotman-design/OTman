import { Prisma } from "@prisma/client";
import type { RecurringOrderTemplate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDaysIso, compareIsoDate, getOsloDateKey } from "@/lib/dates/isoDate";
import { matchesRecurrence } from "@/lib/orders/recurringOrders/occurrenceDates";
import { createOrder, type CreateOrderFields } from "@/lib/orders/createOrder";
import type { SavedProductCard } from "@/app/_components/Dahsboard/booking/create/_types/productCard";
import type { ExtraPickupInput } from "@/lib/orders/extraPickups";

// A crashed run can leave an occurrence stuck at PENDING forever if we never
// retry it — this window bounds how long we treat a PENDING row as "another
// run is actively working on it" before treating it as abandoned and safe to
// reclaim.
const STALE_PENDING_MS = 30 * 60 * 1000;

export type GenerateDueOccurrencesSummary = {
  processed: number;
  created: number;
  skipped: number;
  failed: number;
};

type TemplateWithRelations = RecurringOrderTemplate & {
  company: { orderEmailsEnabled: boolean };
  createdByMembership: {
    id: string;
    user: { username: string | null; email: string };
  };
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

// `orderDefaults` is an OrderFormPayload-shaped JSON snapshot (minus
// deliveryDate/orderNumber, and any frozen price fields are ignored even if
// present) captured by the Scheduler Orders modal. It's read back loosely
// typed since it's a Json column — this applies safe fallbacks for anything
// missing or malformed rather than trusting the shape blindly.
function buildFieldsFromOrderDefaults(
  orderDefaults: unknown,
  occurrenceDate: string,
): {
  productCards: SavedProductCard[];
  priceListId: string | null;
  orderNumber: string | null;
  fields: CreateOrderFields;
} {
  const defaults = (orderDefaults ?? {}) as Record<string, unknown>;

  const asString = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  const asBoolean = (value: unknown): boolean => value === true;
  const asNumber = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  const productCards = Array.isArray(defaults.productCards)
    ? (defaults.productCards as SavedProductCard[])
    : [];

  const extraPickups = Array.isArray(defaults.extraPickups)
    ? (defaults.extraPickups as ExtraPickupInput[])
    : [];

  const customerMembershipId = asString(defaults.customerMembershipId);
  if (!customerMembershipId) {
    throw new Error("Scheduler order template is missing a customer.");
  }

  return {
    productCards,
    priceListId: asString(defaults.priceListId),
    // Free-text filtering reference, not occurrence-specific — reused as-is
    // on every order generated from this template.
    orderNumber: asString(defaults.orderNumber),
    fields: {
      description: asString(defaults.description),
      modelNr: asString(defaults.modelNr),
      deliveryDate: occurrenceDate,
      timeWindow: asString(defaults.timeWindow),
      expressDelivery: asBoolean(defaults.expressDelivery),
      contactCustomerForCustomTimeWindow: asBoolean(defaults.contactCustomerForCustomTimeWindow),
      customTimeContactNote: asString(defaults.customTimeContactNote),
      pickupAddress: asString(defaults.pickupAddress),
      extraPickups,
      returnAddress: asString(defaults.returnAddress),
      deliveryAddress: asString(defaults.deliveryAddress),
      drivingDistance: asString(defaults.drivingDistance),
      customerName: asString(defaults.customerName),
      phone: asString(defaults.phone),
      phoneTwo: asString(defaults.phoneTwo),
      email: asString(defaults.email),
      customerComments: asString(defaults.customerComments),
      floorNo: asString(defaults.floorNo),
      lift: asString(defaults.lift),
      cashierName: asString(defaults.cashierName),
      cashierPhone: asString(defaults.cashierPhone),
      subcontractorId: asString(defaults.subcontractorId),
      subcontractor: asString(defaults.subcontractor),
      driver: asString(defaults.driver),
      secondDriver: asString(defaults.secondDriver),
      driverInfo: asString(defaults.driverInfo),
      licensePlate: asString(defaults.licensePlate),
      deviation: asString(defaults.deviation),
      feeExtraWork: asBoolean(defaults.feeExtraWork),
      extraWorkMinutes: asNumber(defaults.extraWorkMinutes),
      feeAddToOrder: asBoolean(defaults.feeAddToOrder),
      statusNotes: asString(defaults.statusNotes),
      status: asString(defaults.status),
      dontSendEmail: asBoolean(defaults.dontSendEmail),
      rabatt: asString(defaults.rabatt),
      dnbDiscount: asBoolean(defaults.dnbDiscount),
      leggTil: asString(defaults.leggTil),
      subcontractorMinus: asString(defaults.subcontractorMinus),
      subcontractorPlus: asString(defaults.subcontractorPlus),
      customerMembershipId,
      customerLabel: asString(defaults.customerLabel) ?? customerMembershipId,
      // Deliberately omitted (not 0): there is no frozen total to fall back
      // to for a scheduler order, so pricing must always come from summing
      // the freshly-priced product lines. Passing 0 here would make
      // buildOrderPricingSnapshot treat it as the real total and discard the
      // line-item prices entirely.
    },
  };
}

type OccurrenceOutcome = "created" | "skipped" | "failed";

async function attemptOccurrence(
  template: TemplateWithRelations,
  occurrenceDate: string,
): Promise<OccurrenceOutcome> {
  const existing = await prisma.recurringOrderOccurrence.findUnique({
    where: {
      templateId_occurrenceDate: { templateId: template.id, occurrenceDate },
    },
  });

  if (existing) {
    // A CREATED occurrence whose Order was since deleted has its orderId set
    // to null (the FK is ON DELETE SET NULL) but keeps its CREATED status —
    // that's not "already handled" anymore, it's eligible for regeneration.
    const orderWasDeleted = existing.status === "CREATED" && existing.orderId === null;

    if ((existing.status === "CREATED" && !orderWasDeleted) || existing.status === "SKIPPED") {
      return "skipped";
    }

    if (existing.status === "PENDING") {
      const isStale = Date.now() - existing.updatedAt.getTime() > STALE_PENDING_MS;
      if (!isStale) {
        // Another run may be actively processing this occurrence right now.
        return "skipped";
      }
    }

    // Stale PENDING, FAILED, or CREATED-but-deleted: reclaim it for a retry.
    await prisma.recurringOrderOccurrence.update({
      where: { id: existing.id },
      data: { status: "PENDING", failureReason: null },
    });
  } else {
    try {
      await prisma.recurringOrderOccurrence.create({
        data: { templateId: template.id, occurrenceDate, status: "PENDING" },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // Another concurrent run just claimed this occurrence.
        return "skipped";
      }
      throw error;
    }
  }

  try {
    const { productCards, priceListId, orderNumber, fields } = buildFieldsFromOrderDefaults(
      template.orderDefaults,
      occurrenceDate,
    );

    const order = await createOrder({
      companyId: template.companyId,
      membershipId: template.createdByMembershipId,
      orderNumber,
      productCards,
      priceListId,
      actor: {
        name: template.createdByMembership.user.username ?? null,
        email: template.createdByMembership.user.email,
        source: "SYSTEM",
      },
      companyOrderEmailsEnabled: template.company.orderEmailsEnabled,
      recurringOrderTemplateId: template.id,
      recurringOrderOccurrenceDate: occurrenceDate,
      fields,
    });

    await prisma.recurringOrderOccurrence.update({
      where: { templateId_occurrenceDate: { templateId: template.id, occurrenceDate } },
      data: { status: "CREATED", orderId: order.id, generatedAt: new Date(), failureReason: null },
    });

    return "created";
  } catch (error) {
    const failureReason = toErrorMessage(error);

    await prisma.recurringOrderOccurrence
      .update({
        where: { templateId_occurrenceDate: { templateId: template.id, occurrenceDate } },
        data: { status: "FAILED", failureReason },
      })
      .catch(() => {});

    console.error(
      `[recurring-orders] failed to generate order for template ${template.id} (${template.name}) occurrence ${occurrenceDate}`,
      error,
    );

    return "failed";
  }
}

async function processTemplate(
  template: TemplateWithRelations,
  today: string,
): Promise<{ created: number; skipped: number; failed: number }> {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  // Scanning through today + leadTimeDays is exactly the set of occurrence
  // dates for which "occurrenceDate - leadTimeDays <= today" can hold, so a
  // cron run that was delayed or skipped for several days naturally catches
  // up on any still-future occurrence it missed, without a separate
  // "maxLeadTimeDays" constant. The lower bound never goes below today, so an
  // occurrence whose delivery date has already passed is never resurrected.
  const upperBound = addDaysIso(today, template.leadTimeDays);
  let cursor = compareIsoDate(today, template.startDate) >= 0 ? today : template.startDate;

  while (compareIsoDate(cursor, upperBound) <= 0) {
    if (template.endDate && compareIsoDate(cursor, template.endDate) > 0) {
      break;
    }

    if (matchesRecurrence(cursor, template.recurrenceType, template.recurrenceConfig)) {
      const outcome = await attemptOccurrence(template, cursor);
      if (outcome === "created") created += 1;
      else if (outcome === "skipped") skipped += 1;
      else failed += 1;
    }

    cursor = addDaysIso(cursor, 1);
  }

  return { created, skipped, failed };
}

export async function generateDueOccurrences(
  options: { companyId?: string; templateId?: string } = {},
): Promise<GenerateDueOccurrencesSummary> {
  const today = getOsloDateKey();
  const summary: GenerateDueOccurrencesSummary = {
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
  };

  const templates = await prisma.recurringOrderTemplate.findMany({
    where: {
      isPaused: false,
      ...(options.companyId ? { companyId: options.companyId } : {}),
      ...(options.templateId ? { id: options.templateId } : {}),
    },
    include: {
      company: { select: { orderEmailsEnabled: true } },
      createdByMembership: {
        select: {
          id: true,
          user: { select: { username: true, email: true } },
        },
      },
    },
  });

  for (const template of templates) {
    summary.processed += 1;

    try {
      const result = await processTemplate(template, today);
      summary.created += result.created;
      summary.skipped += result.skipped;
      summary.failed += result.failed;
    } catch (error) {
      summary.failed += 1;
      console.error(
        `[recurring-orders] template ${template.id} (${template.name}) failed`,
        error,
      );
    }
  }

  if (summary.failed > 0) {
    console.error(`[recurring-orders] generation run completed with failures`, summary);
  }

  return summary;
}

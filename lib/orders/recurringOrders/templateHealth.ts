import type { RecurrenceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isRecurrenceConfigValid } from "@/lib/orders/recurringOrders/occurrenceDates";

export type TemplateHealthStatus = "VALID" | "WARNING" | "BROKEN";

export type TemplateHealthInput = {
  companyId: string;
  recurrenceType: RecurrenceType;
  recurrenceConfig: unknown;
  orderDefaults: unknown;
};

function isNonEmptyProductCards(orderDefaults: unknown): boolean {
  if (!orderDefaults || typeof orderDefaults !== "object") return false;
  const productCards = (orderDefaults as { productCards?: unknown }).productCards;
  return Array.isArray(productCards) && productCards.length > 0;
}

function getCustomerMembershipId(orderDefaults: unknown): string | null {
  if (!orderDefaults || typeof orderDefaults !== "object") return null;
  const value = (orderDefaults as { customerMembershipId?: unknown }).customerMembershipId;
  return typeof value === "string" && value.trim() ? value : null;
}

export async function computeTemplateHealth(
  template: TemplateHealthInput,
): Promise<TemplateHealthStatus> {
  if (!isRecurrenceConfigValid(template.recurrenceType, template.recurrenceConfig)) {
    return "BROKEN";
  }

  if (!isNonEmptyProductCards(template.orderDefaults)) {
    return "BROKEN";
  }

  const customerMembershipId = getCustomerMembershipId(template.orderDefaults);
  if (!customerMembershipId) {
    return "BROKEN";
  }

  const customerMembership = await prisma.membership.findFirst({
    where: { id: customerMembershipId, companyId: template.companyId },
    select: { status: true },
  });

  if (!customerMembership || customerMembership.status !== "ACTIVE") {
    return "WARNING";
  }

  return "VALID";
}

import type { Prisma, PrismaClient } from "@prisma/client";
import { hasPartner, isPartnerTrackedOrder } from "@/lib/orders/partnerRequirement";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type PartnerFields = {
  subcontractorMembershipId: string;
  subcontractor: string;
};

// Cancelled orders get a fixed placeholder partner, configured by email in
// CANCELLED_ORDER_PARTNER_EMAIL and resolved to that user's membership in the
// order's company. Unset env var or no such member (e.g. a dev DB) = no-op.
export async function findCancelledOrderPartner(
  prisma: PrismaLike,
  companyId: string,
): Promise<PartnerFields | null> {
  const email = process.env.CANCELLED_ORDER_PARTNER_EMAIL?.trim().toLowerCase();
  if (!email) return null;

  const membership = await prisma.membership.findFirst({
    where: {
      companyId,
      status: "ACTIVE",
      user: { email: { equals: email, mode: "insensitive" } },
    },
    select: { id: true, user: { select: { username: true, email: true } } },
  });

  if (!membership) return null;

  return {
    subcontractorMembershipId: membership.id,
    subcontractor: membership.user.username?.trim() || membership.user.email,
  };
}

// Partner fields to merge into an order update when it moves into cancelled
// without a partner; {} in every other case (an existing partner is kept).
export async function cancelledOrderPartnerData(
  prisma: PrismaLike,
  input: {
    companyId: string;
    displayId?: number | null;
    previousStatus: string | null | undefined;
    nextStatus: string | null | undefined;
    partner: { subcontractorMembershipId?: string | null; subcontractor?: string | null };
  },
): Promise<Partial<PartnerFields>> {
  if (!isPartnerTrackedOrder(input.displayId)) return {};
  if (normalizeOrderStatus(input.nextStatus) !== "cancelled") return {};
  if (normalizeOrderStatus(input.previousStatus) === "cancelled") return {};
  if (hasPartner(input.partner)) return {};

  return (await findCancelledOrderPartner(prisma, input.companyId)) ?? {};
}

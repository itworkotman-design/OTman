import { prisma } from "@/lib/db";
import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";
import {
  PARTNER_TRACKING_MIN_DISPLAY_ID,
  hasPartner,
  requiresPartner,
} from "@/lib/orders/partnerRequirement";
import { createNoSubcontractorAlert } from "./noSubcontractorAlert";

const GRACE_PERIOD_HOURS = 24;

// Raw status values (canonical + legacy Norwegian) that normalize into a
// partner-required status. Matched case-insensitively.
const PARTNER_REQUIRED_RAW_STATUSES = [
  "failed",
  "fail",
  "feilet",
  "completed",
  "ferdig",
  "invoiced",
  "fakturet",
  "fakturert",
  "paid",
  "betalt",
];

export type MissingPartnerSweepSummary = {
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
};

export function parseMissingPartnerLimitParam(searchParams: URLSearchParams) {
  const raw = searchParams.get("limit");
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

// Called by the daily cron route. Alerts on orders that have sat in
// failed/completed/invoiced/paid for over a day with no partner, regardless
// of whether the status was set from the dashboard, bulk update or the GSM
// webhook. Re-alerts every day until fixed: createNoSubcontractorAlert only
// skips while an unresolved alert is open.
export async function runMissingPartnerAlertSweep(params?: {
  limit?: number;
}): Promise<MissingPartnerSweepSummary> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_HOURS * 60 * 60 * 1000);

  const candidates = await prisma.order.findMany({
    where: {
      status: { in: PARTNER_REQUIRED_RAW_STATUSES, mode: "insensitive" },
      subcontractorMembershipId: null,
      gdprAnonymized: false,
      // Legacy pre-app orders are never alerted.
      displayId: { gte: PARTNER_TRACKING_MIN_DISPLAY_ID },
      OR: [{ subcontractor: null }, { subcontractor: "" }],
      // Deliberately not updatedAt: resolving the alert updates the order row,
      // which would restart the clock and stop the daily re-alert.
      statusChangedAt: { lte: cutoff },
    },
    select: {
      id: true,
      companyId: true,
      status: true,
      subcontractor: true,
      subcontractorMembershipId: true,
    },
    orderBy: { statusChangedAt: "asc" },
    take: params?.limit,
  });

  const summary: MissingPartnerSweepSummary = {
    scanned: candidates.length,
    created: 0,
    skipped: 0,
    failed: 0,
  };

  for (const order of candidates) {
    if (!requiresPartner(order.status) || hasPartner(order)) {
      summary.skipped += 1;
      continue;
    }

    try {
      const created = await createNoSubcontractorAlert(prisma, {
        orderId: order.id,
        companyId: order.companyId,
        status: normalizeOrderStatus(order.status),
        overdue: true,
      });

      if (created) summary.created += 1;
      else summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      console.error("[missing-partner-alerts] failed to create alert", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}

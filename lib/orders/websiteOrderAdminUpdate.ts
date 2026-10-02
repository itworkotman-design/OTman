import { normalizeOrderStatus } from "./statusPresentation";

// The admin actions in WebsiteOrderModal save through the existing
// PATCH /api/orders/bulk with this one order's id — status, status notes and
// partner change there without re-pricing the order (which the full order
// save would do). This turns the form into that request body.

export type WebsiteOrderAdminFields = {
  status: string | null;
  statusNotes: string | null;
  subcontractorId: string | null;
};

export type WebsiteOrderAdminUpdate =
  | {
      ok: true;
      body: { orderIds: string[]; status?: string; statusNotes?: string; subcontractorId?: string };
    }
  | { ok: false; reason: "NO_CHANGES" | "NOTES_NEED_STATUS_CHANGE" | "REJECTION_COMMENT_REQUIRED" };

export function buildWebsiteOrderAdminUpdate(
  orderId: string,
  initial: WebsiteOrderAdminFields,
  next: WebsiteOrderAdminFields,
): WebsiteOrderAdminUpdate {
  const nextStatus = normalizeOrderStatus(next.status);
  // Only a real change is sent: re-sending e.g. "approved" would re-run its
  // side effects (a new payment link).
  const statusChanged = nextStatus !== "" && nextStatus !== normalizeOrderStatus(initial.status);
  const nextNotes = next.statusNotes?.trim() ?? "";
  const notesChanged = nextNotes !== (initial.statusNotes?.trim() ?? "");
  const nextPartner = next.subcontractorId?.trim() ?? "";
  // The bulk update can set a partner but not clear one.
  const partnerChanged = nextPartner !== "" && nextPartner !== (initial.subcontractorId?.trim() ?? "");

  if (statusChanged && nextStatus === "rejected" && !nextNotes) {
    return { ok: false, reason: "REJECTION_COMMENT_REQUIRED" };
  }
  // The bulk update only takes notes alongside a status change.
  if (notesChanged && !statusChanged) {
    return { ok: false, reason: "NOTES_NEED_STATUS_CHANGE" };
  }
  if (!statusChanged && !partnerChanged) {
    return { ok: false, reason: "NO_CHANGES" };
  }

  return {
    ok: true,
    body: {
      orderIds: [orderId],
      ...(statusChanged ? { status: nextStatus } : {}),
      ...(statusChanged && nextNotes ? { statusNotes: nextNotes } : {}),
      ...(partnerChanged ? { subcontractorId: nextPartner } : {}),
    },
  };
}

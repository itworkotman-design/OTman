// Shared between the audit-log JSON API, the PDF export, and the dashboard
// UI so the event type list and human-readable labels/detail text can never
// drift between what's shown on screen and what gets exported.

export const GDPR_AUDIT_EVENT_TYPES = [
  "GDPR_ANONYMIZED",
  "GDPR_POD_DELETED",
  "GDPR_HOLD_SET",
  "GDPR_HOLD_REMOVED",
] as const;

export type GdprAuditEventType = (typeof GDPR_AUDIT_EVENT_TYPES)[number];

export const GDPR_EVENT_LABELS: Record<string, string> = {
  GDPR_ANONYMIZED: "Anonymized",
  GDPR_POD_DELETED: "POD deleted",
  GDPR_HOLD_SET: "Hold placed",
  GDPR_HOLD_REMOVED: "Hold removed",
};

// The payload only ever carries field names / counts / hold reasons, never
// the anonymized values themselves (see lib/gdpr/runGdprCleanup.ts and
// app/api/orders/gdpr/hold/route.ts).
export function formatGdprEventDetail(type: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;

  switch (type) {
    case "GDPR_ANONYMIZED": {
      const fields = Array.isArray(p.fields) ? p.fields.join(", ") : "";
      return fields ? `Fields: ${fields}` : "";
    }
    case "GDPR_POD_DELETED": {
      const count = typeof p.attachmentCount === "number" ? p.attachmentCount : 0;
      return `${count} POD file(s) removed`;
    }
    case "GDPR_HOLD_SET": {
      const reason = typeof p.reason === "string" ? p.reason : "";
      return reason ? `Reason: ${reason}` : "";
    }
    default:
      return "";
  }
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// `to` comes in as a plain YYYY-MM-DD date-input value, so it needs pushing
// to the end of that day or the whole final day would be excluded from the
// `lte` filter.
export function parseAuditLogDateRange(searchParams: URLSearchParams): {
  from: Date | null;
  to: Date | null;
} {
  const from = parseDateParam(searchParams.get("from"));
  const to = parseDateParam(searchParams.get("to"));

  if (to) {
    to.setHours(23, 59, 59, 999);
  }

  return { from, to };
}

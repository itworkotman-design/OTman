import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

// Pure rules for anonymizing a homepage (website) order's personal data —
// used by the website sweep in ./websiteOrderGdpr.ts. Amounts, products,
// dates and payment records stay: they're the accounting trail.

export const GDPR_REDACTED = "[GDPR: anonymized]";

// A homepage order is finished — its 90 days start — once it's completed,
// cancelled, declined (refunded) or rejected.
const FINISHED = new Set(["completed", "cancelled", "refunded", "rejected"]);

export function isFinishedWebsiteOrderStatus(status: string | null | undefined): boolean {
  return FINISHED.has(normalizeOrderStatus(status));
}

// Keys in the stored booking details (lib/orders/websiteBookingDetails.ts,
// serviceBookingDetails.ts) that hold who the customer is or where they live,
// at any depth. Blanked to "" (not removed) so the details still parse.
const BOOKING_TEXT_KEYS = new Set([
  "address",
  "deliveryAddress",
  "pickupAddress",
  "placeName",
  "contactName",
  "contactPhone",
  "comment",
  "orgNumber",
  "jobDescription",
]);
const BOOKING_LIST_KEYS = new Set(["extraPickupAddress"]);

export function scrubBookingDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubBookingDetails);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (BOOKING_TEXT_KEYS.has(key) && typeof entry === "string") return [key, ""];
      if (BOOKING_LIST_KEYS.has(key) && Array.isArray(entry)) return [key, []];
      return [key, scrubBookingDetails(entry)];
    }),
  );
}

// An OrderStateSnapshot (lib/orders/paidOrderSnapshot.ts) stored on a
// payment or refund: its stops' address, place name and contact go.
const SNAPSHOT_DETAIL_KEY = /(^|\.)(address|place|contact)$/;

export function scrubStateSnapshot(value: unknown): unknown {
  if (!value || typeof value !== "object" || !Array.isArray((value as { details?: unknown }).details)) return value;
  const snapshot = value as { details: unknown[] };
  return {
    ...snapshot,
    details: snapshot.details.map((detail) => {
      const entry = detail as { key?: unknown; value?: unknown };
      return typeof entry?.key === "string" && SNAPSHOT_DETAIL_KEY.test(entry.key) ? { ...entry, value: "" } : detail;
    }),
  };
}

// Order fields that identify the customer, as named in the order history
// (OrderEventChange.field, the created event's snapshot).
const PERSONAL_ORDER_FIELDS = new Set([
  "customerName",
  "customerLabel",
  "phone",
  "phoneTwo",
  "email",
  "deliveryAddress",
  "pickupAddress",
  "returnAddress",
  "extraPickupAddress",
  "extraPickupContacts",
  "customerComments",
  "description",
  "statusNotes",
  "floorNo",
  "lift",
  "customTimeContactNote",
  "cashierName",
  "cashierPhone",
  "websiteBookingDetails",
]);

type Payload = Record<string, unknown>;

// One OrderEvent payload (lib/orders/orderEvents.ts): personal values in
// updates, a status change's note, an action's detail lines and the created
// event's snapshot are redacted; titles, statuses, prices and product
// changes stay. Other kinds are left alone.
export function scrubEventPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as Payload;
  switch (p.kind) {
    case "updated":
      return {
        ...p,
        changes: Array.isArray(p.changes)
          ? p.changes.map((change) => {
              const c = change as Payload;
              return typeof c?.field === "string" && PERSONAL_ORDER_FIELDS.has(c.field)
                ? { ...c, previousValue: GDPR_REDACTED, nextValue: GDPR_REDACTED }
                : change;
            })
          : p.changes,
      };
    case "action":
      return { ...p, details: Array.isArray(p.details) ? p.details.map(() => GDPR_REDACTED) : p.details };
    case "status_changed":
      return p.note ? { ...p, note: GDPR_REDACTED } : p;
    case "created": {
      const snapshot = p.snapshot as Payload | undefined;
      if (!snapshot || typeof snapshot !== "object") return p;
      return {
        ...p,
        snapshot: Object.fromEntries(
          Object.entries(snapshot).map(([key, entry]) =>
            PERSONAL_ORDER_FIELDS.has(key) ? [key, Array.isArray(entry) ? [] : null] : [key, entry],
          ),
        ),
      };
    }
    default:
      return payload;
  }
}

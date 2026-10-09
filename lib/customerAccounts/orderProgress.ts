import { normalizeOrderStatus } from "@/lib/orders/statusPresentation";

// The step bar on "My order": where the order is, in the customer's terms,
// read straight from the status staff (and the GSM webhook) set on the order
// and its STATUS_CHANGED events (for when each step was reached).
//
//   Bestilling mottatt → Under behandling → Bekreftet → På vei → Fullført
//
// An order is in review as soon as it is in the dashboard (status
// processing). A rejected order is still in review, flagged "Trenger
// endring". A cancelled order ends with a red "Kansellert" step right after
// the last step it reached — unless it was already on its way, then (like a
// failed order) it ends with "Ikke gjennomført" in Fullført's place.

export type OrderProgressStepKey =
  | "received"
  | "review"
  | "needsChange"
  | "confirmed"
  | "onTheWay"
  | "completed"
  | "cancelled"
  | "notCompleted";

// done = reached and passed; current = the order is in this step right now
// (in review, on its way); attention = waiting on the customer (needs a
// change); stopped = the order ended here (cancelled / not carried out).
export type OrderProgressStepState = "done" | "current" | "upcoming" | "attention" | "stopped";

export type OrderProgressStep = { key: OrderProgressStepKey; state: OrderProgressStepState; at: Date | null };

export type OrderProgress = {
  steps: OrderProgressStep[];
  // What the page should explain under the bar, if anything.
  note: "needsChange" | "cancelled" | "notCompleted" | null;
};

const STEP_KEYS = ["received", "review", "confirmed", "onTheWay", "completed"] as const;
const REVIEW = 1;
const ON_THE_WAY = 3;

// The step each status puts the order at.
const STEP_OF_STATUS: Record<string, number> = {
  processing: 1,
  rejected: 1,
  approved: 2,
  confirmed: 2,
  active: 3,
  completed: 4,
  invoiced: 4,
  paid: 4,
};

type StatusEvent = { toStatus: string; createdAt: Date };

export function buildOrderProgress(order: { status: string | null; createdAt: Date; statusEvents: StatusEvent[] }): OrderProgress {
  const status = normalizeOrderStatus(order.status);
  const events = [...order.statusEvents]
    .map((event) => ({ status: normalizeOrderStatus(event.toStatus), createdAt: event.createdAt }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // When each step was first reached. Received and review: when ordered.
  const firstAt: (Date | null)[] = [order.createdAt, order.createdAt, null, null, null];
  for (const event of events) {
    const step = STEP_OF_STATUS[event.status];
    if (step !== undefined && step > REVIEW && firstAt[step] === null) firstAt[step] = event.createdAt;
  }
  const done = (count: number): OrderProgressStep[] =>
    STEP_KEYS.slice(0, count).map((key, i) => ({ key, state: "done", at: firstAt[i] }));

  if (status === "cancelled" || status === "failed") {
    // How far it got before it was stopped (the latest switch to this status).
    let stoppedIndex = -1;
    events.forEach((event, i) => {
      if (event.status === status) stoppedIndex = i;
    });
    const stoppedAt = stoppedIndex >= 0 ? events[stoppedIndex].createdAt : null;
    const before = stoppedIndex >= 0 ? events.slice(0, stoppedIndex) : events;
    let reached = Math.max(REVIEW, ...before.map((event) => STEP_OF_STATUS[event.status] ?? REVIEW));
    if (status === "failed") reached = Math.max(reached, ON_THE_WAY);

    if (reached >= ON_THE_WAY) {
      return { steps: [...done(ON_THE_WAY + 1), { key: "notCompleted", state: "stopped", at: stoppedAt }], note: "notCompleted" };
    }
    return { steps: [...done(reached + 1), { key: "cancelled", state: "stopped", at: stoppedAt }], note: "cancelled" };
  }

  if (status === "rejected") {
    const rejectedAt = [...events].reverse().find((event) => event.status === "rejected")?.createdAt ?? null;
    return {
      steps: STEP_KEYS.map((key, i) =>
        i < REVIEW
          ? { key, state: "done", at: firstAt[i] }
          : i === REVIEW
            ? { key: "needsChange", state: "attention", at: rejectedAt }
            : { key, state: "upcoming", at: null },
      ),
      note: "needsChange",
    };
  }

  const reached = STEP_OF_STATUS[status] ?? REVIEW;
  return {
    steps: STEP_KEYS.map((key, i) => ({
      key,
      state: i > reached ? "upcoming" : i === reached && (i === REVIEW || i === ON_THE_WAY) ? "current" : "done",
      at: i <= reached ? firstAt[i] : null,
    })),
    note: null,
  };
}

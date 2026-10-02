import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindManyMock: vi.fn(),
  createNoSubcontractorAlertMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findMany: mocks.orderFindManyMock },
  },
}));

vi.mock("./noSubcontractorAlert", () => ({
  createNoSubcontractorAlert: mocks.createNoSubcontractorAlertMock,
}));

import {
  parseMissingPartnerLimitParam,
  runMissingPartnerAlertSweep,
} from "./missingPartnerSweep";

const NOW = new Date("2026-10-02T07:00:00.000Z");
const CUTOFF = new Date("2026-10-01T07:00:00.000Z");

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    companyId: "c1",
    status: "completed",
    subcontractor: null,
    subcontractorMembershipId: null,
    ...overrides,
  };
}

describe("runMissingPartnerAlertSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.orderFindManyMock.mockResolvedValue([]);
    mocks.createNoSubcontractorAlertMock.mockResolvedValue({ id: "n1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("only queries partnerless final-status orders whose status is older than 24h", async () => {
    await runMissingPartnerAlertSweep();

    const args = mocks.orderFindManyMock.mock.calls[0][0];
    expect(args.where.status).toMatchObject({ mode: "insensitive" });
    expect(args.where.status.in).toEqual(
      expect.arrayContaining(["failed", "completed", "invoiced", "paid", "ferdig", "betalt"]),
    );
    expect(args.where.status.in).not.toContain("cancelled");
    expect(args.where.subcontractorMembershipId).toBeNull();
    expect(args.where.gdprAnonymized).toBe(false);
    // Legacy pre-app orders (display id < 20000) are never alerted.
    expect(args.where.displayId).toEqual({ gte: 20000 });
    expect(args.where.OR).toEqual([{ subcontractor: null }, { subcontractor: "" }]);
    // Only an actual status change starts the clock. updatedAt must not be
    // used: resolving the alert itself bumps it, which would stop re-alerting.
    expect(args.where.statusChangedAt).toEqual({ lte: CUTOFF });
    expect(JSON.stringify(args.where)).not.toContain("updatedAt");
  });

  it("creates an alert for each matching order, passing its status", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      order({ id: "o1", status: "completed" }),
      order({ id: "o2", companyId: "c2", status: "betalt" }),
    ]);

    const summary = await runMissingPartnerAlertSweep();

    expect(mocks.createNoSubcontractorAlertMock).toHaveBeenCalledWith(expect.anything(), {
      orderId: "o1",
      companyId: "c1",
      status: "completed",
      overdue: true,
    });
    expect(mocks.createNoSubcontractorAlertMock).toHaveBeenCalledWith(expect.anything(), {
      orderId: "o2",
      companyId: "c2",
      status: "paid",
      overdue: true,
    });
    expect(summary).toEqual({ scanned: 2, created: 2, skipped: 0, failed: 0 });
  });

  it("counts an order with an already-open alert as skipped", async () => {
    mocks.orderFindManyMock.mockResolvedValue([order()]);
    mocks.createNoSubcontractorAlertMock.mockResolvedValue(null);

    const summary = await runMissingPartnerAlertSweep();

    expect(summary).toEqual({ scanned: 1, created: 0, skipped: 1, failed: 0 });
  });

  it("skips rows that turn out to have a partner or a non-final status", async () => {
    mocks.orderFindManyMock.mockResolvedValue([
      order({ id: "has-partner", subcontractor: "  Acme  " }),
      order({ id: "wrong-status", status: "confirmed" }),
    ]);

    const summary = await runMissingPartnerAlertSweep();

    expect(mocks.createNoSubcontractorAlertMock).not.toHaveBeenCalled();
    expect(summary).toEqual({ scanned: 2, created: 0, skipped: 2, failed: 0 });
  });

  it("keeps going when one alert fails to be created", async () => {
    mocks.orderFindManyMock.mockResolvedValue([order({ id: "o1" }), order({ id: "o2" })]);
    mocks.createNoSubcontractorAlertMock
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({ id: "n2" });

    const summary = await runMissingPartnerAlertSweep();

    expect(summary).toEqual({ scanned: 2, created: 1, skipped: 0, failed: 1 });
  });

  it("passes the limit through to the query", async () => {
    await runMissingPartnerAlertSweep({ limit: 50 });

    expect(mocks.orderFindManyMock.mock.calls[0][0].take).toBe(50);
  });
});

describe("parseMissingPartnerLimitParam", () => {
  it("parses a positive number and ignores invalid values", () => {
    expect(parseMissingPartnerLimitParam(new URLSearchParams("limit=25"))).toBe(25);
    expect(parseMissingPartnerLimitParam(new URLSearchParams("limit=abc"))).toBeUndefined();
    expect(parseMissingPartnerLimitParam(new URLSearchParams(""))).toBeUndefined();
  });
});

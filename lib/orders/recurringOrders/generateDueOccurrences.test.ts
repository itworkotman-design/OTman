import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  templateFindManyMock: vi.fn(),
  occurrenceFindUniqueMock: vi.fn(),
  occurrenceCreateMock: vi.fn(),
  occurrenceUpdateMock: vi.fn(),
  createOrderMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    recurringOrderTemplate: { findMany: mocks.templateFindManyMock },
    recurringOrderOccurrence: {
      findUnique: mocks.occurrenceFindUniqueMock,
      create: mocks.occurrenceCreateMock,
      update: mocks.occurrenceUpdateMock,
    },
  },
}));

vi.mock("@/lib/orders/createOrder", () => ({
  createOrder: mocks.createOrderMock,
}));

import { generateDueOccurrences } from "./generateDueOccurrences";

function baseTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "template-1",
    name: "Weekly template",
    companyId: "company-1",
    createdByMembershipId: "membership-1",
    isPaused: false,
    recurrenceType: "WEEKLY" as const,
    recurrenceConfig: { weekdays: [1] }, // Monday
    leadTimeDays: 0,
    startDate: "2026-01-01",
    endDate: null,
    orderDefaults: {
      productCards: [{ cardId: 1 }],
      customerMembershipId: "customer-membership-1",
      customerLabel: "Customer",
    },
    company: { orderEmailsEnabled: true },
    createdByMembership: { id: "membership-1", user: { username: "Staff", email: "staff@example.com" } },
    ...overrides,
  };
}

describe("generateDueOccurrences", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-07-06 is a Monday.
    vi.setSystemTime(new Date("2026-07-06T10:00:00.000Z"));
    vi.clearAllMocks();
    mocks.createOrderMock.mockResolvedValue({ id: "order-1" });
    mocks.occurrenceUpdateMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an order for a due occurrence with no prior occurrence row", async () => {
    mocks.templateFindManyMock.mockResolvedValue([baseTemplate()]);
    mocks.occurrenceFindUniqueMock.mockResolvedValue(null);
    mocks.occurrenceCreateMock.mockResolvedValue({});

    const summary = await generateDueOccurrences();

    expect(summary).toEqual({ processed: 1, created: 1, skipped: 0, failed: 0 });
    expect(mocks.occurrenceCreateMock).toHaveBeenCalledWith({
      data: { templateId: "template-1", occurrenceDate: "2026-07-06", status: "PENDING" },
    });
    expect(mocks.createOrderMock).toHaveBeenCalledTimes(1);
    expect(mocks.createOrderMock.mock.calls[0][0]).toMatchObject({
      companyId: "company-1",
      membershipId: "membership-1",
      recurringOrderTemplateId: "template-1",
      recurringOrderOccurrenceDate: "2026-07-06",
      actor: { source: "SYSTEM" },
    });
    expect(mocks.occurrenceUpdateMock).toHaveBeenCalledWith({
      where: { templateId_occurrenceDate: { templateId: "template-1", occurrenceDate: "2026-07-06" } },
      data: expect.objectContaining({ status: "CREATED", orderId: "order-1" }),
    });
  });

  it("does not reprocess an already CREATED occurrence whose order still exists", async () => {
    mocks.templateFindManyMock.mockResolvedValue([baseTemplate()]);
    mocks.occurrenceFindUniqueMock.mockResolvedValue({
      id: "occ-1",
      status: "CREATED",
      orderId: "order-1",
      updatedAt: new Date("2026-07-06T09:00:00.000Z"),
    });

    const summary = await generateDueOccurrences();

    expect(summary).toEqual({ processed: 1, created: 0, skipped: 1, failed: 0 });
    expect(mocks.createOrderMock).not.toHaveBeenCalled();
    expect(mocks.occurrenceUpdateMock).not.toHaveBeenCalled();
    expect(mocks.occurrenceCreateMock).not.toHaveBeenCalled();
  });

  it("regenerates an occurrence whose CREATED order was since deleted", async () => {
    // Deleting the Order sets RecurringOrderOccurrence.orderId to null (ON
    // DELETE SET NULL) but leaves status as CREATED — this must be treated
    // as eligible for regeneration, not "already handled".
    mocks.templateFindManyMock.mockResolvedValue([baseTemplate()]);
    mocks.occurrenceFindUniqueMock.mockResolvedValue({
      id: "occ-1",
      status: "CREATED",
      orderId: null,
      updatedAt: new Date("2026-07-06T09:00:00.000Z"),
    });

    const summary = await generateDueOccurrences();

    expect(summary).toEqual({ processed: 1, created: 1, skipped: 0, failed: 0 });
    expect(mocks.occurrenceUpdateMock).toHaveBeenCalledWith({
      where: { id: "occ-1" },
      data: { status: "PENDING", failureReason: null },
    });
    expect(mocks.createOrderMock).toHaveBeenCalledTimes(1);
  });

  it("skips a fresh PENDING occurrence left by a concurrently running invocation", async () => {
    mocks.templateFindManyMock.mockResolvedValue([baseTemplate()]);
    mocks.occurrenceFindUniqueMock.mockResolvedValue({
      id: "occ-1",
      status: "PENDING",
      updatedAt: new Date("2026-07-06T09:55:00.000Z"), // 5 minutes ago
    });

    const summary = await generateDueOccurrences();

    expect(summary).toEqual({ processed: 1, created: 0, skipped: 1, failed: 0 });
    expect(mocks.createOrderMock).not.toHaveBeenCalled();
  });

  it("reclaims and retries a stale PENDING occurrence from a crashed run", async () => {
    mocks.templateFindManyMock.mockResolvedValue([baseTemplate()]);
    mocks.occurrenceFindUniqueMock.mockResolvedValue({
      id: "occ-1",
      status: "PENDING",
      updatedAt: new Date("2026-07-06T09:00:00.000Z"), // 1 hour ago
    });

    const summary = await generateDueOccurrences();

    expect(summary).toEqual({ processed: 1, created: 1, skipped: 0, failed: 0 });
    expect(mocks.occurrenceUpdateMock).toHaveBeenCalledWith({
      where: { id: "occ-1" },
      data: { status: "PENDING", failureReason: null },
    });
    expect(mocks.createOrderMock).toHaveBeenCalledTimes(1);
  });

  it("retries a previously FAILED occurrence", async () => {
    mocks.templateFindManyMock.mockResolvedValue([baseTemplate()]);
    mocks.occurrenceFindUniqueMock.mockResolvedValue({
      id: "occ-1",
      status: "FAILED",
      updatedAt: new Date("2026-07-06T09:59:00.000Z"),
    });

    const summary = await generateDueOccurrences();

    expect(summary).toEqual({ processed: 1, created: 1, skipped: 0, failed: 0 });
    expect(mocks.createOrderMock).toHaveBeenCalledTimes(1);
  });

  it("treats a race on occurrence creation (P2002) as already handled", async () => {
    mocks.templateFindManyMock.mockResolvedValue([baseTemplate()]);
    mocks.occurrenceFindUniqueMock.mockResolvedValue(null);
    mocks.occurrenceCreateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const summary = await generateDueOccurrences();

    expect(summary).toEqual({ processed: 1, created: 0, skipped: 1, failed: 0 });
    expect(mocks.createOrderMock).not.toHaveBeenCalled();
  });

  it("marks the occurrence FAILED when createOrder throws, without aborting other templates", async () => {
    mocks.templateFindManyMock.mockResolvedValue([
      baseTemplate({ id: "template-1" }),
      baseTemplate({ id: "template-2" }),
    ]);
    mocks.occurrenceFindUniqueMock.mockResolvedValue(null);
    mocks.occurrenceCreateMock.mockResolvedValue({});
    mocks.createOrderMock
      .mockRejectedValueOnce(new Error("catalog lookup failed"))
      .mockResolvedValueOnce({ id: "order-2" });

    const summary = await generateDueOccurrences();

    expect(summary).toEqual({ processed: 2, created: 1, skipped: 0, failed: 1 });
    expect(mocks.occurrenceUpdateMock).toHaveBeenCalledWith({
      where: { templateId_occurrenceDate: { templateId: "template-1", occurrenceDate: "2026-07-06" } },
      data: { status: "FAILED", failureReason: "catalog lookup failed" },
    });
  });

  it("ignores paused templates entirely", async () => {
    mocks.templateFindManyMock.mockResolvedValue([]);

    const summary = await generateDueOccurrences();

    expect(mocks.templateFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isPaused: false }) }),
    );
    expect(summary).toEqual({ processed: 0, created: 0, skipped: 0, failed: 0 });
  });

  it("scopes generation to a single company when companyId is provided", async () => {
    mocks.templateFindManyMock.mockResolvedValue([]);

    await generateDueOccurrences({ companyId: "company-1" });

    expect(mocks.templateFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPaused: false, companyId: "company-1" }),
      }),
    );
  });

  it("scopes generation to a single template when templateId is provided", async () => {
    mocks.templateFindManyMock.mockResolvedValue([]);

    await generateDueOccurrences({ templateId: "template-1" });

    expect(mocks.templateFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPaused: false, id: "template-1" }),
      }),
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  orderFindManyMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  orderEmailMessageUpdateManyMock: vi.fn(),
  orderGsmTaskUpdateManyMock: vi.fn(),
  orderAttachmentFindManyMock: vi.fn(),
  orderAttachmentDeleteManyMock: vi.fn(),
  orderEventCreateMock: vi.fn(),
  deleteAttachmentFileMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findMany: mocks.orderFindManyMock, update: mocks.orderUpdateMock },
    orderEmailMessage: { updateMany: mocks.orderEmailMessageUpdateManyMock },
    orderGsmTask: { updateMany: mocks.orderGsmTaskUpdateManyMock },
    orderAttachment: {
      findMany: mocks.orderAttachmentFindManyMock,
      deleteMany: mocks.orderAttachmentDeleteManyMock,
    },
    orderEvent: { create: mocks.orderEventCreateMock },
  },
}));

vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  deleteAttachmentFile: mocks.deleteAttachmentFileMock,
}));

import { runGdprCleanup } from "./runGdprCleanup";

function anonymizeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    companyId: "company-1",
    status: "paid",
    legacyWordpressOrderId: null,
    ...overrides,
  };
}

describe("runGdprCleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T10:00:00.000Z"));
    vi.clearAllMocks();

    mocks.orderFindManyMock.mockResolvedValue([]);
    mocks.orderUpdateMock.mockResolvedValue({});
    mocks.orderEmailMessageUpdateManyMock.mockResolvedValue({ count: 0 });
    mocks.orderGsmTaskUpdateManyMock.mockResolvedValue({ count: 0 });
    mocks.orderAttachmentFindManyMock.mockResolvedValue([]);
    mocks.orderAttachmentDeleteManyMock.mockResolvedValue({ count: 0 });
    mocks.orderEventCreateMock.mockResolvedValue({});
    mocks.deleteAttachmentFileMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("anonymizes an eligible paid order and logs an audit event without real values", async () => {
    mocks.orderFindManyMock
      .mockResolvedValueOnce([anonymizeCandidate()]) // anonymize sweep
      .mockResolvedValueOnce([]); // POD sweep
    mocks.orderEmailMessageUpdateManyMock.mockResolvedValue({ count: 2 });
    mocks.orderGsmTaskUpdateManyMock.mockResolvedValue({ count: 1 });

    const summary = await runGdprCleanup();

    expect(summary).toEqual({ anonymized: 1, podCleaned: 0, failed: 0 });

    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({
        customerName: null,
        phone: null,
        phoneTwo: null,
        email: null,
        deliveryAddress: null,
        customerComments: null,
        floorNo: null,
        lift: null,
        customTimeContactNote: null,
        gdprAnonymized: true,
        gdprDeletedAt: expect.any(Date),
      }),
    });

    // B2B fields must never be touched by the anonymize sweep.
    const updateData = mocks.orderUpdateMock.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("pickupAddress");
    expect(updateData).not.toHaveProperty("extraPickupAddress");
    expect(updateData).not.toHaveProperty("returnAddress");
    expect(updateData).not.toHaveProperty("extraPickupContacts");
    expect(updateData).not.toHaveProperty("cashierName");
    expect(updateData).not.toHaveProperty("cashierPhone");
    expect(updateData).not.toHaveProperty("customerLabel");

    // Email subject lines are free text and commonly contain the
    // customer's name (e.g. "RE: Delivery for Kari Nordmann") — must be
    // redacted along with the body/addresses, not left as-is.
    expect(mocks.orderEmailMessageUpdateManyMock).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      data: expect.objectContaining({
        subject: expect.stringMatching(/anonymized/i),
        bodyText: expect.stringMatching(/anonymized/i),
        bodyHtml: null,
        fromName: null,
        toName: null,
        fromEmail: expect.stringContaining("@"),
        toEmail: expect.stringContaining("@"),
      }),
    });

    expect(mocks.orderEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        companyId: "company-1",
        type: "GDPR_ANONYMIZED",
        actorMembershipId: null,
        payload: expect.objectContaining({
          fields: expect.arrayContaining(["customerName", "email", "deliveryAddress"]),
          relatedCleared: { emailMessages: 2, gsmTasks: 1, legacyRawMeta: false },
        }),
      }),
    });

    // The event only ever carries field *names* and counts — the candidate
    // fetched from the DB never included actual PII values in the first
    // place (see the `select` in runGdprCleanup), so there is structurally
    // no real value available to leak into the payload.
    const eventPayload = mocks.orderEventCreateMock.mock.calls[0][0].data.payload;
    expect(Object.keys(eventPayload).sort()).toEqual(["fields", "relatedCleared", "trigger"]);
  });

  it("clears legacyWordpressRawMeta only for legacy-imported orders", async () => {
    mocks.orderFindManyMock
      .mockResolvedValueOnce([anonymizeCandidate({ legacyWordpressOrderId: 4321 })])
      .mockResolvedValueOnce([]);

    await runGdprCleanup();

    const updateData = mocks.orderUpdateMock.mock.calls[0][0].data;
    expect(updateData.legacyWordpressRawMeta).toBe(Prisma.DbNull);
  });

  it("does not clear legacyWordpressRawMeta for non-legacy orders", async () => {
    mocks.orderFindManyMock
      .mockResolvedValueOnce([anonymizeCandidate({ legacyWordpressOrderId: null })])
      .mockResolvedValueOnce([]);

    await runGdprCleanup();

    const updateData = mocks.orderUpdateMock.mock.calls[0][0].data;
    expect(updateData.legacyWordpressRawMeta).toBeUndefined();
  });

  it("skips a candidate whose current status did not actually normalize to paid", async () => {
    mocks.orderFindManyMock
      .mockResolvedValueOnce([anonymizeCandidate({ status: "cancelled" })])
      .mockResolvedValueOnce([]);

    const summary = await runGdprCleanup();

    expect(summary).toEqual({ anonymized: 0, podCleaned: 0, failed: 0 });
    expect(mocks.orderUpdateMock).not.toHaveBeenCalled();
  });

  it("queries with gdprHold/gdprAnonymized false and the 30-day paidAt cutoff, oldest paidAt first", async () => {
    await runGdprCleanup();

    expect(mocks.orderFindManyMock).toHaveBeenNthCalledWith(1, {
      where: expect.objectContaining({
        paidAt: { not: null, lte: new Date("2026-06-08T10:00:00.000Z") },
        gdprHold: false,
        gdprAnonymized: false,
      }),
      select: expect.any(Object),
      orderBy: { paidAt: "asc" },
    });
  });

  it("scopes both sweeps to a single company when companyId is provided", async () => {
    await runGdprCleanup({ companyId: "company-9" });

    expect(mocks.orderFindManyMock).toHaveBeenNthCalledWith(1, {
      where: expect.objectContaining({ companyId: "company-9" }),
      select: expect.any(Object),
      orderBy: { paidAt: "asc" },
    });
    expect(mocks.orderFindManyMock).toHaveBeenNthCalledWith(2, {
      where: expect.objectContaining({ companyId: "company-9" }),
      select: expect.any(Object),
      orderBy: { paidAt: "asc" },
    });
  });

  it("caps both sweeps to `limit` orders per run when provided", async () => {
    await runGdprCleanup({ limit: 200 });

    expect(mocks.orderFindManyMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ take: 200 }),
    );
    expect(mocks.orderFindManyMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ take: 200 }),
    );
  });

  it("does not pass take at all when no limit is given", async () => {
    await runGdprCleanup();

    expect(mocks.orderFindManyMock.mock.calls[0][0]).not.toHaveProperty("take");
    expect(mocks.orderFindManyMock.mock.calls[1][0]).not.toHaveProperty("take");
  });

  it("continues processing remaining orders when one anonymize update fails", async () => {
    mocks.orderFindManyMock
      .mockResolvedValueOnce([
        anonymizeCandidate({ id: "order-1" }),
        anonymizeCandidate({ id: "order-2" }),
      ])
      .mockResolvedValueOnce([]);
    mocks.orderUpdateMock
      .mockRejectedValueOnce(new Error("db unavailable"))
      .mockResolvedValueOnce({});

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const summary = await runGdprCleanup();

    expect(summary).toEqual({ anonymized: 1, podCleaned: 0, failed: 1 });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("deletes GSM POD attachments and their files 6 months after paidAt, and logs an event", async () => {
    mocks.orderFindManyMock
      .mockResolvedValueOnce([]) // anonymize sweep
      .mockResolvedValueOnce([anonymizeCandidate({ id: "order-2" })]); // POD sweep
    mocks.orderAttachmentFindManyMock.mockResolvedValue([
      { id: "att-1", storagePath: "s3://bucket/att-1.pdf" },
      { id: "att-2", storagePath: "/uploads/orders/order-2/att-2.pdf" },
    ]);

    const summary = await runGdprCleanup();

    expect(summary).toEqual({ anonymized: 0, podCleaned: 1, failed: 0 });
    expect(mocks.deleteAttachmentFileMock).toHaveBeenCalledWith("s3://bucket/att-1.pdf");
    expect(mocks.deleteAttachmentFileMock).toHaveBeenCalledWith(
      "/uploads/orders/order-2/att-2.pdf",
    );
    expect(mocks.orderAttachmentDeleteManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["att-1", "att-2"] } },
    });
    expect(mocks.orderEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-2",
        type: "GDPR_POD_DELETED",
        payload: { attachmentCount: 2, trigger: "paid_180d" },
      }),
    });
  });

  it("uses a 6-month paidAt cutoff and only matches orders with a GSM attachment for the POD sweep", async () => {
    await runGdprCleanup();

    // setMonth is local-time based (matches this codebase's other calendar
    // date helpers), so the expected cutoff is derived the same way rather
    // than a hardcoded UTC literal — July -> January crosses the Oct/Mar DST
    // boundary, which shifts the UTC offset by an hour.
    const expectedCutoff = new Date("2026-07-08T10:00:00.000Z");
    expectedCutoff.setMonth(expectedCutoff.getMonth() - 6);

    expect(mocks.orderFindManyMock).toHaveBeenNthCalledWith(2, {
      where: expect.objectContaining({
        paidAt: { not: null, lte: expectedCutoff },
        gdprHold: false,
        orderAttachments: { some: { source: "GSM" } },
      }),
      select: expect.any(Object),
      orderBy: { paidAt: "asc" },
    });
  });
});

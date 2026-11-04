import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderUpdate: vi.fn(),
  emailUpdateMany: vi.fn(),
  smsUpdateMany: vi.fn(),
  gsmUpdateMany: vi.fn(),
  attachmentFindMany: vi.fn(),
  attachmentDeleteMany: vi.fn(),
  eventFindMany: vi.fn(),
  eventUpdate: vi.fn(),
  eventCreate: vi.fn(),
  notificationUpdateMany: vi.fn(),
  paymentFindMany: vi.fn(),
  paymentUpdate: vi.fn(),
  refundFindMany: vi.fn(),
  refundUpdate: vi.fn(),
  deleteAttachmentFile: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findMany: mocks.orderFindMany, update: mocks.orderUpdate },
    orderEmailMessage: { updateMany: mocks.emailUpdateMany },
    orderSmsMessage: { updateMany: mocks.smsUpdateMany },
    orderGsmTask: { updateMany: mocks.gsmUpdateMany },
    orderAttachment: { findMany: mocks.attachmentFindMany, deleteMany: mocks.attachmentDeleteMany },
    orderEvent: { findMany: mocks.eventFindMany, update: mocks.eventUpdate, create: mocks.eventCreate },
    orderNotification: { updateMany: mocks.notificationUpdateMany },
    orderPayment: { findMany: mocks.paymentFindMany, update: mocks.paymentUpdate },
    orderRefund: { findMany: mocks.refundFindMany, update: mocks.refundUpdate },
  },
}));
vi.mock("@/lib/orders/orderAttachmentStorage", () => ({ deleteAttachmentFile: mocks.deleteAttachmentFile }));

import { WEBSITE_ANONYMIZE_AFTER_DAYS, runWebsiteOrderGdprCleanup } from "./websiteOrderGdpr";
import { GDPR_REDACTED } from "./websiteOrderScrub";

const NOW = new Date("2026-11-04T10:00:00Z");
const candidate = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  companyId: "c1",
  status: "completed",
  websiteBookingDetails: { version: 1, delivery: { address: "Kirkegata 5", floor: 3, liftAvailable: true }, comment: "ring meg" },
  ...over,
});

describe("runWebsiteOrderGdprCleanup — homepage orders, 90 days after they're finished", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderFindMany.mockResolvedValue([]);
    for (const m of [mocks.emailUpdateMany, mocks.smsUpdateMany, mocks.gsmUpdateMany, mocks.notificationUpdateMany, mocks.attachmentDeleteMany]) {
      m.mockResolvedValue({ count: 0 });
    }
    mocks.attachmentFindMany.mockResolvedValue([]);
    mocks.eventFindMany.mockResolvedValue([]);
    mocks.paymentFindMany.mockResolvedValue([]);
    mocks.refundFindMany.mockResolvedValue([]);
  });

  it("only looks at homepage orders not anonymized or on hold, finished at least 90 days ago", async () => {
    await runWebsiteOrderGdprCleanup({ now: NOW });

    const cutoff = new Date(NOW.getTime() - WEBSITE_ANONYMIZE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    expect(WEBSITE_ANONYMIZE_AFTER_DAYS).toBe(90);
    expect(mocks.orderFindMany.mock.calls[0]![0].where).toEqual({
      isWebsiteOrder: true,
      gdprHold: false,
      gdprAnonymized: false,
      OR: [{ statusChangedAt: { lte: cutoff } }, { statusChangedAt: null, updatedAt: { lte: cutoff } }],
    });
  });

  it("skips orders still in progress, and stops at the limit", async () => {
    mocks.orderFindMany.mockResolvedValue([candidate({ id: "busy", status: "confirmed" }), candidate({ id: "a" }), candidate({ id: "b", status: "refunded" })]);

    expect(await runWebsiteOrderGdprCleanup({ now: NOW, limit: 1 })).toEqual({ anonymized: 1, failed: 0 });
    expect(mocks.orderUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.orderUpdate.mock.calls[0]![0].where).toEqual({ id: "a" });
  });

  it("clears the customer's details on the order and blanks the booking details — keeps prices and products", async () => {
    mocks.orderFindMany.mockResolvedValue([candidate()]);

    await runWebsiteOrderGdprCleanup({ now: NOW });

    const { data } = mocks.orderUpdate.mock.calls[0]![0];
    expect(data).toMatchObject({
      customerName: null,
      customerLabel: null,
      phone: null,
      phoneTwo: null,
      email: null,
      deliveryAddress: null,
      pickupAddress: null,
      extraPickupAddress: [],
      extraPickupContacts: Prisma.DbNull,
      customerComments: null,
      description: null,
      statusNotes: null,
      customTimeContactNote: null,
      websiteBookingDetails: { version: 1, delivery: { address: "", floor: 3, liftAvailable: true }, comment: "" },
      gdprAnonymized: true,
      gdprDeletedAt: NOW,
    });
    expect(data).not.toHaveProperty("priceExVat");
    expect(data).not.toHaveProperty("pricingSnapshot");
  });

  it("redacts emails, SMS, GSM addresses, notifications, history and payment snapshots, and deletes uploaded files", async () => {
    mocks.orderFindMany.mockResolvedValue([candidate()]);
    mocks.attachmentFindMany.mockResolvedValue([{ id: "f1", storagePath: "s3://b/pickup.pdf" }]);
    mocks.eventFindMany.mockResolvedValue([
      { id: "e1", payload: { kind: "status_changed", fromStatus: "confirmed", toStatus: "completed", note: "Kari" } },
      { id: "e2", payload: { kind: "gdpr" } },
    ]);
    mocks.paymentFindMany.mockResolvedValue([
      { id: "p1", orderSnapshot: { version: 1, totalIncVatNok: 1250, lines: [], details: [{ key: "delivery.address", value: "Kirkegata 5" }] } },
    ]);
    mocks.refundFindMany.mockResolvedValue([{ id: "r1", orderSnapshot: null }]);

    await runWebsiteOrderGdprCleanup({ now: NOW });

    expect(mocks.emailUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orderId: "o1" } }));
    expect(mocks.smsUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orderId: "o1" } }));
    expect(mocks.gsmUpdateMany).toHaveBeenCalledWith({ where: { orderId: "o1" }, data: { address: null } });
    expect(mocks.notificationUpdateMany).toHaveBeenCalledWith({ where: { orderId: "o1" }, data: { message: GDPR_REDACTED, payload: Prisma.DbNull } });
    // Only the event that changed is rewritten.
    expect(mocks.eventUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.eventUpdate).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { payload: { kind: "status_changed", fromStatus: "confirmed", toStatus: "completed", note: GDPR_REDACTED } },
    });
    expect(mocks.paymentUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { orderSnapshot: { version: 1, totalIncVatNok: 1250, lines: [], details: [{ key: "delivery.address", value: "" }] } },
    });
    expect(mocks.refundUpdate).not.toHaveBeenCalled();
    expect(mocks.deleteAttachmentFile).toHaveBeenCalledWith("s3://b/pickup.pdf");
    expect(mocks.attachmentDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["f1"] } } });
    // The audit trail of what was done.
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ orderId: "o1", type: "GDPR_ANONYMIZED", payload: expect.objectContaining({ trigger: "website_finished_90d" }) }),
    });
  });

  it("counts a failure and carries on with the next order", async () => {
    mocks.orderFindMany.mockResolvedValue([candidate({ id: "bad" }), candidate({ id: "good" })]);
    mocks.emailUpdateMany.mockRejectedValueOnce(new Error("db down"));

    expect(await runWebsiteOrderGdprCleanup({ now: NOW })).toEqual({ anonymized: 1, failed: 1 });
  });

  it("can be limited to one company (the dashboard's Run now)", async () => {
    await runWebsiteOrderGdprCleanup({ now: NOW, companyId: "c9" });
    expect(mocks.orderFindMany.mock.calls[0]![0].where).toMatchObject({ companyId: "c9" });
  });
});

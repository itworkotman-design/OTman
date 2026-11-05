import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refundFindUnique: vi.fn(),
  refundFindMany: vi.fn(),
  refundUpdate: vi.fn(),
  orderUpdate: vi.fn(),
  emailCreate: vi.fn(),
  sendGmailEmail: vi.fn(),
  upload: vi.fn(),
  s3Configured: vi.fn(),
  actionEvent: vi.fn(),
  alertStaff: vi.fn(),
  allocate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    orderRefund: { findUnique: mocks.refundFindUnique, findMany: mocks.refundFindMany, update: mocks.refundUpdate },
    order: { update: mocks.orderUpdate },
    orderEmailMessage: { create: mocks.emailCreate },
  },
}));
vi.mock("@/lib/email/sendGmailEmail", () => ({ sendGmailEmail: mocks.sendGmailEmail }));
vi.mock("@/lib/email/gmailAccounts", () => ({ getGmailSendAsEmail: () => "post@otman.no", formatGmailSenderName: () => "Otman" }));
vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  isS3AttachmentStorageConfigured: mocks.s3Configured,
  uploadAttachmentBufferToS3: mocks.upload,
}));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderActionEvent: mocks.actionEvent }));
vi.mock("@/lib/orders/staffAlerts", () => ({ alertStaff: mocks.alertStaff }));
vi.mock("./receiptNumbers", async (actual) => ({ ...(await actual<object>()), allocateReceiptNumber: mocks.allocate }));
vi.mock("@/lib/orders/orderEmail", () => ({
  createOrderEmailThreadToken: () => "thread-new",
  buildReplyToAddress: (token: string) => `reply+${token}@otman.no`,
}));

import { sendCreditNotesForStripeRefunds, sendRefundCreditNote } from "./refundCreditNotes";

const refund = (over: Record<string, unknown> = {}) => ({
  id: "ref1",
  orderId: "o1",
  companyId: "c1",
  amountRefundedCents: 125000,
  orderSnapshot: null,
  createdAt: new Date("2026-11-06T09:30:00Z"),
  receiptNumber: null,
  receiptSentAt: null,
  receiptPdfKey: null,
  orderPayment: { receiptNumber: 7 },
  order: {
    displayId: 20046,
    orderNumber: "20046",
    email: "kari@example.com",
    customerName: "Kari Nordmann",
    customerLabel: null,
    deliveryAddress: "Karl Johans gate 10, Oslo",
    pickupAddress: null,
    websiteBookingDetails: null,
    deliveryDate: "2026-11-10",
    emailThreadToken: "thread-1",
    payments: [{ createdAt: new Date("2026-11-04T09:30:00Z"), orderSnapshot: null }],
    refunds: [{ id: "ref1", createdAt: new Date("2026-11-06T09:30:00Z"), orderSnapshot: null }],
  },
  ...over,
});

const ENV = { INVOICE_SELLER_NAME: "Otman Transport AS", INVOICE_ORG_NUMBER: "923609016" };

describe("sendRefundCreditNote — a kreditnota for each Stripe refund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [key, value] of Object.entries(ENV)) process.env[key] = value;
    mocks.refundFindUnique.mockResolvedValue(refund());
    mocks.allocate.mockResolvedValue(12);
    mocks.s3Configured.mockReturnValue(true);
    mocks.upload.mockResolvedValue({ storagePath: "s3://receipts/Kreditnota W-12.pdf" });
    mocks.sendGmailEmail.mockResolvedValue({ messageId: "m1", gmailMessageId: "g1", gmailThreadId: "t1" });
    mocks.emailCreate.mockResolvedValue({ id: "em1" });
  });

  it("takes the next W-number and emails the credit note to the customer in the order's thread", async () => {
    expect(await sendRefundCreditNote({ refundId: "ref1" })).toEqual({ ok: true, number: 12 });

    expect(mocks.allocate).toHaveBeenCalledWith({ orderRefundId: "ref1" });
    const mail = mocks.sendGmailEmail.mock.calls[0]![0];
    expect(mail.to).toEqual({ email: "kari@example.com", name: "Kari Nordmann" });
    expect(mail.threadToken).toBe("thread-1");
    expect(mail.subject).toBe("Kreditnota W-12 for ordre 20046");
    expect(mail.attachments).toEqual([{ filename: "Kreditnota W-12.pdf", contentType: "application/pdf", content: expect.any(Buffer) }]);
  });

  it("keeps the PDF, marks it sent and logs it on the order", async () => {
    await sendRefundCreditNote({ refundId: "ref1", now: new Date("2026-11-06T09:31:00Z") });

    expect(mocks.refundUpdate).toHaveBeenCalledWith({
      where: { id: "ref1" },
      data: { receiptSentAt: new Date("2026-11-06T09:31:00Z"), receiptPdfKey: "s3://receipts/Kreditnota W-12.pdf" },
    });
    expect(mocks.emailCreate).toHaveBeenCalled();
    expect(mocks.actionEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ title: "Credit note W-12 sent" }));
  });

  it("keeps a number already given, and never sends twice unless staff resend", async () => {
    mocks.refundFindUnique.mockResolvedValue(refund({ receiptNumber: 5, receiptSentAt: new Date() }));
    expect(await sendRefundCreditNote({ refundId: "ref1" })).toEqual({ ok: false, reason: "ALREADY_SENT" });
    expect(await sendRefundCreditNote({ refundId: "ref1", resend: true })).toEqual({ ok: true, number: 5 });
    expect(mocks.allocate).not.toHaveBeenCalled();
  });

  it("alerts staff when it can't be sent", async () => {
    mocks.refundFindUnique.mockResolvedValueOnce(refund({ order: { ...refund().order, email: null } }));
    expect(await sendRefundCreditNote({ refundId: "ref1" })).toEqual({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" });

    mocks.sendGmailEmail.mockRejectedValueOnce(new Error("gmail down"));
    expect(await sendRefundCreditNote({ refundId: "ref1" })).toEqual({ ok: false, reason: "SEND_FAILED" });

    expect(mocks.alertStaff).toHaveBeenCalledWith(expect.objectContaining({ orderId: "o1", title: "Credit note not sent" }));
  });
});

describe("sendCreditNotesForStripeRefunds — after refundOrderPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const [key, value] of Object.entries(ENV)) process.env[key] = value;
    mocks.refundFindMany.mockResolvedValue([{ id: "ref1" }, { id: "ref2" }]);
    mocks.refundFindUnique.mockResolvedValue(refund());
    mocks.allocate.mockResolvedValue(12);
    mocks.s3Configured.mockReturnValue(false);
    mocks.sendGmailEmail.mockResolvedValue({ messageId: "m1" });
    mocks.emailCreate.mockResolvedValue({ id: "em1" });
  });

  it("sends one credit note per recorded refund, oldest first", async () => {
    await sendCreditNotesForStripeRefunds(["re_1", "re_2"]);
    expect(mocks.refundFindMany).toHaveBeenCalledWith({
      where: { stripeRefundId: { in: ["re_1", "re_2"] } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    expect(mocks.refundFindUnique).toHaveBeenCalledTimes(2);
  });

  it("does nothing for no refunds", async () => {
    await sendCreditNotesForStripeRefunds([]);
    expect(mocks.refundFindMany).not.toHaveBeenCalled();
  });
});

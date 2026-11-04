import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  paymentFindUnique: vi.fn(),
  paymentAggregate: vi.fn(),
  paymentUpdateMany: vi.fn(),
  paymentUpdate: vi.fn(),
  orderUpdate: vi.fn(),
  emailCreate: vi.fn(),
  sendGmailEmail: vi.fn(),
  upload: vi.fn(),
  s3Configured: vi.fn(),
  actionEvent: vi.fn(),
  alertStaff: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    orderPayment: {
      findUnique: mocks.paymentFindUnique,
      aggregate: mocks.paymentAggregate,
      updateMany: mocks.paymentUpdateMany,
      update: mocks.paymentUpdate,
    },
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
vi.mock("@/lib/orders/orderEmail", () => ({
  createOrderEmailThreadToken: () => "thread-new",
  buildReplyToAddress: (token: string) => `reply+${token}@otman.no`,
}));

import { sendPaymentReceipt } from "./paymentReceipts";

const snapshot = {
  version: 1,
  totalIncVatNok: 1250,
  lines: [{ key: "Vaskemaskin::Levering", group: "Vaskemaskin", label: "Levering", qty: 1, price: 1250 }],
  details: [],
};
const payment = (over: Record<string, unknown> = {}) => ({
  id: "pay1",
  orderId: "o1",
  companyId: "c1",
  amountChargedCents: 125000,
  orderSnapshot: snapshot,
  createdAt: new Date("2026-11-04T09:30:00Z"),
  receiptNumber: null,
  receiptSentAt: null,
  receiptPdfKey: null,
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
    emailThreadToken: null,
    payments: [{ id: "pay1", createdAt: new Date("2026-11-04T09:30:00Z"), orderSnapshot: snapshot }],
    refunds: [],
  },
  ...over,
});

const ENV = { INVOICE_SELLER_NAME: "Otman Transport AS", INVOICE_ORG_NUMBER: "923609016" };

describe("sendPaymentReceipt — a kvittering for each Stripe payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [key, value] of Object.entries(ENV)) process.env[key] = value;
    mocks.paymentFindUnique.mockResolvedValue(payment());
    mocks.paymentAggregate.mockResolvedValue({ _max: { receiptNumber: 6 } });
    mocks.paymentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.s3Configured.mockReturnValue(true);
    mocks.upload.mockResolvedValue({ storagePath: "s3://receipts/Kvittering 7.pdf" });
    mocks.sendGmailEmail.mockResolvedValue({ messageId: "m1", gmailMessageId: "g1", gmailThreadId: "t1" });
    mocks.emailCreate.mockResolvedValue({ id: "em1" });
  });

  it("takes the next number in the series and emails the PDF to the customer", async () => {
    expect(await sendPaymentReceipt({ paymentId: "pay1" })).toEqual({ ok: true, number: 7 });

    expect(mocks.paymentUpdateMany).toHaveBeenCalledWith({ where: { id: "pay1", receiptNumber: null }, data: { receiptNumber: 7 } });
    const mail = mocks.sendGmailEmail.mock.calls[0]![0];
    expect(mail.to).toEqual({ email: "kari@example.com", name: "Kari Nordmann" });
    expect(mail.subject).toBe("Kvittering 7 for ordre 20046");
    expect(mail.attachments).toEqual([{ filename: "Kvittering 7.pdf", contentType: "application/pdf", content: expect.any(Buffer) }]);
    expect(mail.attachments[0].content.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("keeps the PDF and marks the receipt sent", async () => {
    await sendPaymentReceipt({ paymentId: "pay1", now: new Date("2026-11-04T09:31:00Z") });

    expect(mocks.paymentUpdate).toHaveBeenCalledWith({
      where: { id: "pay1" },
      data: { receiptSentAt: new Date("2026-11-04T09:31:00Z"), receiptPdfKey: "s3://receipts/Kvittering 7.pdf" },
    });
    expect(mocks.emailCreate).toHaveBeenCalled();
    expect(mocks.actionEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ title: "Receipt 7 sent" }));
  });

  it("starts the series at 1", async () => {
    mocks.paymentAggregate.mockResolvedValue({ _max: { receiptNumber: null } });
    expect(await sendPaymentReceipt({ paymentId: "pay1" })).toEqual({ ok: true, number: 1 });
  });

  it("tries the next number when another receipt took it at the same time", async () => {
    mocks.paymentAggregate.mockResolvedValueOnce({ _max: { receiptNumber: 6 } }).mockResolvedValueOnce({ _max: { receiptNumber: 7 } });
    mocks.paymentUpdateMany.mockRejectedValueOnce(Object.assign(new Error("Unique constraint"), { code: "P2002" }));

    expect(await sendPaymentReceipt({ paymentId: "pay1" })).toEqual({ ok: true, number: 8 });
  });

  it("keeps a number already given (a resend after a failed email)", async () => {
    mocks.paymentFindUnique.mockResolvedValue(payment({ receiptNumber: 3 }));

    expect(await sendPaymentReceipt({ paymentId: "pay1" })).toEqual({ ok: true, number: 3 });
    expect(mocks.paymentUpdateMany).not.toHaveBeenCalled();
  });

  it("never sends the same receipt twice", async () => {
    mocks.paymentFindUnique.mockResolvedValue(payment({ receiptNumber: 3, receiptSentAt: new Date() }));

    expect(await sendPaymentReceipt({ paymentId: "pay1" })).toEqual({ ok: false, reason: "ALREADY_SENT" });
    expect(mocks.sendGmailEmail).not.toHaveBeenCalled();
  });

  it("resends one already sent when staff ask (same number)", async () => {
    mocks.paymentFindUnique.mockResolvedValue(payment({ receiptNumber: 3, receiptSentAt: new Date() }));

    expect(await sendPaymentReceipt({ paymentId: "pay1", resend: true })).toEqual({ ok: true, number: 3 });
    expect(mocks.sendGmailEmail).toHaveBeenCalled();
  });

  it("alerts staff when it can't be sent: no seller settings, no email, or the email failed", async () => {
    delete process.env.INVOICE_ORG_NUMBER;
    expect(await sendPaymentReceipt({ paymentId: "pay1" })).toEqual({ ok: false, reason: "SETTINGS_MISSING" });
    process.env.INVOICE_ORG_NUMBER = ENV.INVOICE_ORG_NUMBER;

    mocks.paymentFindUnique.mockResolvedValueOnce(payment({ order: { ...payment().order, email: null } }));
    expect(await sendPaymentReceipt({ paymentId: "pay1" })).toEqual({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" });

    mocks.sendGmailEmail.mockRejectedValueOnce(new Error("gmail down"));
    expect(await sendPaymentReceipt({ paymentId: "pay1" })).toEqual({ ok: false, reason: "SEND_FAILED" });

    expect(mocks.alertStaff).toHaveBeenCalledTimes(3);
    expect(mocks.alertStaff).toHaveBeenCalledWith(expect.objectContaining({ orderId: "o1", title: "Receipt not sent" }));
  });

  it("doesn't throw when something unexpected breaks", async () => {
    mocks.paymentFindUnique.mockRejectedValue(new Error("db down"));
    expect(await sendPaymentReceipt({ paymentId: "pay1" })).toEqual({ ok: false, reason: "SEND_FAILED" });
  });
});

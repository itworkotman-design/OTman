import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn(),
  invoiceCreate: vi.fn(),
  invoiceUpdate: vi.fn(),
  invoiceUpdateMany: vi.fn(),
  invoiceDelete: vi.fn(),
  membershipFindMany: vi.fn(),
  emailCreate: vi.fn(),
  eventCreate: vi.fn(),
  sendGmailEmail: vi.fn(),
  upload: vi.fn(),
  s3Configured: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findFirst: mocks.orderFindFirst, update: mocks.orderUpdate },
    orderInvoice: { create: mocks.invoiceCreate, update: mocks.invoiceUpdate, updateMany: mocks.invoiceUpdateMany, delete: mocks.invoiceDelete },
    orderEmailMessage: { create: mocks.emailCreate },
    orderEvent: { create: mocks.eventCreate },
    membership: { findMany: mocks.membershipFindMany },
  },
}));
vi.mock("@/lib/email/sendGmailEmail", () => ({ sendGmailEmail: mocks.sendGmailEmail }));
vi.mock("@/lib/email/gmailAccounts", () => ({
  getGmailSendAsEmail: () => "bestilling@otman.no",
  formatGmailSenderName: () => "Otman AS",
}));
vi.mock("@/lib/email/emailAssets", () => ({ getOrderEmailLogoUrl: () => "https://otman.no/logo.png" }));
vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  isS3AttachmentStorageConfigured: mocks.s3Configured,
  uploadAttachmentBufferToS3: mocks.upload,
}));

import { getOrderInvoiceOverview, markOrderInvoicesPaid, refreshOrderPaymentStatus, sendOrderInvoice } from "./orderInvoices";

const env = {
  INVOICE_SELLER_NAME: "Otman AS",
  INVOICE_ORG_NUMBER: "974760673",
  INVOICE_ADDRESS: "Industriveien 1",
  INVOICE_BANK_ACCOUNT: "1234.56.78901",
  INVOICE_EMAIL: "post@otman.no",
};

// A move priced 1 000 kr ex. VAT (1 250 incl.), as stored.
const order = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  companyId: "c1",
  displayId: 1042,
  orderNumber: "583920",
  email: "kari@example.no",
  customerName: "Kari",
  customerLabel: null,
  emailThreadToken: "thread-1",
  paymentStatus: null,
  priceExVat: 1000,
  rabatt: null,
  leggTil: null,
  pricingSnapshot: { customer: { totalExVat: 1000, totalIncVat: 1250 }, lines: [] },
  websiteOrderKind: "MOVING",
  websiteBookingDetails: null,
  pickupAddress: "Strømmen 1",
  deliveryAddress: "Kirkegata 5",
  extraPickupAddress: [],
  deliveryDate: "2026-11-10",
  timeWindow: "08:00-16:00",
  drivingDistance: "20",
  invoices: [],
  ...over,
});

const actor = { membershipId: "m-admin", name: "Admin", email: "admin@otman.no", source: "USER" };

describe("sendOrderInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(process.env, env);
    mocks.s3Configured.mockReturnValue(true);
    mocks.upload.mockResolvedValue({ key: "orders/invoices/o1/x.pdf", storagePath: "s3://bucket/orders/invoices/o1/x.pdf" });
    mocks.sendGmailEmail.mockResolvedValue({ messageId: "<m1>", gmailMessageId: "g1", gmailThreadId: "t1", syncWarning: false });
    mocks.invoiceCreate.mockImplementation(async ({ data }) => ({ id: "inv-new", ...data }));
    mocks.emailCreate.mockResolvedValue({ id: "email-1" });
    mocks.invoiceDelete.mockResolvedValue({});
  });

  it("sends the first faktura for the whole total, numbered by the order ID, and sets the order pending", async () => {
    mocks.orderFindFirst.mockResolvedValue(order());
    const result = await sendOrderInvoice({ orderId: "o1", companyId: "c1", actor, kind: "invoice", now: new Date("2026-10-30T10:00:00Z") });

    expect(result).toMatchObject({ ok: true, invoice: { invoiceNumber: "1042", amountCents: 125000 } });
    expect(mocks.invoiceCreate.mock.calls[0]![0].data).toMatchObject({
      orderId: "o1",
      sequence: 1,
      invoiceNumber: "1042",
      kind: "invoice",
      amountCents: 125000,
      totalAfterCents: 125000,
      paidAt: null,
    });
    const email = mocks.sendGmailEmail.mock.calls[0]![0];
    expect(email.subject).toBe("Faktura 1042 for ordre 1042");
    expect(email.to).toEqual({ email: "kari@example.no", name: "Kari" });
    expect(email.attachments[0]).toMatchObject({ filename: "Faktura 1042.pdf", contentType: "application/pdf" });
    expect(Buffer.from(email.attachments[0].content).subarray(0, 5).toString()).toBe("%PDF-");
    expect(mocks.invoiceUpdate).toHaveBeenCalledWith({
      where: { id: "inv-new" },
      data: { pdfKey: "s3://bucket/orders/invoices/o1/x.pdf", emailMessageId: "email-1" },
    });
    expect(mocks.orderUpdate.mock.calls.at(-1)![0].data).toMatchObject({ paymentStatus: "pending" });
  });

  it("sends a follow-up for the difference only, as 1042-2", async () => {
    mocks.orderFindFirst.mockResolvedValue(
      order({
        priceExVat: 1200,
        pricingSnapshot: { customer: { totalExVat: 1200, totalIncVat: 1500 }, lines: [] },
        invoices: [
          {
            sequence: 1,
            kind: "invoice",
            amountCents: 125000,
            totalAfterCents: 125000,
            orderSnapshot: { version: 1, totalIncVatNok: 1250, lines: [], details: [] },
            paidAt: new Date("2026-10-31T10:00:00Z"),
            createdAt: new Date("2026-10-30T10:00:00Z"),
          },
        ],
      }),
    );
    const result = await sendOrderInvoice({ orderId: "o1", companyId: "c1", actor, kind: "invoice" });
    expect(result).toMatchObject({ ok: true, invoice: { invoiceNumber: "1042-2", sequence: 2, amountCents: 25000, totalAfterCents: 150000 } });
    // The file has both fakturas: 1042 (BETALT) and 1042-2.
    expect(mocks.sendGmailEmail.mock.calls[0]![0].attachments[0].filename).toBe("Faktura 1042-2.pdf");
  });

  it("refuses when there's nothing to invoice", async () => {
    mocks.orderFindFirst.mockResolvedValue(
      order({
        invoices: [
          { sequence: 1, kind: "invoice", amountCents: 125000, totalAfterCents: 125000, orderSnapshot: null, paidAt: null, createdAt: new Date() },
        ],
      }),
    );
    expect(await sendOrderInvoice({ orderId: "o1", companyId: "c1", actor, kind: "invoice" })).toEqual({ ok: false, reason: "NOTHING_TO_INVOICE" });
    expect(mocks.sendGmailEmail).not.toHaveBeenCalled();
  });

  it("needs the seller's bank account and the customer's email", async () => {
    mocks.orderFindFirst.mockResolvedValue(order({ email: null }));
    expect(await sendOrderInvoice({ orderId: "o1", companyId: "c1", actor, kind: "invoice" })).toEqual({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" });
    delete process.env.INVOICE_BANK_ACCOUNT;
    mocks.orderFindFirst.mockResolvedValue(order());
    expect(await sendOrderInvoice({ orderId: "o1", companyId: "c1", actor, kind: "invoice" })).toEqual({ ok: false, reason: "INVOICE_SETTINGS_MISSING" });
  });

  it("refuses when the amount staff saw is no longer what's owed", async () => {
    mocks.orderFindFirst.mockResolvedValue(order());
    expect(await sendOrderInvoice({ orderId: "o1", companyId: "c1", actor, kind: "invoice", expectedAmountCents: 100000 })).toEqual({
      ok: false,
      reason: "AMOUNT_CHANGED",
      amountCents: 125000,
    });
    expect(mocks.invoiceCreate).not.toHaveBeenCalled();
  });

  it("never records a faktura that didn't go out", async () => {
    mocks.orderFindFirst.mockResolvedValue(order());
    mocks.sendGmailEmail.mockRejectedValue(new Error("gmail down"));
    expect(await sendOrderInvoice({ orderId: "o1", companyId: "c1", actor, kind: "invoice" })).toEqual({ ok: false, reason: "INVOICE_SEND_FAILED" });
    expect(mocks.invoiceDelete).toHaveBeenCalledWith({ where: { id: "inv-new" } });
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it("records a kreditnota for what was overpaid, settled at once", async () => {
    mocks.orderFindFirst.mockResolvedValue(
      order({
        priceExVat: 800,
        pricingSnapshot: { customer: { totalExVat: 800, totalIncVat: 1000 }, lines: [] },
        paymentStatus: "pending",
        invoices: [
          { sequence: 1, kind: "invoice", amountCents: 125000, totalAfterCents: 125000, orderSnapshot: null, paidAt: new Date(), createdAt: new Date() },
        ],
      }),
    );
    const result = await sendOrderInvoice({ orderId: "o1", companyId: "c1", actor, kind: "refund", now: new Date("2026-11-01T10:00:00Z") });
    expect(result).toMatchObject({ ok: true, invoice: { invoiceNumber: "1042-K2", kind: "refund", amountCents: 25000 } });
    expect(mocks.invoiceCreate.mock.calls[0]![0].data.paidAt).toEqual(new Date("2026-11-01T10:00:00Z"));
    expect(mocks.sendGmailEmail.mock.calls[0]![0].subject).toBe("Kreditnota 1042-K2 for ordre 1042");
    expect(mocks.orderUpdate.mock.calls.at(-1)![0].data).toMatchObject({ paymentStatus: "paid" });
  });
});

describe("markOrderInvoicesPaid — the only way an order becomes paid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks every unpaid faktura paid and makes the order paid when nothing more is owed", async () => {
    const unpaid = { sequence: 1, kind: "invoice", amountCents: 125000, totalAfterCents: 125000, orderSnapshot: null, paidAt: null, createdAt: new Date() };
    mocks.orderFindFirst.mockResolvedValueOnce(order({ invoices: [unpaid], paymentStatus: "pending" }));
    mocks.orderFindFirst.mockResolvedValueOnce(order({ invoices: [{ ...unpaid, paidAt: new Date() }], paymentStatus: "pending" }));
    const result = await markOrderInvoicesPaid({ orderId: "o1", companyId: "c1", actor, now: new Date("2026-11-01T10:00:00Z") });
    expect(result).toEqual({ ok: true, paymentStatus: "paid" });
    expect(mocks.invoiceUpdateMany).toHaveBeenCalledWith({
      where: { orderId: "o1", kind: "invoice", paidAt: null },
      data: { paidAt: new Date("2026-11-01T10:00:00Z"), paidByMembershipId: "m-admin" },
    });
    expect(mocks.orderUpdate.mock.calls.at(-1)![0].data).toEqual({ paymentStatus: "paid" });
  });

  it("refuses when there's no unpaid faktura", async () => {
    mocks.orderFindFirst.mockResolvedValue(order());
    expect(await markOrderInvoicesPaid({ orderId: "o1", companyId: "c1", actor })).toEqual({ ok: false, reason: "NOTHING_TO_MARK_PAID" });
  });
});

describe("refreshOrderPaymentStatus — after anything that changes the price", () => {
  beforeEach(() => vi.clearAllMocks());

  it("turns a paid order pending once its total moves away from what was invoiced", async () => {
    mocks.orderFindFirst.mockResolvedValue(
      order({
        priceExVat: 1200,
        pricingSnapshot: { customer: { totalExVat: 1200, totalIncVat: 1500 }, lines: [] },
        paymentStatus: "paid",
        invoices: [{ sequence: 1, kind: "invoice", amountCents: 125000, totalAfterCents: 125000, orderSnapshot: null, paidAt: new Date(), createdAt: new Date() }],
      }),
    );
    expect(await refreshOrderPaymentStatus("o1")).toBe("pending");
    expect(mocks.orderUpdate).toHaveBeenCalledWith({ where: { id: "o1" }, data: { paymentStatus: "pending" } });
  });

  it("leaves an order without fakturas or Stripe payments alone", async () => {
    mocks.orderFindFirst.mockResolvedValue(order({ payments: [] }));
    expect(await refreshOrderPaymentStatus("o1")).toBeNull();
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it("turns a Stripe-paid order pending once its total goes above what was paid", async () => {
    mocks.orderFindFirst.mockResolvedValue(
      order({
        priceExVat: 1200,
        pricingSnapshot: { customer: { totalExVat: 1200, totalIncVat: 1500 }, lines: [] },
        paymentStatus: "paid",
        payments: [{ amountChargedCents: 125000, createdAt: new Date(), orderSnapshot: null, refunds: [] }],
      }),
    );
    expect(await refreshOrderPaymentStatus("o1")).toBe("pending");
    expect(mocks.orderUpdate).toHaveBeenCalledWith({ where: { id: "o1" }, data: { paymentStatus: "pending" } });
  });

  it("turns a Stripe-paid order refund pending once its total drops below what was paid", async () => {
    mocks.orderFindFirst.mockResolvedValue(
      order({
        priceExVat: 800,
        pricingSnapshot: { customer: { totalExVat: 800, totalIncVat: 1000 }, lines: [] },
        paymentStatus: "paid",
        payments: [{ amountChargedCents: 125000, createdAt: new Date(), orderSnapshot: null, refunds: [] }],
      }),
    );
    expect(await refreshOrderPaymentStatus("o1")).toBe("refund_pending");
    expect(mocks.orderUpdate).toHaveBeenCalledWith({ where: { id: "o1" }, data: { paymentStatus: "refund_pending" } });
  });

  it("turns it paid again once the total is back within what was paid", async () => {
    mocks.orderFindFirst.mockResolvedValue(
      order({ paymentStatus: "pending", payments: [{ amountChargedCents: 125000, createdAt: new Date(), orderSnapshot: null, refunds: [] }] }),
    );
    expect(await refreshOrderPaymentStatus("o1")).toBe("paid");
    expect(mocks.orderUpdate).toHaveBeenCalledWith({ where: { id: "o1" }, data: { paymentStatus: "paid" } });
  });
});

describe("getOrderInvoiceOverview — the Payment tab and card", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists every faktura with who sent and marked it, and how the order stands now", async () => {
    mocks.orderFindFirst.mockResolvedValue(
      order({
        paymentStatus: "paid",
        invoices: [
          {
            id: "i1",
            sequence: 1,
            invoiceNumber: "1042",
            kind: "invoice",
            amountCents: 125000,
            totalAfterCents: 125000,
            orderSnapshot: null,
            dueDate: new Date("2026-11-13T10:00:00Z"),
            paidAt: new Date("2026-11-01T10:00:00Z"),
            paidByMembershipId: "m2",
            sentByMembershipId: null,
            pdfKey: "s3://b/k.pdf",
            createdAt: new Date("2026-10-30T10:00:00Z"),
          },
        ],
      }),
    );
    mocks.membershipFindMany.mockResolvedValue([{ id: "m2", user: { username: "Ola", email: "ola@otman.no" } }]);

    expect(await getOrderInvoiceOverview("o1", "c1")).toEqual({
      paymentStatus: "paid",
      ledger: expect.objectContaining({ outcome: "paid", invoicedIncVatNok: 1250, currentIncVatNok: 1250, differenceIncVatNok: 0 }),
      invoices: [
        {
          id: "i1",
          number: "1042",
          kind: "invoice",
          amountIncVatNok: 1250,
          totalAfterIncVatNok: 1250,
          createdAt: "2026-10-30T10:00:00.000Z",
          dueDate: "2026-11-13T10:00:00.000Z",
          paidAt: "2026-11-01T10:00:00.000Z",
          // Nobody sent it: the automatic faktura at booking.
          sentBy: null,
          paidBy: "Ola",
          hasPdf: true,
        },
      ],
    });
  });

  it("is null for an order that isn't there", async () => {
    mocks.orderFindFirst.mockResolvedValue(null);
    expect(await getOrderInvoiceOverview("o1", "c1")).toBeNull();
  });
});

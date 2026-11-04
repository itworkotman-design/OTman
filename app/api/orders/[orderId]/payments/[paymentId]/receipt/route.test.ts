import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  paymentFindFirst: vi.fn(),
  download: vi.fn(),
  sendPaymentReceipt: vi.fn(),
}));

vi.mock("@/lib/orders/websiteOrderAdminAccess", () => ({ authorizeWebsiteOrderAdmin: mocks.authorize }));
vi.mock("@/lib/db", () => ({ prisma: { orderPayment: { findFirst: mocks.paymentFindFirst } } }));
vi.mock("@/lib/orders/orderAttachmentStorage", () => ({ downloadAttachmentFromS3: mocks.download }));
vi.mock("@/lib/invoices/paymentReceipts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invoices/paymentReceipts")>("@/lib/invoices/paymentReceipts");
  return { ...actual, sendPaymentReceipt: mocks.sendPaymentReceipt };
});

import { GET, POST } from "./route";

const params = { params: Promise.resolve({ orderId: "o1", paymentId: "pay1" }) };
const get = (query = "") => GET(new Request(`http://localhost/api/orders/o1/payments/pay1/receipt${query}`), params);
const post = () => POST(new Request("http://localhost/api/orders/o1/payments/pay1/receipt", { method: "POST" }), params);

const stored = {
  id: "pay1",
  amountChargedCents: 125000,
  orderSnapshot: null,
  createdAt: new Date("2026-11-04T09:30:00Z"),
  receiptNumber: 7,
  receiptPdfKey: "s3://receipts/o1/Kvittering 7.pdf",
  order: {
    displayId: 20046,
    orderNumber: "20046",
    email: "kari@example.com",
    customerName: "Kari",
    customerLabel: null,
    deliveryAddress: null,
    pickupAddress: null,
    websiteBookingDetails: null,
    deliveryDate: null,
    emailThreadToken: null,
    payments: [],
    refunds: [],
  },
};

describe("/api/orders/[orderId]/payments/[paymentId]/receipt — a Stripe payment's receipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INVOICE_SELLER_NAME = "Otman Transport AS";
    process.env.INVOICE_ORG_NUMBER = "923609016";
    mocks.authorize.mockResolvedValue({ ok: true, companyId: "c1", actor: { membershipId: "m1" } });
    mocks.paymentFindFirst.mockResolvedValue(stored);
    mocks.download.mockResolvedValue({ bytes: Buffer.from("%PDF-stored"), contentType: "application/pdf", sizeBytes: 11 });
  });

  it("is admins only, and only the admin's company's payments", async () => {
    mocks.authorize.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) });
    expect((await get()).status).toBe(403);

    await get();
    expect(mocks.paymentFindFirst.mock.calls[0]![0].where).toEqual({ id: "pay1", orderId: "o1", companyId: "c1" });
  });

  it("shows the PDF as sent, inline or as a download", async () => {
    const res = await get();
    expect(res.headers.get("content-disposition")).toBe('inline; filename="Kvittering 7.pdf"');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("%PDF-stored");
    expect((await get("?download=1")).headers.get("content-disposition")).toBe('attachment; filename="Kvittering 7.pdf"');
  });

  it("draws it again when no stored copy can be read", async () => {
    mocks.paymentFindFirst.mockResolvedValue({ ...stored, receiptPdfKey: null });
    const res = await get();
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("is not found before the payment has a receipt", async () => {
    mocks.paymentFindFirst.mockResolvedValue({ ...stored, receiptNumber: null, receiptPdfKey: null });
    expect((await get()).status).toBe(404);
  });

  it("POST emails it to the customer again", async () => {
    mocks.sendPaymentReceipt.mockResolvedValue({ ok: true, number: 7 });
    const res = await post();
    expect(await res.json()).toEqual({ ok: true, number: 7 });
    expect(mocks.sendPaymentReceipt).toHaveBeenCalledWith({ paymentId: "pay1", resend: true });
  });

  it("POST says why it couldn't", async () => {
    mocks.sendPaymentReceipt.mockResolvedValue({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" });
    const res = await post();
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" });

    mocks.paymentFindFirst.mockResolvedValue(null);
    expect((await post()).status).toBe(404);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  refundFindFirst: vi.fn(),
  download: vi.fn(),
  sendRefundCreditNote: vi.fn(),
}));

vi.mock("@/lib/orders/websiteOrderAdminAccess", () => ({ authorizeWebsiteOrderAdmin: mocks.authorize }));
vi.mock("@/lib/db", () => ({ prisma: { orderRefund: { findFirst: mocks.refundFindFirst } } }));
vi.mock("@/lib/orders/orderAttachmentStorage", () => ({ downloadAttachmentFromS3: mocks.download }));
vi.mock("@/lib/invoices/refundCreditNotes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invoices/refundCreditNotes")>("@/lib/invoices/refundCreditNotes");
  return { ...actual, sendRefundCreditNote: mocks.sendRefundCreditNote };
});

import { GET, POST } from "./route";

const params = { params: Promise.resolve({ orderId: "o1", refundId: "ref1" }) };
const get = (query = "") => GET(new Request(`http://localhost/api/orders/o1/refunds/ref1/credit-note${query}`), params);
const post = () => POST(new Request("http://localhost/api/orders/o1/refunds/ref1/credit-note", { method: "POST" }), params);

const stored = {
  id: "ref1",
  amountRefundedCents: 50000,
  orderSnapshot: null,
  createdAt: new Date("2026-11-06T09:30:00Z"),
  receiptNumber: 12,
  receiptPdfKey: "s3://receipts/o1/Kreditnota W-12.pdf",
  orderPayment: { receiptNumber: 7 },
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

describe("/api/orders/[orderId]/refunds/[refundId]/credit-note — a Stripe refund's credit note", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INVOICE_SELLER_NAME = "Otman Transport AS";
    process.env.INVOICE_ORG_NUMBER = "923609016";
    mocks.authorize.mockResolvedValue({ ok: true, companyId: "c1", actor: { membershipId: "m1" } });
    mocks.refundFindFirst.mockResolvedValue(stored);
    mocks.download.mockResolvedValue({ bytes: Buffer.from("%PDF-stored"), contentType: "application/pdf", sizeBytes: 11 });
  });

  it("is admins only, and only the admin's company's refunds", async () => {
    mocks.authorize.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) });
    expect((await get()).status).toBe(403);

    await get();
    expect(mocks.refundFindFirst.mock.calls[0]![0].where).toEqual({ id: "ref1", orderId: "o1", companyId: "c1" });
  });

  it("shows the PDF as sent, inline or as a download", async () => {
    const res = await get();
    expect(res.headers.get("content-disposition")).toBe('inline; filename="Kreditnota W-12.pdf"');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("%PDF-stored");
    expect((await get("?download=1")).headers.get("content-disposition")).toBe('attachment; filename="Kreditnota W-12.pdf"');
  });

  it("draws it again when no stored copy can be read", async () => {
    mocks.refundFindFirst.mockResolvedValue({ ...stored, receiptPdfKey: null });
    const res = await get();
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("is not found before the refund has a credit note", async () => {
    mocks.refundFindFirst.mockResolvedValue({ ...stored, receiptNumber: null, receiptPdfKey: null });
    expect((await get()).status).toBe(404);
  });

  it("POST emails it to the customer (again), or says why it couldn't", async () => {
    mocks.sendRefundCreditNote.mockResolvedValue({ ok: true, number: 12 });
    expect(await (await post()).json()).toEqual({ ok: true, number: 12 });
    expect(mocks.sendRefundCreditNote).toHaveBeenCalledWith({ refundId: "ref1", resend: true });

    mocks.sendRefundCreditNote.mockResolvedValue({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" });
    expect((await post()).status).toBe(422);

    mocks.refundFindFirst.mockResolvedValue(null);
    expect((await post()).status).toBe(404);
  });
});

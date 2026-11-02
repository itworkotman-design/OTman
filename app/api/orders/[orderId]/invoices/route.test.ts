import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  sendOrderInvoice: vi.fn(),
  getOrderInvoiceOverview: vi.fn(),
}));

vi.mock("@/lib/orders/websiteOrderAdminAccess", () => ({ authorizeWebsiteOrderAdmin: mocks.authorize }));
vi.mock("@/lib/invoices/orderInvoices", () => ({
  sendOrderInvoice: mocks.sendOrderInvoice,
  getOrderInvoiceOverview: mocks.getOrderInvoiceOverview,
}));

import { GET, POST } from "./route";

const params = { params: Promise.resolve({ orderId: "o1" }) };
const actor = { membershipId: "m1", name: "Admin", email: "a@otman.no", source: "USER" };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/orders/o1/invoices", { method: "POST", body: JSON.stringify(body) }), params);

describe("/api/orders/[orderId]/invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ ok: true, companyId: "c1", actor });
  });

  it("is admins only", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 }) });
    expect((await post({ kind: "invoice", amountCents: 100 })).status).toBe(403);
    expect((await GET(new Request("http://localhost"), params)).status).toBe(403);
    expect(mocks.sendOrderInvoice).not.toHaveBeenCalled();
  });

  it("lists the order's fakturas and how it stands", async () => {
    mocks.getOrderInvoiceOverview.mockResolvedValue({ invoices: [{ id: "i1" }], ledger: { outcome: "paid" }, paymentStatus: "paid" });
    const json = await (await GET(new Request("http://localhost"), params)).json();
    expect(json).toEqual({ ok: true, invoices: [{ id: "i1" }], ledger: { outcome: "paid" }, paymentStatus: "paid" });
    expect(mocks.getOrderInvoiceOverview).toHaveBeenCalledWith("o1", "c1");
  });

  it("sends a faktura for the amount the admin saw", async () => {
    mocks.sendOrderInvoice.mockResolvedValue({ ok: true, invoice: { id: "i2", invoiceNumber: "1042-2" }, paymentStatus: "pending" });
    const res = await post({ kind: "invoice", amountCents: 61000 });
    expect(res.status).toBe(200);
    expect(mocks.sendOrderInvoice).toHaveBeenCalledWith({ orderId: "o1", companyId: "c1", actor, kind: "invoice", expectedAmountCents: 61000 });
    expect(await res.json()).toEqual({ ok: true, invoice: { id: "i2", invoiceNumber: "1042-2" }, paymentStatus: "pending" });
  });

  it("records a kreditnota with kind refund", async () => {
    mocks.sendOrderInvoice.mockResolvedValue({ ok: true, invoice: { id: "i3" }, paymentStatus: "paid" });
    await post({ kind: "refund", amountCents: 30000 });
    expect(mocks.sendOrderInvoice.mock.calls[0]![0]).toMatchObject({ kind: "refund", expectedAmountCents: 30000 });
  });

  it("needs a kind and the amount shown", async () => {
    expect((await post({ kind: "gift" })).status).toBe(400);
    expect((await post({ kind: "invoice" })).status).toBe(400);
  });

  it("tells the admin the current amount when the order changed", async () => {
    mocks.sendOrderInvoice.mockResolvedValue({ ok: false, reason: "AMOUNT_CHANGED", amountCents: 70000 });
    const res = await post({ kind: "invoice", amountCents: 61000 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "AMOUNT_CHANGED", amountCents: 70000 });
  });

  it("maps the other refusals to a status", async () => {
    for (const [reason, status] of [
      ["ORDER_NOT_FOUND", 404],
      ["NOTHING_TO_INVOICE", 409],
      ["MISSING_CUSTOMER_EMAIL", 422],
      ["INVOICE_SETTINGS_MISSING", 500],
      ["INVOICE_SEND_FAILED", 502],
    ] as const) {
      mocks.sendOrderInvoice.mockResolvedValue({ ok: false, reason });
      expect((await post({ kind: "invoice", amountCents: 1 })).status).toBe(status);
    }
  });
});

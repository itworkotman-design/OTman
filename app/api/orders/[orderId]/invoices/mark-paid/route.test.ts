import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), markOrderInvoicesPaid: vi.fn() }));

vi.mock("@/lib/orders/websiteOrderAdminAccess", () => ({ authorizeWebsiteOrderAdmin: mocks.authorize }));
vi.mock("@/lib/invoices/orderInvoices", () => ({ markOrderInvoicesPaid: mocks.markOrderInvoicesPaid }));

import { POST } from "./route";

const params = { params: Promise.resolve({ orderId: "o1" }) };
const call = () => POST(new Request("http://localhost/api/orders/o1/invoices/mark-paid", { method: "POST" }), params);
const actor = { membershipId: "m1", name: "Admin", email: "a@otman.no", source: "USER" };

describe("POST /api/orders/[orderId]/invoices/mark-paid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ ok: true, companyId: "c1", actor });
  });

  it("is admins only", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) });
    expect((await call()).status).toBe(403);
    expect(mocks.markOrderInvoicesPaid).not.toHaveBeenCalled();
  });

  it("marks the order's fakturas paid", async () => {
    mocks.markOrderInvoicesPaid.mockResolvedValue({ ok: true, paymentStatus: "paid" });
    const res = await call();
    expect(await res.json()).toEqual({ ok: true, paymentStatus: "paid" });
    expect(mocks.markOrderInvoicesPaid).toHaveBeenCalledWith({ orderId: "o1", companyId: "c1", actor });
  });

  it("refuses when nothing is unpaid", async () => {
    mocks.markOrderInvoicesPaid.mockResolvedValue({ ok: false, reason: "NOTHING_TO_MARK_PAID" });
    expect((await call()).status).toBe(409);
  });
});

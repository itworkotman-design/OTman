import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), invoiceFindFirst: vi.fn(), download: vi.fn() }));

vi.mock("@/lib/orders/websiteOrderAdminAccess", () => ({ authorizeWebsiteOrderAdmin: mocks.authorize }));
vi.mock("@/lib/db", () => ({ prisma: { orderInvoice: { findFirst: mocks.invoiceFindFirst } } }));
vi.mock("@/lib/orders/orderAttachmentStorage", () => ({ downloadAttachmentFromS3: mocks.download }));

import { GET } from "./route";

const params = { params: Promise.resolve({ orderId: "o1", invoiceId: "i1" }) };
const call = (query = "") => GET(new Request(`http://localhost/api/orders/o1/invoices/i1/pdf${query}`), params);

describe("GET /api/orders/[orderId]/invoices/[invoiceId]/pdf — the faktura exactly as sent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ ok: true, companyId: "c1", actor: {} });
    mocks.invoiceFindFirst.mockResolvedValue({ invoiceNumber: "1042-2", kind: "invoice", pdfKey: "s3://bucket/orders/invoices/o1/x.pdf" });
    mocks.download.mockResolvedValue({ bytes: Buffer.from("%PDF-1.7"), contentType: "application/pdf", sizeBytes: 8 });
  });

  it("is admins only", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) });
    expect((await call()).status).toBe(403);
  });

  it("looks the faktura up within the admin's company", async () => {
    await call();
    expect(mocks.invoiceFindFirst).toHaveBeenCalledWith({
      where: { id: "i1", orderId: "o1", companyId: "c1" },
      select: { invoiceNumber: true, kind: true, pdfKey: true },
    });
  });

  it("shows the stored PDF inline, or as a download", async () => {
    const inline = await call();
    expect(inline.headers.get("content-type")).toBe("application/pdf");
    expect(inline.headers.get("content-disposition")).toBe('inline; filename="Faktura 1042-2.pdf"');
    expect(Buffer.from(await inline.arrayBuffer()).toString()).toBe("%PDF-1.7");
    expect((await call("?download=1")).headers.get("content-disposition")).toBe('attachment; filename="Faktura 1042-2.pdf"');
  });

  it("is 404 for an unknown faktura or one without a stored file", async () => {
    mocks.invoiceFindFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    mocks.invoiceFindFirst.mockResolvedValue({ invoiceNumber: "1042", kind: "invoice", pdfKey: null });
    expect((await call()).status).toBe(404);
  });
});

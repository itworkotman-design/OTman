import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  loadWebSalesReport: vi.fn(),
  buildWebSalesWorkbook: vi.fn(),
  renderWebSalesReportPdf: vi.fn(),
}));

vi.mock("@/lib/orders/websiteOrderAdminAccess", () => ({ authorizeWebsiteOrderAdmin: mocks.authorize }));
vi.mock("@/lib/invoices/webSalesReportData", () => ({ loadWebSalesReport: mocks.loadWebSalesReport }));
vi.mock("@/lib/invoices/webSalesWorkbook", async (actual) => ({
  ...(await actual<object>()),
  buildWebSalesWorkbook: mocks.buildWebSalesWorkbook,
}));

vi.mock("@/lib/invoices/webSalesReportPdf", () => ({ renderWebSalesReportPdf: mocks.renderWebSalesReportPdf }));

import { GET } from "./route";

const get = (query: string) => GET(new Request(`http://localhost/api/orders/web-sales-report${query}`));

describe("/api/orders/web-sales-report — the monthly W-series report for the accountant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ ok: true, companyId: "c1", actor: { membershipId: "m1" } });
    mocks.loadWebSalesReport.mockResolvedValue({ report: { period: "2026-11" }, stripeUnavailable: false });
    mocks.buildWebSalesWorkbook.mockResolvedValue(Buffer.from("xlsx-bytes"));
    mocks.renderWebSalesReportPdf.mockResolvedValue(new Uint8Array(Buffer.from("%PDF-report")));
  });

  it("is for website-order admins only", async () => {
    mocks.authorize.mockResolvedValueOnce({ ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) });
    expect((await get("?month=2026-11")).status).toBe(403);
    expect(mocks.loadWebSalesReport).not.toHaveBeenCalled();
  });

  it("needs a valid month or day", async () => {
    expect((await get("?month=nov")).status).toBe(400);
    expect((await get("?date=2026-02-30")).status).toBe(400);
    expect((await get("")).status).toBe(400);
  });

  it("downloads the active company's month as an Excel file", async () => {
    const res = await get("?month=2026-11");

    expect(res.status).toBe(200);
    expect(mocks.loadWebSalesReport).toHaveBeenCalledWith({
      companyId: "c1",
      period: { label: "2026-11", from: new Date("2026-10-31T23:00:00Z"), to: new Date("2026-11-30T23:00:00Z") },
    });
    expect(mocks.buildWebSalesWorkbook).toHaveBeenCalledWith({ period: "2026-11" }, { createdAt: expect.any(Date), stripeUnavailable: false });
    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="Nettsalg W-serie 2026-11.xlsx"');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("xlsx-bytes");
  });

  it("downloads it as a PDF with format=pdf", async () => {
    const res = await get("?month=2026-11&format=pdf");
    expect(mocks.renderWebSalesReportPdf).toHaveBeenCalledWith({ period: "2026-11" }, { createdAt: expect.any(Date), stripeUnavailable: false });
    expect(mocks.buildWebSalesWorkbook).not.toHaveBeenCalled();
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="Nettsalg W-serie 2026-11.pdf"');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("%PDF-report");
  });

  it("downloads a single day", async () => {
    const res = await get("?date=2026-11-05");
    expect(mocks.loadWebSalesReport).toHaveBeenCalledWith({
      companyId: "c1",
      period: { label: "2026-11-05", from: new Date("2026-11-04T23:00:00Z"), to: new Date("2026-11-05T23:00:00Z") },
    });
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="Nettsalg W-serie 2026-11-05.xlsx"');
  });
});

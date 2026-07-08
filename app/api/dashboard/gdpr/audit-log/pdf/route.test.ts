import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  companyFindUniqueMock: vi.fn(),
  orderEventFindManyMock: vi.fn(),
  buildGdprAuditLogPdfMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    company: { findUnique: mocks.companyFindUniqueMock },
    orderEvent: { findMany: mocks.orderEventFindManyMock },
  },
}));

vi.mock("@/lib/gdpr/buildAuditLogPdf", () => ({
  buildGdprAuditLogPdf: mocks.buildGdprAuditLogPdfMock,
}));

import { GET } from "./route";

describe("GET /api/dashboard/gdpr/audit-log/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN" });
    mocks.companyFindUniqueMock.mockResolvedValue({ name: "Test Company" });
    mocks.orderEventFindManyMock.mockResolvedValue([]);
    mocks.buildGdprAuditLogPdfMock.mockResolvedValue(Buffer.from("%PDF-fake"));
  });

  it("returns 403 for a non-admin membership", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER" });

    const res = await GET(new Request("http://localhost/api/dashboard/gdpr/audit-log/pdf"));

    expect(res.status).toBe(403);
    expect(mocks.buildGdprAuditLogPdfMock).not.toHaveBeenCalled();
  });

  it("streams back a PDF with an attachment Content-Disposition", async () => {
    const res = await GET(new Request("http://localhost/api/dashboard/gdpr/audit-log/pdf"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment;");
    expect(res.headers.get("Content-Disposition")).toContain("gdpr-audit-log.pdf");

    const body = Buffer.from(await res.arrayBuffer());
    expect(body.toString()).toBe("%PDF-fake");
  });

  it("passes the parsed date range through to both the query and the PDF filename", async () => {
    const res = await GET(
      new Request("http://localhost/api/dashboard/gdpr/audit-log/pdf?from=2026-06-01&to=2026-06-30"),
    );

    expect(mocks.orderEventFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2026-06-01"),
            lte: new Date("2026-06-30T23:59:59.999"),
          },
        }),
      }),
    );
    expect(mocks.buildGdprAuditLogPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "Test Company",
        from: new Date("2026-06-01"),
        to: new Date("2026-06-30T23:59:59.999"),
      }),
    );
    expect(res.headers.get("Content-Disposition")).toContain(
      "gdpr-audit-log_2026-06-01_to_2026-06-30.pdf",
    );
  });
});

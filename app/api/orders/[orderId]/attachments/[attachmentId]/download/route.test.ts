import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canCreateOrdersMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  attachmentFindFirstMock: vi.fn(),
  readFileMock: vi.fn(),
  statMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/users/orderAccess", () => ({
  canCreateOrders: mocks.canCreateOrdersMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findFirst: mocks.membershipFindFirstMock,
    },
    order: {
      findFirst: mocks.orderFindFirstMock,
    },
    orderAttachment: {
      findFirst: mocks.attachmentFindFirstMock,
    },
  },
}));

vi.mock("fs/promises", () => ({
  readFile: mocks.readFileMock,
  stat: mocks.statMock,
}));

import { GET } from "./route";

describe("GET /api/orders/[orderId]/attachments/[attachmentId]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canCreateOrdersMock.mockReturnValue(true);
  });

  it("returns 403 when the user cannot access the order", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "USER",
      permissions: [],
    });
    mocks.canCreateOrdersMock.mockReturnValue(false);
    mocks.orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      createdByMembershipId: "membership-2",
      customerMembershipId: "membership-3",
      subcontractorMembershipId: "membership-4",
    });

    const res = await GET(
      new Request(
        "http://localhost/api/orders/order-1/attachments/att-1/download",
      ),
      { params: Promise.resolve({ orderId: "order-1", attachmentId: "att-1" }) },
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
    expect(mocks.attachmentFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns the local file with download headers", async () => {
    const bytes = Buffer.from([1, 2, 3, 4]);

    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "membership-1",
      role: "ADMIN",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      createdByMembershipId: "membership-2",
      customerMembershipId: "membership-3",
      subcontractorMembershipId: "membership-4",
    });
    mocks.attachmentFindFirstMock.mockResolvedValue({
      filename: 'invoice-"q1".pdf',
      mimeType: "application/pdf",
      sizeBytes: 4,
      storagePath: "/uploads/orders/order-1/wordpress/42-invoice.pdf",
    });
    mocks.statMock.mockResolvedValue({ size: 4 });
    mocks.readFileMock.mockResolvedValue(bytes);

    const res = await GET(
      new Request(
        "http://localhost/api/orders/order-1/attachments/att-1/download",
      ),
      { params: Promise.resolve({ orderId: "order-1", attachmentId: "att-1" }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Length")).toBe("4");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="invoice-_q1_.pdf"',
    );
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
  });
});

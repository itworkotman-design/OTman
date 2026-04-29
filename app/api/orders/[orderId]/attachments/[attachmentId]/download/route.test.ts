import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canCreateOrdersMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  attachmentFindFirstMock: vi.fn(),
  readFileMock: vi.fn(),
  statMock: vi.fn(),
  isS3StoragePathMock: vi.fn(),
  downloadAttachmentFromS3Mock: vi.fn(),
  getSignedAttachmentUrlMock: vi.fn(),
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

vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  isS3StoragePath: mocks.isS3StoragePathMock,
  downloadAttachmentFromS3: mocks.downloadAttachmentFromS3Mock,
  getSignedAttachmentUrl: mocks.getSignedAttachmentUrlMock,
}));

import { GET } from "./route";

describe("GET /api/orders/[orderId]/attachments/[attachmentId]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canCreateOrdersMock.mockReturnValue(true);
    mocks.isS3StoragePathMock.mockReturnValue(false);
    mocks.getSignedAttachmentUrlMock.mockResolvedValue(null);
    vi.unstubAllGlobals();
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
      sourceUrl: "https://example.com/invoice.pdf",
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
      'inline; filename="invoice-_q1_.pdf"',
    );
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
  });

  it("falls back to the source URL when the local WordPress file is missing", async () => {
    const bytes = new Uint8Array([5, 6, 7]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

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
      filename: "wp-invoice.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3,
      storagePath: "/uploads/orders/order-1/wordpress/missing.pdf",
      sourceUrl: "https://otman.no/wp-content/uploads/wp-invoice.pdf",
    });
    mocks.statMock.mockRejectedValue(new Error("missing"));

    const res = await GET(
      new Request(
        "http://localhost/api/orders/order-1/attachments/att-1/download",
      ),
      { params: Promise.resolve({ orderId: "order-1", attachmentId: "att-1" }) },
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://otman.no/wp-content/uploads/wp-invoice.pdf",
      {
        headers: {
          Accept: "application/pdf",
        },
      },
    );
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Length")).toBe("3");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("returns S3-backed attachments through the authenticated download route", async () => {
    mocks.isS3StoragePathMock.mockReturnValue(true);
    mocks.getSignedAttachmentUrlMock.mockResolvedValue(
      "https://signed.example.test/uploaded.pdf",
    );
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
      filename: "uploaded.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3,
      storagePath: "s3://orders/order-1/uploaded.pdf",
      sourceUrl: null,
    });

    const res = await GET(
      new Request(
        "http://localhost/api/orders/order-1/attachments/att-1/download",
      ),
      { params: Promise.resolve({ orderId: "order-1", attachmentId: "att-1" }) },
    );

    expect(res.status).toBe(307);
    expect(mocks.getSignedAttachmentUrlMock).toHaveBeenCalledWith({
      storagePath: "s3://orders/order-1/uploaded.pdf",
      filename: "uploaded.pdf",
      mimeType: "application/pdf",
      download: false,
    });
    expect(mocks.readFileMock).not.toHaveBeenCalled();
    expect(res.headers.get("Location")).toBe(
      "https://signed.example.test/uploaded.pdf",
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canEditOrdersMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  attachmentFindManyMock: vi.fn(),
  attachmentCountMock: vi.fn(),
  attachmentCreateMock: vi.fn(),
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
  randomUUIDMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/users/orderAccess", () => ({
  canEditOrders: mocks.canEditOrdersMock,
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
      findMany: mocks.attachmentFindManyMock,
      count: mocks.attachmentCountMock,
      create: mocks.attachmentCreateMock,
    },
  },
}));

vi.mock("fs/promises", () => ({
  mkdir: mocks.mkdirMock,
  writeFile: mocks.writeFileMock,
}));

vi.mock("crypto", () => ({
  randomUUID: mocks.randomUUIDMock,
}));

import { GET, POST } from "./route";

describe("routes in /api/orders/[orderId]/attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEditOrdersMock.mockReturnValue(true);
    mocks.randomUUIDMock.mockReturnValue("uuid-1");
  });

  it("GET returns 404 when the order does not exist", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.orderFindFirstMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/orders/order-1/attachments"), {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "ORDER_NOT_FOUND",
    });
  });

  it("POST returns 400 when the file is missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "ADMIN",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindFirstMock.mockResolvedValue({ id: "order-1" });
    mocks.attachmentCountMock.mockResolvedValue(0);

    const req = new Request("http://localhost/api/orders/order-1/attachments", {
      method: "POST",
      body: new FormData(),
    });

    const res = await POST(req, {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FILE_REQUIRED",
    });
  });

  it("POST accepts pdf files", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({
      role: "ADMIN",
      permissions: [{ permission: "BOOKING_CREATE" }],
    });
    mocks.orderFindFirstMock.mockResolvedValue({ id: "order-1" });
    mocks.attachmentCountMock.mockResolvedValue(0);
    mocks.mkdirMock.mockResolvedValue(undefined);
    mocks.writeFileMock.mockResolvedValue(undefined);
    mocks.attachmentCreateMock.mockResolvedValue({
      id: "att-1",
      filename: "manual.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4,
      storagePath: "/uploads/orders/order-1/manual.pdf",
      createdAt: new Date("2026-04-14T00:00:00.000Z"),
    });

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3, 4])], "manual.pdf", {
        type: "application/pdf",
      }),
    );

    const req = new Request("http://localhost/api/orders/order-1/attachments", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req, {
      params: Promise.resolve({ orderId: "order-1" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      attachment: {
        id: "att-1",
        filename: "manual.pdf",
        mimeType: "application/pdf",
      },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  findManyMock: vi.fn(),
  getAttachmentAccessUrlsMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    orderAttachment: {
      findMany: mocks.findManyMock,
    },
  },
}));

vi.mock("@/lib/orders/orderAttachmentStorage", () => ({
  getAttachmentAccessUrls: mocks.getAttachmentAccessUrlsMock,
}));

import { GET } from "./route";

describe("GET /api/orders/attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAttachmentAccessUrlsMock.mockImplementation(
      async ({
        defaultUrl,
        defaultDownloadUrl,
      }: {
        defaultUrl: string;
        defaultDownloadUrl?: string;
      }) => ({
        url: defaultUrl,
        downloadUrl: defaultDownloadUrl ?? defaultUrl,
      }),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/orders/attachments"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("returns mapped attachments for the active company", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.findManyMock.mockResolvedValue([
      {
        id: "att-1",
        orderId: "order-1",
        category: "RECEIPT",
        filename: "invoice.png",
        mimeType: "image/png",
        sizeBytes: 1024,
        storagePath: "/uploads/orders/1/invoice.png",
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
      },
    ]);

    const res = await GET(new Request("http://localhost/api/orders/attachments"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      attachments: [
        {
          id: "att-1",
          category: "RECEIPT",
          filename: "invoice.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          storagePath: "/uploads/orders/1/invoice.png",
          createdAt: "2030-01-01T00:00:00.000Z",
          url: "/api/orders/order-1/attachments/att-1/download",
          downloadUrl: "/api/orders/order-1/attachments/att-1/download?download=1",
        },
      ],
    });
  });
});

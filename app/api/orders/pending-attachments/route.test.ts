import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  countMock: vi.fn(),
  findManyMock: vi.fn(),
  createMock: vi.fn(),
  deleteManyMock: vi.fn(),
  unlinkMock: vi.fn(),
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
  randomUUIDMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    pendingOrderAttachment: {
      count: mocks.countMock,
      findMany: mocks.findManyMock,
      create: mocks.createMock,
      deleteMany: mocks.deleteManyMock,
    },
  },
}));

vi.mock("fs/promises", () => ({
  mkdir: mocks.mkdirMock,
  writeFile: mocks.writeFileMock,
  unlink: mocks.unlinkMock,
}));

vi.mock("crypto", () => ({
  randomUUID: mocks.randomUUIDMock,
}));

import { DELETE, GET, POST } from "./route";

describe("routes in /api/orders/pending-attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.randomUUIDMock.mockReturnValue("uuid-1");
  });

  it("GET returns 401 when no session exists", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/orders/pending-attachments"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("POST returns 400 when the uploaded file is missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });

    const formData = new FormData();
    const req = new Request("http://localhost/api/orders/pending-attachments", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      reason: "FILE_REQUIRED",
    });
  });

  it("POST accepts pdf files", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });
    mocks.countMock.mockResolvedValue(0);
    mocks.mkdirMock.mockResolvedValue(undefined);
    mocks.writeFileMock.mockResolvedValue(undefined);
    mocks.createMock.mockResolvedValue({
      id: "att-1",
      filename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4,
      storagePath: "/uploads/pending-orders/user-1/file.pdf",
      createdAt: new Date("2026-04-14T00:00:00.000Z"),
    });

    const formData = new FormData();
    formData.append(
      "file",
      new File([new Uint8Array([1, 2, 3, 4])], "test.pdf", {
        type: "application/pdf",
      }),
    );

    const req = new Request("http://localhost/api/orders/pending-attachments", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      attachment: {
        id: "att-1",
        filename: "test.pdf",
        mimeType: "application/pdf",
      },
    });
  });

  it("DELETE clears pending attachments for the current session", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
    });
    mocks.findManyMock.mockResolvedValue([
      { id: "att-1", storagePath: "/uploads/pending-orders/user-1/file.png" },
    ]);
    mocks.deleteManyMock.mockResolvedValue({ count: 1 });

    const res = await DELETE(
      new Request("http://localhost/api/orders/pending-attachments", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mocks.deleteManyMock).toHaveBeenCalledWith({
      where: { sessionId: "user-1" },
    });
    expect(mocks.unlinkMock).toHaveBeenCalledTimes(1);
  });
});

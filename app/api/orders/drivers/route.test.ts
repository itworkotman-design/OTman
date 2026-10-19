import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    order: { findMany: mocks.orderFindManyMock },
  },
}));

import { GET } from "./route";

describe("GET /api/orders/drivers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/orders/drivers"));

    expect(response.status).toBe(401);
  });

  it("returns the drivers found on the active company's orders for an admin", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "admin-user",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "ADMIN" });
    mocks.orderFindManyMock.mockResolvedValue([
      { driver: "otto" },
      { driver: "Otto / Edijs" },
      { driver: "kari nordmann" },
    ]);

    const response = await GET(new Request("http://localhost/api/orders/drivers"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.drivers).toEqual([
      { id: "edijs", label: "Edijs" },
      { id: "Kari Nordmann", label: "Kari Nordmann" },
      { id: "otto", label: "Otto" },
    ]);
    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: "company-1" }),
      }),
    );
  });

  it("returns 403 when the active membership is missing", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/orders/drivers"));

    expect(response.status).toBe(403);
  });

  it("returns 403 for a non-admin active member", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.membershipFindFirstMock.mockResolvedValue({ role: "USER" });

    const response = await GET(new Request("http://localhost/api/orders/drivers"));

    expect(response.status).toBe(403);
  });
});

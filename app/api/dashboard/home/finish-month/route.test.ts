import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  getActiveMembershipMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  membershipFindManyMock: vi.fn(),
  sendEmailMock: vi.fn(),
  buildFinishMonthWorkbookMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/auth/membership", () => ({
  getActiveMembership: mocks.getActiveMembershipMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findMany: mocks.orderFindManyMock,
    },
    membership: {
      findMany: mocks.membershipFindManyMock,
    },
  },
}));

vi.mock("@/lib/email/sendEmail", () => ({
  sendEmail: mocks.sendEmailMock,
}));

vi.mock("@/lib/dashboard/finishMonthWorkbook", () => ({
  buildFinishMonthWorkbook: mocks.buildFinishMonthWorkbookMock,
}));

import { POST } from "./route";

describe("POST /api/dashboard/home/finish-month", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/dashboard/home/finish-month", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("returns 403 when the active membership is not admin or owner", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getActiveMembershipMock.mockResolvedValue({
      role: "USER",
    });

    const response = await POST(
      new Request("http://localhost/api/dashboard/home/finish-month", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
  });

  it("sends one workbook email per subcontractor with monthly orders", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getActiveMembershipMock.mockResolvedValue({
      role: "ADMIN",
    });
    mocks.orderFindManyMock.mockResolvedValue([
      {
        displayId: 20001,
        orderNumber: "A-1",
        createdAt: new Date("2026-04-03T10:00:00.000Z"),
        deliveryDate: "2026-04-10",
        customerLabel: "Customer 1",
        customerName: "Customer One",
        pickupAddress: "Pickup 1",
        deliveryAddress: "Delivery 1",
        returnAddress: "Return 1",
        priceSubcontractor: 500,
        subcontractorMembershipId: "sub-1",
        subcontractor: "Sub One",
      },
      {
        displayId: 20002,
        orderNumber: "A-2",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        deliveryDate: "2026-04-11",
        customerLabel: "Customer 2",
        customerName: "Customer Two",
        pickupAddress: "Pickup 2",
        deliveryAddress: "Delivery 2",
        returnAddress: "",
        priceSubcontractor: 900,
        subcontractorMembershipId: "sub-2",
        subcontractor: "Sub Two",
      },
    ]);
    mocks.membershipFindManyMock.mockResolvedValue([
      {
        id: "sub-1",
        user: {
          email: "sub1@example.com",
          username: "Sub One",
        },
      },
      {
        id: "sub-2",
        user: {
          email: "sub2@example.com",
          username: "Sub Two",
        },
      },
    ]);
    mocks.buildFinishMonthWorkbookMock.mockResolvedValue(Buffer.from("excel"));
    mocks.sendEmailMock.mockResolvedValue({
      messageId: "message-1",
    });

    const response = await POST(
      new Request("http://localhost/api/dashboard/home/finish-month", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      sentCount: 2,
    });

    expect(mocks.buildFinishMonthWorkbookMock).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmailMock).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmailMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: {
          email: "sub1@example.com",
          name: "Sub One",
        },
        attachments: [
          expect.objectContaining({
            name: expect.stringMatching(/^finish-month-sub-one-\d{4}-\d{2}\.xlsx$/),
            content: Buffer.from("excel").toString("base64"),
          }),
        ],
      }),
    );
    expect(mocks.sendEmailMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: {
          email: "sub2@example.com",
          name: "Sub Two",
        },
      }),
    );
  });

  it("returns a no-op response when there are no monthly subcontractor orders", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue({
      userId: "user-1",
      activeCompanyId: "company-1",
    });
    mocks.getActiveMembershipMock.mockResolvedValue({
      role: "OWNER",
    });
    mocks.orderFindManyMock.mockResolvedValue([]);

    const response = await POST(
      new Request("http://localhost/api/dashboard/home/finish-month", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      sentCount: 0,
    });
    expect(mocks.membershipFindManyMock).not.toHaveBeenCalled();
    expect(mocks.sendEmailMock).not.toHaveBeenCalled();
  });
});

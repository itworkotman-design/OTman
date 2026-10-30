import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
  canEditOrdersMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  orderUpdateManyMock: vi.fn(),
  orderEmailMessageCreateManyMock: vi.fn(),
  sendGmailEmailMock: vi.fn(),
  createOrderActionEventMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedSession: mocks.getAuthenticatedSessionMock,
}));

vi.mock("@/lib/users/orderAccess", () => ({
  canEditOrders: mocks.canEditOrdersMock,
}));

vi.mock("@/lib/email/sendGmailEmail", () => ({
  sendGmailEmail: mocks.sendGmailEmailMock,
}));

vi.mock("@/lib/email/gmailAccounts", () => ({
  getGmailSendAsEmail: () => "post@otman.no",
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderActionEvent: mocks.createOrderActionEventMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirstMock },
    order: { findMany: mocks.orderFindManyMock, updateMany: mocks.orderUpdateManyMock },
    orderEmailMessage: { createMany: mocks.orderEmailMessageCreateManyMock },
  },
}));

import { POST } from "./route";

const recipients = [
  { email: "alnabru@power.no", name: "POWER Alnabru" },
  { email: "lager@power.no", name: "POWER Alnabru" },
];

function request(body: unknown) {
  return new Request("http://localhost/api/orders/send-prepare-email", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/orders/send-prepare-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canEditOrdersMock.mockReturnValue(true);
    mocks.getAuthenticatedSessionMock.mockResolvedValue({ userId: "user-1", activeCompanyId: "company-1" });
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "admin-m",
      role: "ADMIN",
      user: { username: "Admin", email: "admin@otman.no" },
      company: { orderEmailsEnabled: true },
      permissions: [],
    });
    mocks.orderFindManyMock.mockResolvedValue([
      { id: "o1", displayId: 101, deliveryDate: "2026-10-29", productsSummary: "Vaskemaskin" },
      { id: "o2", displayId: 102, deliveryDate: "2026-10-29", productsSummary: "Kjøleskap" },
    ]);
    mocks.sendGmailEmailMock.mockResolvedValue({ gmailMessageId: "gm-1", gmailThreadId: "gt-1" });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthenticatedSessionMock.mockResolvedValue(null);
    expect((await POST(request({ orderIds: ["o1"], recipients }))).status).toBe(401);
  });

  it("returns 403 when the caller cannot edit orders", async () => {
    mocks.canEditOrdersMock.mockReturnValue(false);
    expect((await POST(request({ orderIds: ["o1"], recipients }))).status).toBe(403);
  });

  it("returns 409 when the company's order emails are disabled", async () => {
    mocks.membershipFindFirstMock.mockResolvedValue({
      id: "admin-m",
      role: "ADMIN",
      user: { username: "Admin", email: "admin@otman.no" },
      company: { orderEmailsEnabled: false },
      permissions: [],
    });
    expect((await POST(request({ orderIds: ["o1"], recipients }))).status).toBe(409);
    expect(mocks.sendGmailEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 without orders or recipients", async () => {
    expect((await POST(request({ orderIds: [], recipients }))).status).toBe(400);
    expect((await POST(request({ orderIds: ["o1"], recipients: [] }))).status).toBe(400);
  });

  it("sends one Gmail email with no reply token or thread", async () => {
    const res = await POST(request({ orderIds: ["o1", "o2"], recipients, recipientName: "POWER Alnabru" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, sentCount: 2 });
    expect(mocks.orderFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["o1", "o2"] }, companyId: "company-1" } }),
    );
    expect(mocks.sendGmailEmailMock).toHaveBeenCalledTimes(1);
    const sent = mocks.sendGmailEmailMock.mock.calls[0][0];
    expect(sent).toMatchObject({ to: recipients, subject: "Forbered bestillinger" });
    expect(sent.html).toContain("Hei POWER Alnabru,");
    expect(sent).not.toHaveProperty("threadToken");
    expect(sent).not.toHaveProperty("replyTo");
    expect(sent).not.toHaveProperty("gmailThreadId");
  });

  it("marks the orders as prepare-email sent without touching the conversation", async () => {
    await POST(request({ orderIds: ["o1", "o2"], recipients, recipientName: "POWER Alnabru" }));

    // Not a conversation message: logging one would change the Alert Center
    // default recipient, "Re:" subjects and first-message notifications.
    expect(mocks.orderEmailMessageCreateManyMock).not.toHaveBeenCalled();
    expect(mocks.orderUpdateManyMock).toHaveBeenCalledTimes(1);
    const update = mocks.orderUpdateManyMock.mock.calls[0][0];
    expect(update.where).toEqual({ id: { in: ["o1", "o2"] } });
    expect(Object.keys(update.data)).toEqual(["prepareEmailSentAt"]);
    expect(update.data.prepareEmailSentAt).toBeInstanceOf(Date);
    // History still records who it went to.
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledTimes(2);
    expect(mocks.createOrderActionEventMock.mock.calls[0][1]).toMatchObject({
      orderId: "o1",
      title: "Order sent for Forbered bestillinger",
      details: ["Recipients: alnabru@power.no, lager@power.no"],
    });
  });

  it("returns the failure reason without writing anything to the orders", async () => {
    mocks.sendGmailEmailMock.mockRejectedValue(new Error("GMAIL_DOWN"));

    const res = await POST(request({ orderIds: ["o1", "o2"], recipients, recipientName: "POWER Alnabru" }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ ok: false, reason: "GMAIL_DOWN" });
    expect(mocks.orderEmailMessageCreateManyMock).not.toHaveBeenCalled();
    expect(mocks.orderUpdateManyMock).not.toHaveBeenCalled();
    expect(mocks.createOrderActionEventMock).not.toHaveBeenCalled();
  });
});

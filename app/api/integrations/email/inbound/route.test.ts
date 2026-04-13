import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindFirstMock: vi.fn(),
  orderEmailMessageCreateMock: vi.fn(),
  orderUpdateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findFirst: mocks.orderFindFirstMock,
      update: mocks.orderUpdateMock,
    },
    orderEmailMessage: {
      create: mocks.orderEmailMessageCreateMock,
    },
  },
}));

import { POST } from "./route";

describe("POST /api/integrations/email/inbound", () => {
  const originalSecret = process.env.EMAIL_INBOUND_SECRET;
  const originalSenderEmail = process.env.BREVO_SENDER_EMAIL;
  const originalSenderName = process.env.BREVO_SENDER_NAME;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_INBOUND_SECRET = "secret-123";
    process.env.BREVO_SENDER_EMAIL = "bestilling@otman.no";
    process.env.BREVO_SENDER_NAME = "Otman Transport";
  });

  afterAll(() => {
    process.env.EMAIL_INBOUND_SECRET = originalSecret;
    process.env.BREVO_SENDER_EMAIL = originalSenderEmail;
    process.env.BREVO_SENDER_NAME = originalSenderName;
  });

  it("returns 401 when the inbound secret does not match", async () => {
    const response = await POST(
      new Request("http://localhost/api/integrations/email/inbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-email-secret": "wrong-secret",
        },
        body: JSON.stringify({
          from: "Customer <customer@example.com>",
          to: "reply+thread123@otman.no",
          subject: "Hello",
          text: "Test",
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("returns 400 when no thread token can be extracted", async () => {
    const response = await POST(
      new Request("http://localhost/api/integrations/email/inbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-email-secret": "secret-123",
        },
        body: JSON.stringify({
          from: "Customer <customer@example.com>",
          to: "reply@otman.no",
          subject: "Hello",
          text: "Test",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "THREAD_TOKEN_NOT_FOUND",
    });
  });

  it("stores an inbound message and marks the order for attention", async () => {
    mocks.orderFindFirstMock.mockResolvedValue({
      id: "order-1",
      companyId: "company-1",
    });
    mocks.orderEmailMessageCreateMock.mockResolvedValue({
      id: "email-1",
    });
    mocks.orderUpdateMock.mockResolvedValue({
      id: "order-1",
    });

    const response = await POST(
      new Request("http://localhost/api/integrations/email/inbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-otman-email-secret": "secret-123",
        },
        body: JSON.stringify({
          from: "Customer Name <customer@example.com>",
          to: "reply+thread123@otman.no",
          recipients: ["reply+thread123@otman.no"],
          subject: "Re: Order 20001 [OTMAN:thread123]",
          text: "Inbound email body",
          html: "<p>Inbound email body</p>",
          messageId: "<message-id-1>",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    expect(mocks.orderFindFirstMock).toHaveBeenCalledWith({
      where: {
        emailThreadToken: "thread123",
      },
      select: {
        id: true,
        companyId: true,
      },
    });

    expect(mocks.orderEmailMessageCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        companyId: "company-1",
        direction: "INBOUND",
        status: "RECEIVED",
        externalMessageId: "<message-id-1>",
        subject: "Re: Order 20001 [OTMAN:thread123]",
        bodyText: "Inbound email body",
        bodyHtml: "<p>Inbound email body</p>",
        fromEmail: "customer@example.com",
        fromName: "Customer Name",
        toEmail: "reply+thread123@otman.no",
        toName: "Otman Transport",
      }),
    });

    expect(mocks.orderUpdateMock).toHaveBeenCalledWith({
      where: {
        id: "order-1",
      },
      data: {
        lastInboundEmailAt: expect.any(Date),
        needsEmailAttention: true,
        unreadInboundEmailCount: {
          increment: 1,
        },
      },
    });
  });
});

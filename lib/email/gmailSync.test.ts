import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const gmailMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
  sendAsList: vi.fn(),
  labelsList: vi.fn(),
  labelsCreate: vi.fn(),
  messagesList: vi.fn(),
  messagesGet: vi.fn(),
  messagesModify: vi.fn(),
  threadsModify: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn(),
  orderEmailMessageFindFirst: vi.fn(),
  orderEmailMessageCreate: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn(function OAuth2() {
        return {
          setCredentials: vi.fn(),
        };
      }),
    },
    gmail: vi.fn(() => ({
      users: {
        getProfile: gmailMock.getProfile,
        settings: {
          sendAs: {
            list: gmailMock.sendAsList,
          },
        },
        labels: {
          list: gmailMock.labelsList,
          create: gmailMock.labelsCreate,
        },
        messages: {
          list: gmailMock.messagesList,
          get: gmailMock.messagesGet,
          modify: gmailMock.messagesModify,
        },
        threads: {
          modify: gmailMock.threadsModify,
        },
      },
    })),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findFirst: prismaMock.orderFindFirst,
      update: prismaMock.orderUpdate,
    },
    orderEmailMessage: {
      findFirst: prismaMock.orderEmailMessageFindFirst,
      create: prismaMock.orderEmailMessageCreate,
    },
  },
}));

import { syncGmailOrderConversations } from "./gmailSync";

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function gmailMessage(input: {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  messageId: string;
  bodyText: string;
  date?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}) {
  return {
    data: {
      id: input.id,
      threadId: input.threadId,
      payload: {
        headers: [
          { name: "From", value: input.from },
          { name: "To", value: input.to },
          { name: "Subject", value: input.subject },
          { name: "Message-ID", value: input.messageId },
          { name: "Date", value: input.date ?? "Fri, 8 May 2026 15:27:48 +0200" },
          ...(input.replyTo ? [{ name: "Reply-To", value: input.replyTo }] : []),
          ...(input.inReplyTo ? [{ name: "In-Reply-To", value: input.inReplyTo }] : []),
          ...(input.references ? [{ name: "References", value: input.references }] : []),
        ],
        mimeType: "text/plain",
        body: {
          data: encodeBase64Url(input.bodyText),
        },
      },
      snippet: input.bodyText,
    },
  };
}

describe("syncGmailOrderConversations", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GMAIL_ACCOUNT_EMAIL: "bestilling@otman.no",
      GMAIL_SEND_AS_EMAIL: "bestilling@otman.no",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN: "refresh-token",
    };
    gmailMock.getProfile.mockResolvedValue({
      data: {
        emailAddress: "bestilling@otman.no",
      },
    });
    gmailMock.sendAsList.mockResolvedValue({
      data: {
        sendAs: [],
      },
    });
    gmailMock.labelsList.mockResolvedValue({
      data: {
        labels: [
          {
            id: "label-order-emails",
            name: "OTMAN/Order Emails",
          },
          {
            id: "label-customer-replies",
            name: "OTMAN/Customer Replies",
          },
          {
            id: "label-admin-sent",
            name: "OTMAN/Admin Sent",
          },
          {
            id: "label-needs-attention",
            name: "OTMAN/Needs Attention",
          },
        ],
      },
    });
    gmailMock.labelsCreate.mockImplementation(({ requestBody }: { requestBody?: { name?: string } }) =>
      Promise.resolve({
        data: {
          id: `created-${requestBody?.name ?? "label"}`,
        },
      }),
    );
    gmailMock.messagesModify.mockResolvedValue({
      data: {},
    });
    gmailMock.threadsModify.mockResolvedValue({
      data: {},
    });
    prismaMock.orderEmailMessageCreate.mockResolvedValue({
      id: "message-row-id",
    });
    prismaMock.orderUpdate.mockResolvedValue({
      id: "order-id",
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("imports manual Gmail Sent replies as outbound by matching Gmail thread id", async () => {
    gmailMock.messagesList
      .mockResolvedValueOnce({ data: { messages: [] } })
      .mockResolvedValueOnce({ data: { messages: [{ id: "gmail-sent-id" }] } });
    gmailMock.messagesGet.mockResolvedValueOnce(
      gmailMessage({
        id: "gmail-sent-id",
        threadId: "gmail-thread-1",
        from: "Otman Transport <bestilling@otman.no>",
        to: "Customer <customer@example.com>",
        subject: "Re: Order 21236 | TEST",
        messageId: "<manual-reply@example.com>",
        inReplyTo: "<previous-outbound@example.com>",
        references: "<previous-outbound@example.com>",
        bodyText: "Manual Gmail reply",
      }),
    );
    prismaMock.orderEmailMessageFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        orderId: "order-id",
        companyId: "company-id",
        order: {
          needsEmailAttention: false,
        },
      });

    await expect(syncGmailOrderConversations()).resolves.toEqual({
      imported: 1,
      skippedDuplicates: 0,
      tokenNotFound: 0,
      orderNotFound: 0,
    });

    expect(gmailMock.messagesList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        q: "in:sent newer_than:30d",
      }),
    );
    expect(prismaMock.orderEmailMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        direction: "OUTBOUND",
        source: "GMAIL",
        status: "SENT",
        externalMessageId: "<manual-reply@example.com>",
        gmailMessageId: "gmail-sent-id",
        gmailThreadId: "gmail-thread-1",
        bodyText: "Manual Gmail reply",
        sentAt: expect.any(Date),
        receivedAt: null,
      }),
    });
    expect(prismaMock.orderUpdate).toHaveBeenCalledWith({
      where: {
        id: "order-id",
      },
      data: {
        lastOutboundEmailAt: expect.any(Date),
      },
    });
    expect(gmailMock.messagesModify).toHaveBeenCalledWith({
      userId: "bestilling@otman.no",
      id: "gmail-sent-id",
      requestBody: {
        addLabelIds: ["label-order-emails", "label-admin-sent"],
        removeLabelIds: ["label-needs-attention"],
      },
    });
    expect(gmailMock.threadsModify).toHaveBeenCalledWith({
      userId: "bestilling@otman.no",
      id: "gmail-thread-1",
      requestBody: {
        removeLabelIds: ["label-needs-attention"],
      },
    });
  });

  it("keeps inbound customer replies attention-worthy", async () => {
    gmailMock.messagesList
      .mockResolvedValueOnce({ data: { messages: [{ id: "gmail-inbound-id" }] } })
      .mockResolvedValueOnce({ data: { messages: [] } });
    gmailMock.messagesGet.mockResolvedValueOnce(
      gmailMessage({
        id: "gmail-inbound-id",
        threadId: "gmail-thread-2",
        from: "Customer <customer@example.com>",
        to: "reply+threadtoken@reply.otman.no",
        subject: "Re: Order 21236 | TEST",
        messageId: "<customer-reply@example.com>",
        bodyText: "Customer reply",
      }),
    );
    prismaMock.orderEmailMessageFindFirst.mockResolvedValueOnce(null);
    prismaMock.orderFindFirst.mockResolvedValueOnce({
      id: "order-id",
      companyId: "company-id",
      needsEmailAttention: false,
    });

    await expect(syncGmailOrderConversations()).resolves.toEqual({
      imported: 1,
      skippedDuplicates: 0,
      tokenNotFound: 0,
      orderNotFound: 0,
    });

    expect(prismaMock.orderEmailMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        direction: "INBOUND",
        source: "GMAIL",
        status: "RECEIVED",
        externalMessageId: "<customer-reply@example.com>",
        gmailMessageId: "gmail-inbound-id",
        gmailThreadId: "gmail-thread-2",
        sentAt: null,
        receivedAt: expect.any(Date),
      }),
    });
    expect(prismaMock.orderUpdate).toHaveBeenCalledWith({
      where: {
        id: "order-id",
      },
      data: {
        needsEmailAttention: true,
        unreadInboundEmailCount: {
          increment: 1,
        },
        lastInboundEmailAt: expect.any(Date),
      },
    });
    expect(gmailMock.messagesModify).toHaveBeenCalledWith({
      userId: "bestilling@otman.no",
      id: "gmail-inbound-id",
      requestBody: {
        addLabelIds: ["label-order-emails", "label-customer-replies", "label-needs-attention"],
        removeLabelIds: [],
      },
    });
  });

  it("creates missing labels once per sync", async () => {
    gmailMock.labelsList.mockResolvedValueOnce({
      data: {
        labels: [],
      },
    });
    gmailMock.messagesList
      .mockResolvedValueOnce({ data: { messages: [{ id: "gmail-inbound-id" }] } })
      .mockResolvedValueOnce({ data: { messages: [] } });
    gmailMock.messagesGet.mockResolvedValueOnce(
      gmailMessage({
        id: "gmail-inbound-id",
        threadId: "gmail-thread-2",
        from: "Customer <customer@example.com>",
        to: "reply+threadtoken@reply.otman.no",
        subject: "Re: Order 21236 | TEST",
        messageId: "<customer-reply@example.com>",
        bodyText: "Customer reply",
      }),
    );
    prismaMock.orderEmailMessageFindFirst.mockResolvedValueOnce(null);
    prismaMock.orderFindFirst.mockResolvedValueOnce({
      id: "order-id",
      companyId: "company-id",
      needsEmailAttention: false,
    });

    await syncGmailOrderConversations();

    expect(gmailMock.labelsCreate).toHaveBeenCalledTimes(4);
    expect(gmailMock.labelsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: "OTMAN/Order Emails",
        }),
      }),
    );
    expect(gmailMock.messagesModify).toHaveBeenCalledWith({
      userId: "bestilling@otman.no",
      id: "gmail-inbound-id",
      requestBody: {
        addLabelIds: [
          "created-OTMAN/Order Emails",
          "created-OTMAN/Customer Replies",
          "created-OTMAN/Needs Attention",
        ],
        removeLabelIds: [],
      },
    });
  });

  it("does not block message sync when labeling fails", async () => {
    gmailMock.messagesModify.mockRejectedValueOnce(new Error("label failed"));
    gmailMock.messagesList
      .mockResolvedValueOnce({ data: { messages: [{ id: "gmail-inbound-id" }] } })
      .mockResolvedValueOnce({ data: { messages: [] } });
    gmailMock.messagesGet.mockResolvedValueOnce(
      gmailMessage({
        id: "gmail-inbound-id",
        threadId: "gmail-thread-2",
        from: "Customer <customer@example.com>",
        to: "reply+threadtoken@reply.otman.no",
        subject: "Re: Order 21236 | TEST",
        messageId: "<customer-reply@example.com>",
        bodyText: "Customer reply",
      }),
    );
    prismaMock.orderEmailMessageFindFirst.mockResolvedValueOnce(null);
    prismaMock.orderFindFirst.mockResolvedValueOnce({
      id: "order-id",
      companyId: "company-id",
      needsEmailAttention: false,
    });

    await expect(syncGmailOrderConversations()).resolves.toEqual({
      imported: 1,
      skippedDuplicates: 0,
      tokenNotFound: 0,
      orderNotFound: 0,
    });

    expect(prismaMock.orderEmailMessageCreate).toHaveBeenCalledTimes(1);
    expect(prismaMock.orderUpdate).toHaveBeenCalledTimes(1);
  });
});

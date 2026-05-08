import { afterEach, describe, expect, it, vi } from "vitest";
import { sendGmailEmail } from "./sendGmailEmail";

const gmailMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
  sendAsList: vi.fn(),
  messagesSend: vi.fn(),
  messagesGet: vi.fn(),
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
        messages: {
          send: gmailMock.messagesSend,
          get: gmailMock.messagesGet,
        },
      },
    })),
  },
}));

describe("sendGmailEmail", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  function mockSuccessfulMetadataLookup() {
    gmailMock.messagesSend.mockResolvedValue({
      data: {
        id: "gmail-message-id",
        threadId: "gmail-thread-id",
      },
    });
    gmailMock.messagesGet.mockResolvedValue({
      data: {
        payload: {
          headers: [
            {
              name: "Message-ID",
              value: "<message@example.com>",
            },
          ],
        },
      },
    });
  }

  it("passes the existing Gmail thread id to messages.send", async () => {
    process.env = {
      ...originalEnv,
      GMAIL_ACCOUNT_EMAIL: "itworkotman@gmail.com",
      GMAIL_SEND_AS_EMAIL: "bestilling@otman.no",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN: "refresh-token",
    };
    gmailMock.getProfile.mockResolvedValue({
      data: {
        emailAddress: "itworkotman@gmail.com",
      },
    });
    gmailMock.sendAsList.mockResolvedValue({
      data: {
        sendAs: [
          {
            sendAsEmail: "bestilling@otman.no",
            verificationStatus: "accepted",
          },
        ],
      },
    });
    mockSuccessfulMetadataLookup();

    await sendGmailEmail({
      to: {
        email: "customer@example.com",
      },
      subject: "Re: Order 20001",
      html: "<p>Hello</p>",
      text: "Hello",
      replyTo: "reply+threadtoken@reply.otman.no",
      gmailThreadId: "existing-thread-id",
    });

    expect(gmailMock.messagesSend).toHaveBeenCalledWith({
      userId: "itworkotman@gmail.com",
      requestBody: expect.objectContaining({
        raw: expect.any(String),
        threadId: "existing-thread-id",
      }),
    });
  });

  it("allows the primary authenticated mailbox without alias verification", async () => {
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
    mockSuccessfulMetadataLookup();

    await sendGmailEmail({
      to: {
        email: "customer@example.com",
      },
      subject: "Order 20001",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(gmailMock.sendAsList).not.toHaveBeenCalled();
    expect(gmailMock.messagesSend).toHaveBeenCalledWith({
      userId: "bestilling@otman.no",
      requestBody: expect.objectContaining({
        raw: expect.any(String),
      }),
    });
  });

  it("requires accepted verification for custom send-as aliases", async () => {
    process.env = {
      ...originalEnv,
      GMAIL_ACCOUNT_EMAIL: "bestilling@otman.no",
      GMAIL_SEND_AS_EMAIL: "orders@example.com",
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
        sendAs: [
          {
            sendAsEmail: "orders@example.com",
            verificationStatus: "pending",
          },
        ],
      },
    });

    await expect(
      sendGmailEmail({
        to: {
          email: "customer@example.com",
        },
        subject: "Order 20001",
        html: "<p>Hello</p>",
        text: "Hello",
      }),
    ).rejects.toThrow("GMAIL_SEND_AS_ALIAS_NOT_ACCEPTED");

    expect(gmailMock.messagesSend).not.toHaveBeenCalled();
  });
});

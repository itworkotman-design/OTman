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
    gmailMock.messagesSend.mockResolvedValue({
      data: {
        id: "gmail-message-id",
        threadId: "new-thread-id",
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
});

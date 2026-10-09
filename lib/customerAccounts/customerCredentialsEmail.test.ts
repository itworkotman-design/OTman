import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendGmailEmail: vi.fn(),
  orderUpdate: vi.fn(),
  emailMessageCreate: vi.fn(),
  createOrderActionEvent: vi.fn(),
  createOrderNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { order: { update: mocks.orderUpdate }, orderEmailMessage: { create: mocks.emailMessageCreate } },
}));
vi.mock("@/lib/email/sendGmailEmail", () => ({ sendGmailEmail: mocks.sendGmailEmail }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderActionEvent: mocks.createOrderActionEvent }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/email/emailAssets", () => ({ getOrderEmailLogoUrl: () => "https://otman.no/logo.png" }));
vi.mock("@/lib/email/gmailAccounts", () => ({
  getGmailSendAsEmail: () => "post@otman.no",
  formatGmailSenderName: () => "Otman AS",
}));

import { buildCustomerCredentialsEmail, sendCustomerCredentialsEmail } from "./customerCredentialsEmail";

const order = { id: "o1", companyId: "c1", displayId: 42, orderNumber: "K7MQ4XZ2", customerName: "Ola", emailThreadToken: null };

describe("buildCustomerCredentialsEmail", () => {
  beforeEach(() => {
    process.env.ORDER_ACTION_BASE_URL = "https://otman.no";
  });

  it("contains the username, password and a link to the order", () => {
    const { subject, html } = buildCustomerCredentialsEmail({ order, email: "ola@example.com", password: "Abcdefgh2345" });

    expect(subject).toContain("#K7MQ4XZ2");
    expect(html).toContain("ola@example.com");
    expect(html).toContain("Abcdefgh2345");
    expect(html).toContain("https://otman.no/min-bestilling/K7MQ4XZ2");
  });
});

describe("sendCustomerCredentialsEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.ORDER_ACTION_BASE_URL = "https://otman.no";
    process.env.EMAIL_REPLY_DOMAIN = "reply.otman.no";
    mocks.sendGmailEmail.mockResolvedValue({ messageId: "<m1>", gmailMessageId: "g1", gmailThreadId: "t1", syncWarning: null });
  });

  it("sends the real password through Gmail, threaded to the order, but logs the email with the password masked", async () => {
    const ok = await sendCustomerCredentialsEmail({ order, email: "ola@example.com", password: "Abcdefgh2345" });

    expect(ok).toBe(true);
    const sent = mocks.sendGmailEmail.mock.calls[0][0];
    expect(sent).toMatchObject({ to: { email: "ola@example.com", name: "Ola" }, orderId: "o1", direction: "outbound" });
    expect(sent.html).toContain("Abcdefgh2345");
    expect(sent.replyTo).toBe(`reply+${sent.threadToken}@reply.otman.no`);
    expect(mocks.orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "o1" }, data: expect.objectContaining({ emailThreadToken: sent.threadToken }) }),
    );

    const logged = mocks.emailMessageCreate.mock.calls[0][0].data;
    // Logged under the Gmail ids, so Gmail sync skips the plaintext copy.
    expect(logged).toEqual(
      expect.objectContaining({ orderId: "o1", direction: "OUTBOUND", status: "SENT", source: "GMAIL", gmailMessageId: "g1", toEmail: "ola@example.com" }),
    );
    expect(JSON.stringify(logged)).not.toContain("Abcdefgh2345");
    expect(logged.bodyHtml).toContain("••••••••••••");
    expect(mocks.createOrderActionEvent).toHaveBeenCalled();
  });

  it("reuses the order's existing email thread", async () => {
    await sendCustomerCredentialsEmail({ order: { ...order, emailThreadToken: "abc123" }, email: "ola@example.com", password: "Abcdefgh2345" });

    expect(mocks.sendGmailEmail.mock.calls[0][0].threadToken).toBe("abc123");
    expect(mocks.orderUpdate.mock.calls[0][0].data.emailThreadToken).toBeUndefined();
  });

  it("alerts staff when Gmail fails, without the password in the alert", async () => {
    mocks.sendGmailEmail.mockRejectedValue(new Error("Gmail send failed: Abcdefgh2345"));

    const ok = await sendCustomerCredentialsEmail({ order, email: "ola@example.com", password: "Abcdefgh2345" });

    expect(ok).toBe(false);
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", type: "MANUAL_REVIEW" }),
    );
    expect(JSON.stringify(mocks.createOrderNotification.mock.calls)).not.toContain("Abcdefgh2345");
    expect(JSON.stringify(mocks.emailMessageCreate.mock.calls)).not.toContain("Abcdefgh2345");
  });

  it("never throws when the email can't even be built (no ORDER_ACTION_BASE_URL) — alerts staff instead", async () => {
    delete process.env.ORDER_ACTION_BASE_URL;

    await expect(sendCustomerCredentialsEmail({ order, email: "ola@example.com", password: "Abcdefgh2345" })).resolves.toBe(false);

    expect(mocks.sendGmailEmail).not.toHaveBeenCalled();
    expect(mocks.emailMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: "o1", status: "FAILED" }) }),
    );
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", type: "MANUAL_REVIEW" }),
    );
  });
});

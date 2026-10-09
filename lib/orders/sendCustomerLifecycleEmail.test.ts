import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendGmailEmail: vi.fn(),
  orderUpdate: vi.fn(),
  orderEmailMessageCreate: vi.fn(),
  createOrderActionEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { update: mocks.orderUpdate },
    orderEmailMessage: { create: mocks.orderEmailMessageCreate },
  },
}));
vi.mock("@/lib/email/sendGmailEmail", () => ({ sendGmailEmail: mocks.sendGmailEmail }));
vi.mock("@/lib/email/gmailAccounts", () => ({
  getGmailSendAsEmail: () => "bestilling@otman.no",
  formatGmailSenderName: () => "Otman AS",
}));
vi.mock("@/lib/email/emailAssets", () => ({ getOrderEmailLogoUrl: () => "https://otman.no/logo.png" }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderActionEvent: mocks.createOrderActionEvent }));

import { LIFECYCLE_EMAIL_KINDS, sendLifecycleEmailsForOrders } from "./sendCustomerLifecycleEmail";

const baseOrder = {
  id: "order1",
  companyId: "c1",
  displayId: 42,
  orderNumber: "K7MQ4XZ2" as string | null,
  customerName: "Ola Nordmann",
  customerLabel: null,
  statusNotes: null,
  actionToken: null as string | null,
  email: "ola@example.com" as string | null,
  emailThreadToken: null,
};

const actor = { source: "SYSTEM" as const, name: "Website" };

describe("sendLifecycleEmailsForOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ORDER_ACTION_BASE_URL = "https://otman.no";
    mocks.sendGmailEmail.mockResolvedValue({
      messageId: "<abc@mail.gmail.com>",
      gmailMessageId: "g1",
      gmailThreadId: "t1",
      syncWarning: null,
    });
    mocks.orderUpdate.mockResolvedValue({});
    mocks.orderEmailMessageCreate.mockResolvedValue({});
    mocks.createOrderActionEvent.mockResolvedValue({});
  });

  it("is a registered lifecycle kind", () => {
    expect(LIFECYCLE_EMAIL_KINDS).toContain("order_received");
  });

  it("sends through the company Gmail (same path as the Email Center), threaded to the order", async () => {
    const result = await sendLifecycleEmailsForOrders({ orders: [baseOrder], kind: "order_received", actor });

    expect(result).toEqual({ sentCount: 1, failedOrderIds: [] });
    expect(mocks.sendGmailEmail).toHaveBeenCalledTimes(1);
    const args = mocks.sendGmailEmail.mock.calls[0][0];
    expect(args).toMatchObject({
      to: { email: "ola@example.com" },
      orderId: "order1",
      orderNumber: "K7MQ4XZ2",
      direction: "outbound",
    });
    expect(args.subject).toContain("K7MQ4XZ2");
    expect(args.html).toContain("Ola Nordmann");
    expect(args.text.length).toBeGreaterThan(0);
    // Reply-To + thread token so the customer's reply lands on the order.
    expect(args.replyTo).toEqual(expect.any(String));
    expect(args.threadToken).toEqual(expect.any(String));
    expect(mocks.orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emailThreadToken: args.threadToken }) }),
    );
  });

  it("records the message the way the Email Center does (source GMAIL + Gmail ids) so Gmail sync does not duplicate it", async () => {
    await sendLifecycleEmailsForOrders({ orders: [baseOrder], kind: "order_received", actor });

    expect(mocks.orderEmailMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order1",
        direction: "OUTBOUND",
        status: "SENT",
        source: "GMAIL",
        externalMessageId: "<abc@mail.gmail.com>",
        gmailMessageId: "g1",
        gmailThreadId: "t1",
        fromEmail: "bestilling@otman.no",
        toEmail: "ola@example.com",
      }),
    });
  });

  it("marks the message SENT_WITH_SYNC_WARNING when Gmail reports a sync warning", async () => {
    mocks.sendGmailEmail.mockResolvedValue({ messageId: null, gmailMessageId: "g1", gmailThreadId: "t1", syncWarning: "lookup failed" });

    await sendLifecycleEmailsForOrders({ orders: [baseOrder], kind: "order_received", actor });

    expect(mocks.orderEmailMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "SENT_WITH_SYNC_WARNING" }),
    });
  });

  it("sends order_received even though the order has no actionToken yet", async () => {
    const result = await sendLifecycleEmailsForOrders({ orders: [baseOrder], kind: "order_received", actor });

    expect(result.sentCount).toBe(1);
  });

  it("still requires an actionToken for the kinds that build action links", async () => {
    const result = await sendLifecycleEmailsForOrders({ orders: [baseOrder], kind: "payment_request", actor });

    expect(result).toEqual({ sentCount: 0, failedOrderIds: ["order1"] });
    expect(mocks.sendGmailEmail).not.toHaveBeenCalled();
  });

  it("still requires a customer email", async () => {
    const result = await sendLifecycleEmailsForOrders({ orders: [{ ...baseOrder, email: null }], kind: "order_received", actor });

    expect(result.failedOrderIds).toEqual(["order1"]);
    expect(mocks.sendGmailEmail).not.toHaveBeenCalled();
  });

  it("records a FAILED message and reports the order when Gmail rejects the send", async () => {
    mocks.sendGmailEmail.mockRejectedValue(new Error("GMAIL_SEND_AS_ALIAS_NOT_ACCEPTED"));

    const result = await sendLifecycleEmailsForOrders({ orders: [baseOrder], kind: "order_received", actor });

    expect(result).toEqual({ sentCount: 0, failedOrderIds: ["order1"] });
    expect(mocks.orderEmailMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "FAILED", bodyText: expect.stringContaining("GMAIL_SEND_AS_ALIAS_NOT_ACCEPTED") }),
    });
  });

  it("keeps going after one order fails, so a bulk send does not lose the rest", async () => {
    mocks.sendGmailEmail.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({
      messageId: "<m2>",
      gmailMessageId: "g2",
      gmailThreadId: "t2",
      syncWarning: null,
    });

    const result = await sendLifecycleEmailsForOrders({
      orders: [baseOrder, { ...baseOrder, id: "order2" }],
      kind: "order_received",
      actor,
    });

    expect(result).toEqual({ sentCount: 1, failedOrderIds: ["order1"] });
  });

  describe("an order_received email with the customer's new password", () => {
    const withPassword = { ...baseOrder, customerLogin: { email: "ola@example.com", password: "WZeMSSoC5EZn" } };

    it("sends the real password through Gmail but logs the Email Center copy with it masked, under the Gmail ids", async () => {
      await sendLifecycleEmailsForOrders({ orders: [withPassword], kind: "order_received", actor });

      expect(mocks.sendGmailEmail.mock.calls[0][0].html).toContain("WZeMSSoC5EZn");
      const logged = mocks.orderEmailMessageCreate.mock.calls[0][0].data;
      // Gmail sync skips a message whose gmailMessageId is already logged, so
      // the plaintext copy in Gmail never reaches the Email Center.
      expect(logged).toMatchObject({ status: "SENT", gmailMessageId: "g1", gmailThreadId: "t1" });
      expect(logged.bodyHtml).toContain("ola@example.com");
      expect(JSON.stringify(logged)).not.toContain("WZeMSSoC5EZn");
    });

    it("keeps the password out of a FAILED record, whatever the error says", async () => {
      mocks.sendGmailEmail.mockRejectedValue(new Error("rejected body containing WZeMSSoC5EZn"));

      await sendLifecycleEmailsForOrders({ orders: [withPassword], kind: "order_received", actor });

      expect(JSON.stringify(mocks.orderEmailMessageCreate.mock.calls)).not.toContain("WZeMSSoC5EZn");
    });
  });
});

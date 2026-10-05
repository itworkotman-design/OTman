import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  emailMessageCreate: vi.fn(),
  createOrderActionEvent: vi.fn(),
  createOrderNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { orderEmailMessage: { create: mocks.emailMessageCreate } } }));
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/orders/orderEvents", () => ({ createOrderActionEvent: mocks.createOrderActionEvent }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/email/emailAssets", () => ({ getOrderEmailLogoUrl: () => "https://otman.no/logo.png" }));
vi.mock("@/lib/email/gmailAccounts", () => ({ getGmailSendAsEmail: () => "post@otman.no" }));

import { buildCustomerCredentialsEmail, sendCustomerCredentialsEmail } from "./customerCredentialsEmail";

const order = { id: "o1", companyId: "c1", displayId: 42, orderNumber: "K7MQ4XZ2", customerName: "Ola" };

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
    process.env.BREVO_SENDER_EMAIL = "noreply@otman.no";
    mocks.sendEmail.mockResolvedValue({ messageId: "brevo-1" });
  });

  it("sends the real password via Brevo but logs the email on the order with the password masked", async () => {
    const ok = await sendCustomerCredentialsEmail({ order, email: "ola@example.com", password: "Abcdefgh2345" });

    expect(ok).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: { email: "ola@example.com", name: "Ola" }, html: expect.stringContaining("Abcdefgh2345") }),
    );
    const logged = mocks.emailMessageCreate.mock.calls[0][0].data;
    expect(logged).toEqual(
      expect.objectContaining({ orderId: "o1", companyId: "c1", direction: "OUTBOUND", status: "SENT", toEmail: "ola@example.com" }),
    );
    expect(JSON.stringify(logged)).not.toContain("Abcdefgh2345");
    expect(logged.bodyHtml).toContain("••••••••••••");
    expect(mocks.createOrderActionEvent).toHaveBeenCalled();
  });

  it("alerts staff when Brevo fails, without the password in the alert", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("Brevo send failed: Abcdefgh2345"));

    const ok = await sendCustomerCredentialsEmail({ order, email: "ola@example.com", password: "Abcdefgh2345" });

    expect(ok).toBe(false);
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", type: "MANUAL_REVIEW" }),
    );
    expect(JSON.stringify(mocks.createOrderNotification.mock.calls)).not.toContain("Abcdefgh2345");
    expect(JSON.stringify(mocks.emailMessageCreate.mock.calls)).not.toContain("Abcdefgh2345");
  });
});

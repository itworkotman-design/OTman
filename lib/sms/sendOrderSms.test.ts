import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  smsCreateMock: vi.fn(),
  smsUpdateMock: vi.fn(),
  sendGatewayApiSmsMock: vi.fn(),
  isSmsConfiguredMock: vi.fn(),
  createOrderActionEventMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    orderSmsMessage: { create: mocks.smsCreateMock, update: mocks.smsUpdateMock },
  },
}));

vi.mock("@/lib/sms/gatewayApi", () => ({
  sendGatewayApiSms: mocks.sendGatewayApiSmsMock,
  isSmsConfigured: mocks.isSmsConfiguredMock,
}));

vi.mock("@/lib/orders/orderEvents", () => ({
  createOrderActionEvent: mocks.createOrderActionEventMock,
}));

import { sendOrderSms } from "./sendOrderSms";

const baseParams = {
  order: { id: "order-1", companyId: "company-1" },
  toPhone: "402 84 977",
  body: "Hei Kari",
  kind: "MANUAL" as const,
  actor: { membershipId: "m-1", name: "Admin", email: "a@otman.no", source: "USER" },
};

describe("sendOrderSms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSmsConfiguredMock.mockReturnValue(true);
    mocks.smsCreateMock.mockResolvedValue({ id: "sms-1" });
    mocks.smsUpdateMock.mockResolvedValue({});
    mocks.sendGatewayApiSmsMock.mockResolvedValue({ msgId: "01ABC" });
  });

  it("logs the message, sends it with the row id as reference, and stores the provider id", async () => {
    const result = await sendOrderSms(baseParams);

    expect(result).toEqual({ ok: true, messageId: "sms-1" });
    expect(mocks.smsCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        companyId: "company-1",
        kind: "MANUAL",
        status: "SENT",
        toPhone: "4740284977",
        body: "Hei Kari",
        sentByMembershipId: "m-1",
      }),
      select: { id: true },
    });
    expect(mocks.sendGatewayApiSmsMock).toHaveBeenCalledWith({
      recipient: "4740284977",
      message: "Hei Kari",
      reference: "sms-1",
    });
    expect(mocks.smsUpdateMock).toHaveBeenCalledWith({
      where: { id: "sms-1" },
      data: expect.objectContaining({ externalMessageId: "01ABC", sentAt: expect.any(Date) }),
    });
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "order-1", title: "SMS sent", actor: baseParams.actor }),
    );
  });

  it("marks the row FAILED and returns the reason when the provider rejects", async () => {
    mocks.sendGatewayApiSmsMock.mockRejectedValue(new Error("GatewayAPI 422: Invalid sender"));

    const result = await sendOrderSms(baseParams);

    expect(result).toEqual({ ok: false, messageId: "sms-1", reason: "GatewayAPI 422: Invalid sender" });
    expect(mocks.smsUpdateMock).toHaveBeenCalledWith({
      where: { id: "sms-1" },
      data: expect.objectContaining({ status: "FAILED", errorMessage: "GatewayAPI 422: Invalid sender" }),
    });
    expect(mocks.createOrderActionEventMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: "SMS failed" }),
    );
  });

  it("logs a FAILED row without calling the API for an invalid phone number", async () => {
    const result = await sendOrderSms({ ...baseParams, toPhone: "123" });

    expect(result).toEqual({ ok: false, messageId: "sms-1", reason: "INVALID_PHONE" });
    expect(mocks.smsCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "FAILED", toPhone: "123", errorMessage: "Invalid phone number" }),
      select: { id: true },
    });
    expect(mocks.sendGatewayApiSmsMock).not.toHaveBeenCalled();
  });

  it("refuses an empty message or a missing phone without logging anything", async () => {
    expect(await sendOrderSms({ ...baseParams, body: "   " })).toEqual({ ok: false, reason: "EMPTY_MESSAGE" });
    expect(await sendOrderSms({ ...baseParams, toPhone: "" })).toEqual({ ok: false, reason: "MISSING_PHONE" });
    expect(mocks.smsCreateMock).not.toHaveBeenCalled();
  });

  it("refuses when GatewayAPI is not configured", async () => {
    mocks.isSmsConfiguredMock.mockReturnValue(false);
    expect(await sendOrderSms(baseParams)).toEqual({ ok: false, reason: "SMS_NOT_CONFIGURED" });
    expect(mocks.smsCreateMock).not.toHaveBeenCalled();
  });
});

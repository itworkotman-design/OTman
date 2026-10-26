import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const mocks = vi.hoisted(() => ({
  smsFindFirstMock: vi.fn(),
  smsUpdateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { orderSmsMessage: { findFirst: mocks.smsFindFirstMock, update: mocks.smsUpdateMock } },
}));

import { POST } from "./route";

const SECRET = "hook-secret";

function makeRequest(payload: unknown, secret = SECRET) {
  const body = JSON.stringify(payload);
  const signature = `v1=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return new Request("http://localhost/api/integrations/sms/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", Signature: signature },
    body,
  });
}

function statusEvent(event: Record<string, unknown>) {
  return {
    event_id: "evt-1",
    timestamp: "2026-10-26T08:10:00+00:00",
    event_type: "message.status.sms",
    event: { msg_id: "01ABC", recipient: 4740284977, reference: "sms-1", status: "DELIVERED", status_at: "2026-10-26T08:09:00+00:00", error: null, ...event },
  };
}

describe("POST /api/integrations/sms/webhook", () => {
  const originalSecret = process.env.GATEWAYAPI_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GATEWAYAPI_WEBHOOK_SECRET = SECRET;
    mocks.smsFindFirstMock.mockResolvedValue({ id: "sms-1", statusUpdatedAt: null });
    mocks.smsUpdateMock.mockResolvedValue({});
  });

  afterEach(() => {
    process.env.GATEWAYAPI_WEBHOOK_SECRET = originalSecret;
  });

  it("rejects a bad signature", async () => {
    const res = await POST(makeRequest(statusEvent({}), "wrong"));
    expect(res.status).toBe(401);
    expect(mocks.smsUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects everything when no webhook secret is configured", async () => {
    delete process.env.GATEWAYAPI_WEBHOOK_SECRET;
    const res = await POST(makeRequest(statusEvent({})));
    expect(res.status).toBe(401);
  });

  it("updates the message status by provider id or our reference", async () => {
    const res = await POST(makeRequest(statusEvent({})));

    expect(res.status).toBe(200);
    expect(mocks.smsFindFirstMock).toHaveBeenCalledWith({
      where: { OR: [{ externalMessageId: "01ABC" }, { id: "sms-1" }] },
      select: { id: true, statusUpdatedAt: true },
    });
    expect(mocks.smsUpdateMock).toHaveBeenCalledWith({
      where: { id: "sms-1" },
      data: {
        status: "DELIVERED",
        providerStatus: "DELIVERED",
        statusUpdatedAt: new Date("2026-10-26T08:09:00+00:00"),
        externalMessageId: "01ABC",
      },
    });
  });

  it("stores the provider error on a failed delivery", async () => {
    await POST(makeRequest(statusEvent({ status: "REJECTED", error: { hex_code: "0x1905", details: "Unsupported sender" } })));

    expect(mocks.smsUpdateMock).toHaveBeenCalledWith({
      where: { id: "sms-1" },
      data: expect.objectContaining({ status: "FAILED", providerStatus: "REJECTED", errorMessage: "Unsupported sender (0x1905)" }),
    });
  });

  it("ignores an event older than the stored status (out-of-order delivery)", async () => {
    mocks.smsFindFirstMock.mockResolvedValue({ id: "sms-1", statusUpdatedAt: new Date("2026-10-26T08:09:30+00:00") });

    const res = await POST(makeRequest(statusEvent({ status: "ENROUTE" })));

    expect(res.status).toBe(200);
    expect(mocks.smsUpdateMock).not.toHaveBeenCalled();
  });

  it("acknowledges unknown messages and other event types without writing", async () => {
    mocks.smsFindFirstMock.mockResolvedValue(null);
    expect((await POST(makeRequest(statusEvent({})))).status).toBe(200);
    expect((await POST(makeRequest({ event_type: "message.status.rcs", event: {} }))).status).toBe(200);
    expect(mocks.smsUpdateMock).not.toHaveBeenCalled();
  });
});

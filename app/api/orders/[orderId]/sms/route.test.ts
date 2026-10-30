import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSmsAdminMock: vi.fn(),
  orderFindFirstMock: vi.fn(),
  smsFindManyMock: vi.fn(),
  templateFindManyMock: vi.fn(),
  sendOrderSmsMock: vi.fn(),
  isSmsConfiguredMock: vi.fn(),
}));

vi.mock("@/lib/sms/smsAccess", () => ({ requireSmsAdmin: mocks.requireSmsAdminMock }));
vi.mock("@/lib/sms/sendOrderSms", () => ({ sendOrderSms: mocks.sendOrderSmsMock }));
vi.mock("@/lib/sms/gatewayApi", () => ({ isSmsConfigured: mocks.isSmsConfiguredMock }));
vi.mock("@/lib/db", () => ({
  prisma: {
    order: { findFirst: mocks.orderFindFirstMock },
    orderSmsMessage: { findMany: mocks.smsFindManyMock },
    smsTemplate: { findMany: mocks.templateFindManyMock },
  },
}));

import { GET, POST } from "./route";

const params = { params: Promise.resolve({ orderId: "order-1" }) };
const actor = { membershipId: "m-1", name: "Ola", email: "o@otman.no", source: "USER" };

const order = {
  id: "order-1",
  companyId: "c-1",
  phone: "40284977",
  phoneTwo: "99887766",
  displayId: 20001,
  orderNumber: null,
  customerName: "Kari",
  deliveryDate: "2026-10-26",
  timeWindow: null,
  deliveryAddress: "Storgata 1",
  productsSummary: "Kjøleskap",
  deliveryTypeSummary: null,
  servicesSummary: null,
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/orders/order-1/sms", { method: "POST", body: JSON.stringify(body) }),
    params,
  );
}

describe("/api/orders/[orderId]/sms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSmsAdminMock.mockResolvedValue({ ok: true, companyId: "c-1", membershipId: "m-1", actor });
    mocks.orderFindFirstMock.mockResolvedValue(order);
    mocks.smsFindManyMock.mockResolvedValue([{ id: "sms-1", body: "Hei" }]);
    mocks.templateFindManyMock.mockResolvedValue([{ id: "t-1", name: "Forsinkelse", body: "Hei {name}", kind: "MANUAL", enabled: true }]);
    mocks.sendOrderSmsMock.mockResolvedValue({ ok: true, messageId: "sms-2" });
    mocks.isSmsConfiguredMock.mockReturnValue(true);
  });

  it("passes through the access check's error response", async () => {
    mocks.requireSmsAdminMock.mockResolvedValue({ ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) });
    expect((await GET(new Request("http://localhost"), params)).status).toBe(403);
    expect((await post({ to: "1", message: "x" })).status).toBe(403);
  });

  it("returns 404 for an order outside the active company", async () => {
    mocks.orderFindFirstMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), params);
    expect(res.status).toBe(404);
    expect(mocks.orderFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "order-1", companyId: "c-1" } }));
  });

  it("GET returns messages, phone options, templates and template variables", async () => {
    const res = await GET(new Request("http://localhost"), params);
    const json = await res.json();

    expect(json).toMatchObject({
      ok: true,
      configured: true,
      messages: [{ id: "sms-1" }],
      phoneOptions: [
        { label: "Phone", phone: "40284977" },
        { label: "Phone 2", phone: "99887766" },
      ],
      templates: [{ id: "t-1", name: "Forsinkelse" }],
      variables: expect.objectContaining({ name: "Kari", address: "Storgata 1" }),
    });
  });

  it("GET offers every company template, automatic ones first, so they can also be sent by hand", async () => {
    mocks.templateFindManyMock.mockResolvedValue([
      { id: "m-1", name: "Forsinkelse", body: "Hei", kind: "MANUAL", enabled: true },
      { id: "r-1", name: "Review", body: "Takk", kind: "REVIEW_REQUEST", enabled: false },
      { id: "d-1", name: "Leveringsdag", body: "I dag", kind: "DAY_BEFORE_DELIVERY", enabled: true },
    ]);

    const json = await (await GET(new Request("http://localhost"), params)).json();

    expect(mocks.templateFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: "c-1" } }));
    expect(json.templates.map((template: { id: string }) => template.id)).toEqual(["d-1", "r-1", "m-1"]);
  });

  it("POST renders placeholders and sends a manual SMS", async () => {
    const res = await post({ to: "99887766", message: "Hei {name}, vi er forsinket." });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, messageId: "sms-2" });
    expect(mocks.sendOrderSmsMock).toHaveBeenCalledWith({
      order: { id: "order-1", companyId: "c-1" },
      toPhone: "99887766",
      body: "Hei Kari, vi er forsinket.",
      kind: "MANUAL",
      actor,
    });
  });

  it("POST maps validation failures to 400 and provider failures to 502", async () => {
    mocks.sendOrderSmsMock.mockResolvedValueOnce({ ok: false, reason: "EMPTY_MESSAGE" });
    expect((await post({ to: "1", message: "" })).status).toBe(400);

    mocks.sendOrderSmsMock.mockResolvedValueOnce({ ok: false, reason: "INVALID_PHONE", messageId: "x" });
    expect((await post({ to: "1", message: "Hei" })).status).toBe(400);

    mocks.sendOrderSmsMock.mockResolvedValueOnce({ ok: false, reason: "SMS_NOT_CONFIGURED" });
    expect((await post({ to: "1", message: "Hei" })).status).toBe(503);

    mocks.sendOrderSmsMock.mockResolvedValueOnce({ ok: false, reason: "GatewayAPI 500", messageId: "x" });
    const res = await post({ to: "1", message: "Hei" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, reason: "GatewayAPI 500" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { order: { findMany: mocks.findMany } } }));

import { listCustomerOrders } from "./customerOrderView";

const createdAt = new Date("2026-10-10T10:14:00Z");
const row = {
  orderNumber: "K7MQ4XZ2",
  status: "active",
  createdAt,
  deliveryDate: "2026-10-12",
  timeWindow: "10:00-16:00",
  pickupAddress: "Conradisvei 6, 0260 Oslo",
  extraPickupAddress: ["Askerveien 55, 1384 Asker"],
  deliveryAddress: "Vinterstien 12, 1364 Fornebu",
  productsSummary: "Washing machine x2",
  deliveryTypeSummary: "Delivery with carry-in x2",
  priceExVat: 4990,
  rabatt: null,
  leggTil: null,
  pricingSnapshot: null,
  websiteOrderKind: "WHITE_GOODS",
  events: [{ payload: { kind: "status_changed", fromStatus: "confirmed", toStatus: "active" }, createdAt: new Date("2026-10-12T08:30:00Z") }],
};

describe("listCustomerOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([row]);
  });

  it("only reads the account's own orders, with their status-change events", async () => {
    await listCustomerOrders("acc1");

    const query = mocks.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({ customerAccountId: "acc1" });
    expect(query.select.events.where).toEqual({ type: "STATUS_CHANGED" });
  });

  it("gives each order its route, what is delivered, when it was ordered and its progress", async () => {
    const [order] = await listCustomerOrders("acc1");

    expect(order).toMatchObject({
      orderNumber: "K7MQ4XZ2",
      createdAt,
      pickupAddress: "Conradisvei 6, 0260 Oslo",
      extraPickupCount: 1,
      deliveryAddress: "Vinterstien 12, 1364 Fornebu",
      productsSummary: "Washing machine x2",
      deliveryTypeSummary: "Delivery with carry-in x2",
      totalIncVatNok: 4990,
    });
    expect(order.progress.note).toBeNull();
    expect(order.progress.steps[3]).toEqual({ key: "onTheWay", state: "current", at: new Date("2026-10-12T08:30:00Z") });
  });

  it("ignores events that aren't readable status changes", async () => {
    mocks.findMany.mockResolvedValue([{ ...row, events: [{ payload: null, createdAt }, { payload: { kind: "status_changed" }, createdAt }] }]);

    const [order] = await listCustomerOrders("acc1");

    expect(order.progress.steps[3].at).toBeNull();
  });
});

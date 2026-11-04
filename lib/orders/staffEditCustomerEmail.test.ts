import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderFindFirst: vi.fn(),
  sendLifecycleEmailsForOrders: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { order: { findFirst: mocks.orderFindFirst } } }));
vi.mock("@/lib/orders/sendCustomerLifecycleEmail", () => ({ sendLifecycleEmailsForOrders: mocks.sendLifecycleEmailsForOrders }));

import { sendStaffEditCustomerEmail } from "./staffEditCustomerEmail";
import { buildOrderStateSnapshot } from "./paidOrderSnapshot";
import { formatKr } from "./orderChangeText";

// A plain order: 1 000 kr ex. VAT, then a 200 kr surcharge — 1 500 kr incl. VAT.
const saved = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  companyId: "c1",
  displayId: 1042,
  orderNumber: "583920",
  status: "confirmed",
  customerName: "Kari",
  customerLabel: null,
  statusNotes: null,
  actionToken: "tok",
  email: "kari@example.no",
  emailThreadToken: null,
  priceExVat: 1000,
  rabatt: null,
  leggTil: "200",
  pricingSnapshot: null,
  websiteOrderKind: null,
  websiteBookingDetails: null,
  pickupAddress: "Storgata 1",
  deliveryAddress: "Kirkegata 5",
  extraPickupAddress: [],
  deliveryDate: "2026-11-19",
  timeWindow: null,
  drivingDistance: null,
  ...over,
});

const before = buildOrderStateSnapshot({ ...saved(), leggTil: null });
const actor = { source: "USER", name: "Ola" } as never;
const send = (over: Partial<Parameters<typeof sendStaffEditCustomerEmail>[0]> = {}) =>
  sendStaffEditCustomerEmail({ orderId: "o1", companyId: "c1", before, actor, ...over });

describe("sendStaffEditCustomerEmail — the customer hears about a staff edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendLifecycleEmailsForOrders.mockResolvedValue({ sentCount: 1, failedOrderIds: [] });
  });

  it("emails what changed and the new total, worded as a change made by us", async () => {
    mocks.orderFindFirst.mockResolvedValue(saved());

    expect(await send()).toBe("sent");

    expect(mocks.sendLifecycleEmailsForOrders).toHaveBeenCalledWith({
      kind: "order_updated",
      actor,
      orders: [
        expect.objectContaining({
          id: "o1",
          email: "kari@example.no",
          orderUpdate: { changes: [`Lagt til: Tillegg (${formatKr(200, { signed: true })})`], totalIncVatNok: 1500, byStaff: true },
        }),
      ],
    });
  });

  it("lists changed stops and dates too", async () => {
    mocks.orderFindFirst.mockResolvedValue(saved({ leggTil: null, deliveryDate: "2026-11-20" }));

    await send();

    expect(mocks.sendLifecycleEmailsForOrders.mock.calls[0]![0].orders[0].orderUpdate.changes).toEqual(["Dato: 2026-11-19 → 2026-11-20"]);
  });

  it("sends nothing when the save changed nothing the customer sees", async () => {
    mocks.orderFindFirst.mockResolvedValue(saved({ leggTil: null }));
    expect(await send()).toBe("no_changes");
    expect(mocks.sendLifecycleEmailsForOrders).not.toHaveBeenCalled();
  });

  it("sends nothing without a customer email", async () => {
    mocks.orderFindFirst.mockResolvedValue(saved({ email: "  " }));
    expect(await send()).toBe("no_email");
    expect(mocks.sendLifecycleEmailsForOrders).not.toHaveBeenCalled();
  });

  it("reports a failed send (the save itself stands)", async () => {
    mocks.orderFindFirst.mockResolvedValue(saved());
    mocks.sendLifecycleEmailsForOrders.mockResolvedValue({ sentCount: 0, failedOrderIds: ["o1"] });
    expect(await send()).toBe("failed");
  });

  it("never throws — a broken email can't fail a save that already happened", async () => {
    mocks.orderFindFirst.mockRejectedValue(new Error("db down"));
    expect(await send()).toBe("failed");
  });
});

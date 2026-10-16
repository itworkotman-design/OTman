import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { order: { findMany: mocks.findMany } } }));

import { customerOrderDetails, listCustomerOrders, type CustomerOrder } from "./customerOrderView";

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
  // Stored ex. VAT; the customer pays 4990 incl. VAT.
  priceExVat: 3992,
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

describe("customerOrderDetails — a homepage move", () => {
  const apartment = { homeType: "APARTMENT", sizeOptionCode: "SIZE_UNDER_40", floors: 1, floorNumber: 1, hasLift: null, parking: "OUTSIDE" };
  const house = { homeType: "DETACHED", sizeOptionCode: "SIZE_UNDER_40", floors: 2, floorNumber: null, hasLift: null, parking: "OUTSIDE" };
  const move = {
    websiteOrderKind: "MOVING",
    websiteBookingDetails: { version: 1, customerType: "private", origin: apartment, destination: house, serviceCodes: ["SERVICE_FLYTTEVASK"] },
    pickupAddress: "Karl Johans gate 1, Oslo",
    deliveryAddress: "Bragernes torg 1, Drammen",
    customerName: "Kari",
    phone: "+47 12345678",
    email: "kari@example.com",
    customerComments: "Piano",
    deliveryDate: "2026-10-22",
    timeWindow: "10:00-16:00",
    status: "processing",
  } as unknown as CustomerOrder;

  it("gives the customer the whole move to edit, like a delivery order's stops", () => {
    expect(customerOrderDetails(move)).toEqual({
      kind: "moving",
      customer: { name: "Kari", phone: "+47 12345678", email: "kari@example.com", comments: "Piano" },
      preferredDate: "2026-10-22",
      timeWindow: "10:00-16:00",
      customerType: "private",
      moving: {
        pickupAddress: "Karl Johans gate 1, Oslo",
        deliveryAddress: "Bragernes torg 1, Drammen",
        origin: apartment,
        destination: house,
        serviceCodes: ["SERVICE_FLYTTEVASK"],
      },
    });
  });

  it("falls back to contact + date for a move booked before its answers were stored", () => {
    expect(customerOrderDetails({ ...move, websiteBookingDetails: null } as unknown as CustomerOrder).kind).toBe("basic");
  });
});

describe("customerOrderDetails — a homepage service request", () => {
  const request = {
    websiteOrderKind: "SERVICE",
    websiteBookingDetails: { version: 1, customerType: "business", serviceCode: "option-1", customService: "", jobDescription: "Install lights." },
    deliveryAddress: "Storgata 1, Oslo",
    customerName: "Kari",
    phone: "+47 12345678",
    email: "kari@example.com",
    customerComments: "test",
    deliveryDate: "2026-10-22",
    timeWindow: "08:00-16:00",
    status: "processing",
    // Staff's quote — never part of what the customer edits.
    items: [{ productCode: "SERVICE_QUOTE", optionCode: "QUOTE", optionLabel: "Electrician", quantity: 1, customerPriceCents: 400000, subcontractorPriceCents: 250000 }],
  } as unknown as CustomerOrder;

  it("gives the customer the service, the job and the address to edit — without the quote", () => {
    expect(customerOrderDetails(request)).toEqual({
      kind: "service",
      customer: { name: "Kari", phone: "+47 12345678", email: "kari@example.com", comments: "test" },
      preferredDate: "2026-10-22",
      timeWindow: "08:00-16:00",
      customerType: "business",
      service: { serviceCode: "option-1", customService: "", jobDescription: "Install lights.", address: "Storgata 1, Oslo" },
    });
  });

  it("falls back to contact + date for a request sent before its answers were stored", () => {
    expect(customerOrderDetails({ ...request, websiteBookingDetails: null } as unknown as CustomerOrder).kind).toBe("basic");
  });
});

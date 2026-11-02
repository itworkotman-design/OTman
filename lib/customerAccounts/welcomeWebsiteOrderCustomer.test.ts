import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureCustomerAccountForOrder: vi.fn(),
  sendOrderReceivedEmail: vi.fn(),
  createOrderNotification: vi.fn(),
  sendOrderInvoice: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("./ensureCustomerAccount", () => ({ ensureCustomerAccountForOrder: mocks.ensureCustomerAccountForOrder }));
vi.mock("@/lib/orders/sendOrderReceivedEmail", () => ({ sendOrderReceivedEmail: mocks.sendOrderReceivedEmail }));
vi.mock("@/lib/orders/orderNotifications", () => ({ createOrderNotification: mocks.createOrderNotification }));
vi.mock("@/lib/invoices/orderInvoices", () => ({ sendOrderInvoice: mocks.sendOrderInvoice }));

import { welcomeWebsiteOrderCustomer } from "./welcomeWebsiteOrderCustomer";

const order = {
  id: "o1",
  companyId: "c1",
  displayId: 42,
  orderNumber: "K7MQ4XZ2",
  customerName: "Ola",
  customerLabel: null,
  statusNotes: null,
  actionToken: null,
  email: "ola@example.com" as string | null,
  emailThreadToken: null,
};

describe("welcomeWebsiteOrderCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("creates the account, then sends ONE email with the username and the password in it", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue({ accountId: "a1", email: "ola@example.com", newPassword: "Abcdefgh2345" });

    await welcomeWebsiteOrderCustomer(order);

    expect(mocks.ensureCustomerAccountForOrder).toHaveBeenCalledWith({ orderId: "o1", email: "ola@example.com" });
    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ ...order, customerLogin: { email: "ola@example.com", password: "Abcdefgh2345" } }),
    );
  });

  it("sends no password to a returning customer who keeps theirs", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue({ accountId: "a1", email: "ola@example.com", newPassword: null });

    await welcomeWebsiteOrderCustomer(order);

    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ customerLogin: { email: "ola@example.com", password: null } }),
    );
  });

  it("passes the order details for the table at the end of the email", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue({ accountId: "a1", email: "ola@example.com", newPassword: null });

    await welcomeWebsiteOrderCustomer({
      ...order,
      deliveryDate: "2026-10-15",
      timeWindow: "10:00-16:00",
      phone: "+47 900 00 000",
      pickupAddress: "Elkjøp Lørenskog",
      extraPickupAddress: ["Power Alnabru"],
      deliveryAddress: "Storgata 1",
      returnAddress: null,
      floorNo: "3",
      lift: "Nei",
      productsSummary: "Washing machine",
      deliveryTypeSummary: "Delivery with carry-in",
      servicesSummary: "",
      customerComments: null,
      // Stored ex. VAT; the customer pays 4990 incl. VAT.
      priceExVat: 3992,
      rabatt: null,
      leggTil: null,
      pricingSnapshot: null,
      websiteOrderKind: "WHITE_GOODS",
    });

    expect(mocks.sendOrderReceivedEmail.mock.calls[0][0].orderDetails).toEqual({
      deliveryDate: "2026-10-15",
      timeWindow: "10:00-16:00",
      customerName: "Ola",
      phone: "+47 900 00 000",
      email: "ola@example.com",
      pickupAddress: "Elkjøp Lørenskog",
      extraPickupAddress: ["Power Alnabru"],
      deliveryAddress: "Storgata 1",
      returnAddress: null,
      floorNo: "3",
      lift: "Nei",
      productsSummary: "Washing machine",
      deliveryTypeSummary: "Delivery with carry-in",
      servicesSummary: "",
      customerComments: null,
      // A homepage order's priceExVat is already incl. VAT.
      totalIncVatNok: 4990,
    });
  });

  it("passes the booked pickup stops and delivery, with the order's current addresses on top", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue(null);
    const stop = { source: "private", placeName: "", floor: 3, liftAvailable: false, contactName: "Kari", contactPhone: "+47 911 11 111" };

    await welcomeWebsiteOrderCustomer({
      ...order,
      pickupAddress: "Changed 1, Oslo",
      extraPickupAddress: ["Bjerkeveien 4"],
      deliveryAddress: "Storgata 1",
      websiteBookingDetails: {
        version: 1,
        customerType: "private",
        pickups: [
          { ...stop, source: "store", placeName: "Elkjøp", floor: null, address: "Booked 1, Oslo" },
          { ...stop, address: "Bjerkeveien 4" },
        ],
        delivery: { address: "Storgata 1", floor: 5, liftAvailable: true },
        preferredDate: "2026-10-15",
        timeWindow: "10:00-16:00",
        drivingDistance: "21",
        orderExtras: [],
      },
    });

    const details = mocks.sendOrderReceivedEmail.mock.calls[0][0].orderDetails;
    expect(details.pickups).toHaveLength(2);
    expect(details.pickups[0]).toMatchObject({ source: "store", placeName: "Elkjøp", address: "Changed 1, Oslo" });
    expect(details.pickups[1]).toMatchObject({ floor: 3, contactName: "Kari" });
    expect(details.delivery).toEqual({ address: "Storgata 1", floor: 5, liftAvailable: true });
  });

  it("has no stops for an order without booking details (moving, special goods)", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue(null);

    await welcomeWebsiteOrderCustomer({ ...order, websiteBookingDetails: null });

    const details = mocks.sendOrderReceivedEmail.mock.calls[0][0].orderDetails;
    expect(details.pickups).toBeUndefined();
    expect(details.delivery).toBeUndefined();
  });

  it("gives an unpriced quote no total", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue(null);

    await welcomeWebsiteOrderCustomer({ ...order, priceExVat: 0 });

    expect(mocks.sendOrderReceivedEmail.mock.calls[0][0].orderDetails.totalIncVatNok).toBeNull();
  });

  it("still sends the order email (without login) when the account can't be created, and alerts staff", async () => {
    mocks.ensureCustomerAccountForOrder.mockRejectedValue(new Error("db down"));

    await welcomeWebsiteOrderCustomer(order);

    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith(expect.objectContaining(order));
    expect(mocks.sendOrderReceivedEmail.mock.calls[0][0].customerLogin).toBeUndefined();
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: "o1", type: "MANUAL_REVIEW" }),
    );
  });

  it("sends just the order email when there is no email to make an account for", async () => {
    mocks.ensureCustomerAccountForOrder.mockResolvedValue(null);

    await welcomeWebsiteOrderCustomer({ ...order, email: null });

    expect(mocks.sendOrderReceivedEmail).toHaveBeenCalledWith(expect.objectContaining({ ...order, email: null }));
    expect(mocks.createOrderNotification).not.toHaveBeenCalled();
  });
});

describe("welcomeWebsiteOrderCustomer — the first faktura (manual payments)", () => {
  const priced = { ...order, websiteOrderKind: "WHITE_GOODS", priceExVat: 1000, pricingSnapshot: null, rabatt: null, leggTil: null };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.HOMEPAGE_PAYMENT_MODE;
    mocks.ensureCustomerAccountForOrder.mockResolvedValue(null);
    mocks.sendOrderInvoice.mockResolvedValue({ ok: true });
  });

  it("sends the faktura for the whole order as soon as the customer has booked", async () => {
    await welcomeWebsiteOrderCustomer(priced);
    expect(mocks.sendOrderInvoice).toHaveBeenCalledWith({
      orderId: "o1",
      companyId: "c1",
      kind: "invoice",
      actor: { membershipId: null, name: "website", email: "website", source: "SYSTEM" },
    });
  });

  it("sends none for a request without a price yet — staff send it once quoted", async () => {
    await welcomeWebsiteOrderCustomer({ ...priced, websiteOrderKind: "SERVICE", priceExVat: 0 });
    expect(mocks.sendOrderInvoice).not.toHaveBeenCalled();
  });

  it("sends none for orders that aren't homepage orders, or while Stripe takes payment", async () => {
    await welcomeWebsiteOrderCustomer({ ...priced, websiteOrderKind: null });
    process.env.HOMEPAGE_PAYMENT_MODE = "stripe";
    await welcomeWebsiteOrderCustomer(priced);
    expect(mocks.sendOrderInvoice).not.toHaveBeenCalled();
  });

  it("alerts staff when the faktura couldn't be sent", async () => {
    mocks.sendOrderInvoice.mockResolvedValue({ ok: false, reason: "INVOICE_SEND_FAILED" });
    await welcomeWebsiteOrderCustomer(priced);
    expect(mocks.createOrderNotification).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ orderId: "o1", type: "MANUAL_REVIEW", title: "Faktura NOT sent" }),
    );
  });
});

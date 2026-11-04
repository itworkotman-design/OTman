import { describe, expect, it } from "vitest";
import { parseWhiteGoodsBookingDetails } from "@/lib/orders/websiteBookingDetails";
import {
  GDPR_REDACTED,
  isFinishedWebsiteOrderStatus,
  scrubBookingDetails,
  scrubEventPayload,
  scrubStateSnapshot,
} from "./websiteOrderScrub";

describe("isFinishedWebsiteOrderStatus — when a homepage order's 90 days start", () => {
  it("is completed, cancelled, declined (refunded) or rejected", () => {
    for (const status of ["completed", "cancelled", "refunded", "rejected"]) expect(isFinishedWebsiteOrderStatus(status)).toBe(true);
  });

  it("is never an order still in progress", () => {
    for (const status of ["processing", "confirmed", "active", "failed", null]) expect(isFinishedWebsiteOrderStatus(status)).toBe(false);
  });
});

describe("scrubBookingDetails — the homepage booking's stored answers", () => {
  const booked = {
    version: 1,
    customerType: "business",
    orgNumber: "912345678",
    pickups: [
      { source: "private", placeName: "Ola Hansen", address: "Bjerkeveien 2", floor: 1, liftAvailable: false, contactName: "Ola", contactPhone: "+4799999999", productNames: ["Vaskemaskin"] },
    ],
    delivery: { address: "Kirkegata 5", floor: 3, liftAvailable: true },
    comment: "Ring meg på 99999999",
    orderExtras: [{ label: "Per km", qty: 27, price: 864 }],
    services: [{ serviceCode: "CUSTOM", customService: "Henge hyller", jobDescription: "Hjemme hos Kari i Storgata 1" }],
  };

  it("blanks addresses, names, phones, comments and free text — keeps products, floors, prices and choices", () => {
    expect(scrubBookingDetails(booked)).toEqual({
      version: 1,
      customerType: "business",
      orgNumber: "",
      pickups: [{ source: "private", placeName: "", address: "", floor: 1, liftAvailable: false, contactName: "", contactPhone: "", productNames: ["Vaskemaskin"] }],
      delivery: { address: "", floor: 3, liftAvailable: true },
      comment: "",
      orderExtras: [{ label: "Per km", qty: 27, price: 864 }],
      services: [{ serviceCode: "CUSTOM", customService: "Henge hyller", jobDescription: "" }],
    });
  });

  it("leaves nothing or non-objects alone", () => {
    expect(scrubBookingDetails(null)).toBeNull();
    expect(scrubBookingDetails("x")).toBe("x");
  });

  it("still parses afterwards, so the anonymized order keeps opening in the dashboard", () => {
    const real = {
      version: 1,
      customerType: "private",
      pickups: [{ source: "store", placeName: "Power", address: "Strømmen 1", floor: null, liftAvailable: false, contactName: "", contactPhone: "", productNames: [] }],
      delivery: { address: "Kirkegata 5", floor: 3, liftAvailable: true },
    };
    expect(parseWhiteGoodsBookingDetails(real)).not.toBeNull();
    expect(parseWhiteGoodsBookingDetails(scrubBookingDetails(real))).not.toBeNull();
  });
});

describe("scrubStateSnapshot — what a payment/refund recorded about the order", () => {
  it("blanks stop addresses, place names and contacts — keeps lines, totals, floors and dates", () => {
    const snapshot = {
      version: 1,
      totalIncVatNok: 1250,
      lines: [{ key: "TV::Setup", group: "TV", label: "Setup", qty: 1, price: 1250 }],
      details: [
        { key: "pickup.1.address", value: "Bjerkeveien 2" },
        { key: "pickup.1.place", value: "Ola Hansen" },
        { key: "pickup.1.contact", value: "Ola, 99999999" },
        { key: "pickup.1.floor", value: "1" },
        { key: "delivery.address", value: "Kirkegata 5" },
        { key: "date", value: "2026-11-19" },
      ],
    };
    expect(scrubStateSnapshot(snapshot)).toEqual({
      ...snapshot,
      details: [
        { key: "pickup.1.address", value: "" },
        { key: "pickup.1.place", value: "" },
        { key: "pickup.1.contact", value: "" },
        { key: "pickup.1.floor", value: "1" },
        { key: "delivery.address", value: "" },
        { key: "date", value: "2026-11-19" },
      ],
    });
  });

  it("leaves a missing snapshot alone", () => {
    expect(scrubStateSnapshot(null)).toBeNull();
  });
});

describe("scrubEventPayload — the order history", () => {
  it("redacts personal fields' before/after in an update, keeps the rest", () => {
    const payload = {
      kind: "updated",
      changes: [
        { field: "phone", label: "Phone", previousValue: "+4711111111", nextValue: "+4722222222" },
        { field: "deliveryAddress", label: "Delivery address", previousValue: "A", nextValue: "B" },
        { field: "priceExVat", label: "Price (ex VAT)", previousValue: "1000", nextValue: "1200" },
      ],
      productChanges: [{ productName: "TV" }],
    };
    expect(scrubEventPayload(payload)).toEqual({
      kind: "updated",
      changes: [
        { field: "phone", label: "Phone", previousValue: GDPR_REDACTED, nextValue: GDPR_REDACTED },
        { field: "deliveryAddress", label: "Delivery address", previousValue: GDPR_REDACTED, nextValue: GDPR_REDACTED },
        { field: "priceExVat", label: "Price (ex VAT)", previousValue: "1000", nextValue: "1200" },
      ],
      productChanges: [{ productName: "TV" }],
    });
  });

  it("redacts an action's detail lines (they can quote addresses) but keeps its title", () => {
    expect(scrubEventPayload({ kind: "action", title: "Refunded 250 kr", details: ["Leveringsadresse: A → B"] })).toEqual({
      kind: "action",
      title: "Refunded 250 kr",
      details: [GDPR_REDACTED],
    });
  });

  it("redacts a status change's note (a decline reason can name the customer)", () => {
    expect(scrubEventPayload({ kind: "status_changed", fromStatus: "confirmed", toStatus: "refunded", note: "Kari ville ikke" })).toEqual({
      kind: "status_changed",
      fromStatus: "confirmed",
      toStatus: "refunded",
      note: GDPR_REDACTED,
    });
  });

  it("clears personal fields in the snapshot taken when the order was created", () => {
    const scrubbed = scrubEventPayload({
      kind: "created",
      snapshot: { displayId: 20044, customerName: "Kari", phone: "+47", email: "k@x.no", deliveryAddress: "A", pickupAddress: "B", extraPickupAddress: ["C"], productsSummary: "TV", priceExVat: 1000 },
    }) as { snapshot: Record<string, unknown> };
    expect(scrubbed.snapshot).toEqual({
      displayId: 20044,
      customerName: null,
      phone: null,
      email: null,
      deliveryAddress: null,
      pickupAddress: null,
      extraPickupAddress: [],
      productsSummary: "TV",
      priceExVat: 1000,
    });
  });

  it("leaves other events alone", () => {
    const gdpr = { kind: "gdpr", fields: ["phone"] };
    expect(scrubEventPayload(gdpr)).toEqual(gdpr);
  });
});

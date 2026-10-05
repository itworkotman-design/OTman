import { describe, expect, it } from "vitest";
import {
  buildOrderStateSnapshot,
  compareOrderWithPayments,
  parseOrderStateSnapshot,
  type OrderStateSnapshot,
} from "./paidOrderSnapshot";

const details = {
  version: 1,
  customerType: "private",
  pickups: [
    {
      source: "store",
      placeName: "Power",
      address: "Strømmen 1",
      floor: null,
      liftAvailable: false,
      contactName: "Ola",
      contactPhone: "12345678",
    },
  ],
  delivery: { address: "Kirkegata 5", floor: 3, liftAvailable: false },
  preferredDate: "2026-10-10",
  timeWindow: "08:00-16:00",
  drivingDistance: "21",
  orderExtras: [{ label: "Etasjetillegg", price: 200, qty: 1 }],
};

const line = (cardId: number, productName: string, optionLabel: string, total: number, quantity = 1) => ({
  cardId,
  productCode: "X",
  productName,
  deliveryType: "INSIDE",
  itemType: "BASE_OPTION",
  optionCode: optionLabel,
  optionLabel,
  quantity,
  customerUnitPrice: total / quantity,
  customerLineTotal: total,
  subcontractorUnitPrice: null,
  subcontractorLineTotal: null,
});

function order(overrides: Record<string, unknown> = {}) {
  return {
    priceExVat: 1099,
    rabatt: null,
    leggTil: null,
    websiteOrderKind: "WHITE_GOODS",
    pricingSnapshot: {
      customer: { totalExVat: 1099, totalIncVat: 1373.75 },
      lines: [line(0, "Vaskemaskin", "Levering med innbæring", 899)],
    },
    websiteBookingDetails: details,
    pickupAddress: "Strømmen 1",
    deliveryAddress: "Kirkegata 5",
    extraPickupAddress: [],
    deliveryDate: "2026-10-10",
    timeWindow: "08:00-16:00",
    drivingDistance: "21",
    ...overrides,
  };
}

describe("buildOrderStateSnapshot", () => {
  it("records the charged total, every priced line and the stops/date", () => {
    const snapshot = buildOrderStateSnapshot(order());
    expect(snapshot.version).toBe(1);
    // Homepage order: the VAT-inclusive client total, not +25%.
    expect(snapshot.totalIncVatNok).toBe(1099);
    expect(snapshot.lines).toEqual([
      { key: "Vaskemaskin::Levering med innbæring", group: "Vaskemaskin", label: "Levering med innbæring", qty: 1, price: 899 },
      { key: "extras::Etasjetillegg", group: "extras", label: "Etasjetillegg", qty: 1, price: 200 },
    ]);
    expect(snapshot.details).toEqual(
      expect.arrayContaining([
        { key: "pickup.1.address", value: "Strømmen 1" },
        { key: "delivery.address", value: "Kirkegata 5" },
        { key: "delivery.floor", value: "3" },
        { key: "delivery.lift", value: "no" },
        { key: "date", value: "2026-10-10" },
        { key: "timeWindow", value: "08:00-16:00" },
        { key: "distance", value: "21" },
      ]),
    );
  });

  it("adds manual discount / surcharge as their own lines so the lines add up", () => {
    const snapshot = buildOrderStateSnapshot(order({ rabatt: "100", leggTil: "50" }));
    expect(snapshot.lines).toEqual(
      expect.arrayContaining([
        { key: "adjustment::discount", group: "adjustment", label: "discount", qty: 1, price: -100 },
        { key: "adjustment::surcharge", group: "adjustment", label: "surcharge", qty: 1, price: 50 },
      ]),
    );
  });

  it("round-trips through parseOrderStateSnapshot, rejecting anything malformed", () => {
    const snapshot = buildOrderStateSnapshot(order());
    expect(parseOrderStateSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
    expect(parseOrderStateSnapshot(null)).toBeNull();
    expect(parseOrderStateSnapshot({ version: 2 })).toBeNull();
    expect(parseOrderStateSnapshot({ version: 1, totalIncVatNok: "x", lines: [], details: [] })).toBeNull();
  });
});

describe("compareOrderWithPayments", () => {
  const paidSnapshot: OrderStateSnapshot = buildOrderStateSnapshot(order());
  const payment = (cents: number, snapshot: OrderStateSnapshot | null, at = "2026-10-03T10:00:00Z") => ({
    amountChargedCents: cents,
    createdAt: new Date(at),
    orderSnapshot: snapshot,
  });

  it("is 'unpaid' with no payments, owing the whole total", () => {
    const result = compareOrderWithPayments({ payments: [], current: paidSnapshot });
    expect(result).toMatchObject({
      outcome: "unpaid",
      totalPaidIncVatNok: 0,
      currentTotalIncVatNok: 1099,
      differenceIncVatNok: 1099,
      lineChanges: [],
      detailChanges: [],
    });
  });

  it("is 'settled' when the current order is what was paid", () => {
    const result = compareOrderWithPayments({ payments: [payment(109900, paidSnapshot)], current: paidSnapshot });
    expect(result).toMatchObject({ outcome: "settled", differenceIncVatNok: 0, hasPaidSnapshot: true });
    expect(result.lineChanges).toEqual([]);
  });

  it("lists added, removed and changed lines and the amount due", () => {
    const current = buildOrderStateSnapshot(
      order({
        priceExVat: 1749,
        pricingSnapshot: {
          customer: { totalExVat: 1749 },
          lines: [
            line(0, "Vaskemaskin", "Levering med innbæring", 999),
            line(1, "Tørketrommel", "Levering på dørstokken", 550),
          ],
        },
        websiteBookingDetails: { ...details, orderExtras: [] },
      }),
    );
    const result = compareOrderWithPayments({ payments: [payment(109900, paidSnapshot)], current });

    expect(result.outcome).toBe("due");
    expect(result.totalPaidIncVatNok).toBe(1099);
    expect(result.currentTotalIncVatNok).toBe(1749);
    expect(result.differenceIncVatNok).toBe(650);
    expect(result.lineChanges).toEqual([
      {
        kind: "changed",
        group: "Vaskemaskin",
        label: "Levering med innbæring",
        qtyBefore: 1,
        qtyAfter: 1,
        priceBefore: 899,
        priceAfter: 999,
        delta: 100,
      },
      {
        kind: "removed",
        group: "extras",
        label: "Etasjetillegg",
        qtyBefore: 1,
        qtyAfter: 0,
        priceBefore: 200,
        priceAfter: 0,
        delta: -200,
      },
      {
        kind: "added",
        group: "Tørketrommel",
        label: "Levering på dørstokken",
        qtyBefore: 0,
        qtyAfter: 1,
        priceBefore: 0,
        priceAfter: 550,
        delta: 550,
      },
    ]);
  });

  it("lists changed addresses, floors and dates", () => {
    const current = buildOrderStateSnapshot(
      order({
        deliveryAddress: "Storgata 1",
        deliveryDate: "2026-10-12",
        websiteBookingDetails: { ...details, delivery: { address: "Storgata 1", floor: 1, liftAvailable: true } },
      }),
    );
    const result = compareOrderWithPayments({ payments: [payment(109900, paidSnapshot)], current });
    expect(result.detailChanges).toEqual(
      expect.arrayContaining([
        { key: "delivery.address", before: "Kirkegata 5", after: "Storgata 1" },
        { key: "delivery.floor", before: "3", after: "1" },
        { key: "delivery.lift", before: "no", after: "yes" },
        { key: "date", before: "2026-10-10", after: "2026-10-12" },
      ]),
    );
    expect(result.detailChanges).toHaveLength(4);
  });

  it("flags a refund when the order now costs less than was paid", () => {
    const current = buildOrderStateSnapshot(order({ priceExVat: 899, pricingSnapshot: { customer: { totalExVat: 899 }, lines: [] } }));
    const result = compareOrderWithPayments({ payments: [payment(109900, paidSnapshot)], current });
    expect(result).toMatchObject({ outcome: "refund", differenceIncVatNok: -200 });
  });

  it("sums every payment, comparing against the latest one's snapshot", () => {
    const later = buildOrderStateSnapshot(
      order({ priceExVat: 1749, pricingSnapshot: { customer: { totalExVat: 1749 }, lines: [] } }),
    );
    const result = compareOrderWithPayments({
      payments: [payment(65000, later, "2026-10-04T10:00:00Z"), payment(109900, paidSnapshot, "2026-10-03T10:00:00Z")],
      current: later,
    });
    expect(result).toMatchObject({
      outcome: "settled",
      totalPaidIncVatNok: 1749,
      paidSnapshotTotalIncVatNok: 1749,
      paidAt: "2026-10-04T10:00:00.000Z",
    });
  });

  it("still gives the money outcome for payments made before snapshots existed", () => {
    const result = compareOrderWithPayments({ payments: [payment(100000, null)], current: paidSnapshot });
    expect(result).toMatchObject({
      hasPaidSnapshot: false,
      outcome: "due",
      differenceIncVatNok: 99,
      lineChanges: [],
      detailChanges: [],
    });
  });
});

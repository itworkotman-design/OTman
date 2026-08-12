// Guards the invariant behind both the archive table and the order editor
// modal: they must always display the same price/discount numbers for a
// given order, because both are meant to read the *same persisted
// pricingSnapshot* rather than deriving their own answer independently.
//
// - The archive table reads `getEffectiveArchive*Total`, which prefers
//   `pricingSnapshot.customer.totalExVat` / `pricingSnapshot.subcontractor.total`
//   (lib/booking/archiveColumns.ts).
// - The order editor modal loads `priceExVat`/`priceSubcontractor` directly
//   from the Order row (app/api/orders/[orderId]/route.ts GET) as its
//   "Total" — and the PATCH route always sets those same columns to
//   `buildOrderPricingSnapshot(...).customer.totalExVat` /
//   `.subcontractor.total` on every save.
//
// These tests build fixtures the way the PATCH route actually would (a
// snapshot produced by buildOrderPricingSnapshot, with priceExVat/
// priceSubcontractor columns set to that same snapshot's totals) and assert
// the two independent read paths agree — and stay stable across a
// no-op "open, don't touch anything, save" cycle.
import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/app/_components/Dahsboard/booking/archive/types";
import {
  getEffectiveArchiveCustomerTotal,
  getEffectiveArchiveSubcontractorTotal,
} from "@/lib/booking/archiveColumns";
import { buildOrderPricingSnapshot } from "@/lib/orders/orderTotals";

function buildOrderRow(overrides?: Partial<OrderRow>): OrderRow {
  return {
    id: "order-1",
    displayId: 1,
    status: "processing",
    statusNotes: "",
    deliveryDate: "2026-05-07",
    timeWindow: "10:00-16:00",
    drivingDistance: "",
    customerName: "Customer",
    customerLabel: "Customer",
    orderNumber: "A-1",
    phone: "",
    email: "",
    floorNo: "",
    lift: "",
    pickupAddress: "",
    extraPickupAddress: [],
    deliveryAddress: "",
    orderSummaryGroups: [],
    orderSummaryText: "",
    productsSummary: "",
    deliveryTypeSummary: "",
    servicesSummary: "",
    description: "",
    cashierName: "",
    cashierPhone: "",
    customerComments: "",
    driverInfo: "",
    subcontractorMembershipId: "",
    driver: "",
    createdAt: "2026-05-07T10:00:00.000Z",
    updatedAt: "2026-05-07T10:00:00.000Z",
    lastInboundEmailAt: null,
    lastOutboundEmailAt: null,
    needsEmailAttention: false,
    unreadInboundEmailCount: 0,
    lastNotificationAt: null,
    needsNotificationAttention: false,
    unreadNotificationCount: 0,
    priceExVat: 0,
    priceSubcontractor: 0,
    pricingSnapshot: null,
    rabatt: "",
    dnbDiscount: false,
    leggTil: "",
    subcontractorMinus: "",
    subcontractorPlus: "",
    calculatorItems: [],
    customerMembershipId: "",
    createdByEmail: "",
    createdByName: "",
    createdBy: "",
    lastEditedBy: "",
    subcontractor: "",
    ...overrides,
  };
}

// Mirrors app/api/orders/[orderId]/route.ts PATCH: it always writes
// priceExVat/priceSubcontractor as the freshly built snapshot's own totals.
function buildSavedOrderRow(params: {
  lines: Parameters<typeof buildOrderPricingSnapshot>[0]["lines"];
  rabatt: string;
  leggTil: string;
  subcontractorMinus: string;
  subcontractorPlus: string;
  overrides?: Partial<OrderRow>;
}) {
  const snapshot = buildOrderPricingSnapshot({
    lines: params.lines,
    rabatt: params.rabatt,
    leggTil: params.leggTil,
    subcontractorMinus: params.subcontractorMinus,
    subcontractorPlus: params.subcontractorPlus,
  });

  const row = buildOrderRow({
    priceExVat: snapshot.customer.totalExVat,
    priceSubcontractor: snapshot.subcontractor.total,
    pricingSnapshot: snapshot,
    rabatt: params.rabatt,
    leggTil: params.leggTil,
    subcontractorMinus: params.subcontractorMinus,
    subcontractorPlus: params.subcontractorPlus,
    ...params.overrides,
  });

  return { snapshot, row };
}

describe("archive table vs. order editor modal: same snapshot, same numbers", () => {
  it("archive customer/subcontractor totals equal the priceExVat/priceSubcontractor columns the modal loads", () => {
    const { row } = buildSavedOrderRow({
      lines: [{ quantity: 1, customerPriceCents: 450, subcontractorPriceCents: 300 }],
      rabatt: "",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "",
    });

    expect(getEffectiveArchiveCustomerTotal(row)).toBe(row.priceExVat);
    expect(getEffectiveArchiveSubcontractorTotal(row)).toBe(row.priceSubcontractor);
  });

  it("stays consistent when a manually entered subcontractorMinus doesn't match any discount ratio", () => {
    // Real bug scenario: rabatt="610" (customer discount), but
    // subcontractorMinus="5500" was set directly to pay the subcontractor
    // nothing — not the proportional (610/8110 * 5500 ≈ 414) value a ratio
    // formula would derive. buildOrderPricingSnapshot must take
    // subcontractorMinus at face value, and the archive table must show
    // exactly what that produced.
    const { row, snapshot } = buildSavedOrderRow({
      lines: [{ quantity: 1, customerPriceCents: 811000, subcontractorPriceCents: 550000 }],
      rabatt: "610",
      leggTil: "",
      subcontractorMinus: "5500",
      subcontractorPlus: "",
    });

    expect(snapshot.subcontractor.total).toBe(0);
    expect(row.priceSubcontractor).toBe(0);
    expect(getEffectiveArchiveSubcontractorTotal(row)).toBe(0);
    expect(getEffectiveArchiveCustomerTotal(row)).toBe(row.priceExVat);
  });

  it("re-saving an order unchanged (open, don't touch anything, submit) reproduces identical totals", () => {
    // The general, data-layer form of "archive and modal must always show
    // the same data forever": if the modal loads the persisted
    // rabatt/leggTil/subcontractorMinus/subcontractorPlus and the persisted
    // priceExVat/priceSubcontractor totals, and resubmits them completely
    // untouched, the resulting snapshot must be identical — never silently
    // drifting to a recomputed value.
    const { row: savedRow } = buildSavedOrderRow({
      lines: [{ quantity: 1, customerPriceCents: 811000, subcontractorPriceCents: 550000 }],
      rabatt: "610",
      leggTil: "",
      subcontractorMinus: "5500",
      subcontractorPlus: "",
    });

    const resavedSnapshot = buildOrderPricingSnapshot({
      lines: [{ quantity: 1, customerPriceCents: 811000, subcontractorPriceCents: 550000 }],
      rabatt: savedRow.rabatt,
      leggTil: savedRow.leggTil,
      subcontractorMinus: savedRow.subcontractorMinus,
      subcontractorPlus: savedRow.subcontractorPlus,
      fallbackCustomerTotalExVat: savedRow.priceExVat,
      fallbackSubcontractorTotal: savedRow.priceSubcontractor,
    });

    expect(resavedSnapshot.customer.totalExVat).toBe(savedRow.priceExVat);
    expect(resavedSnapshot.subcontractor.total).toBe(savedRow.priceSubcontractor);
  });

  it("archive total reflects an updated subcontractorPlus the same way a resave would", () => {
    const { row } = buildSavedOrderRow({
      lines: [{ quantity: 1, customerPriceCents: 100000, subcontractorPriceCents: 60000 }],
      rabatt: "",
      leggTil: "",
      subcontractorMinus: "",
      subcontractorPlus: "150",
    });

    expect(row.priceSubcontractor).toBe(750);
    expect(getEffectiveArchiveSubcontractorTotal(row)).toBe(750);
  });

  it("legacy rows without a stored pricingSnapshot fall back to deriving from the raw columns (archive-only path)", () => {
    // Orders saved before pricingSnapshot existed (or any row where it's
    // null) don't have a snapshot for the archive table to prefer, so it
    // derives the total from priceExVat/rabatt/leggTil directly. This is
    // the one legitimate case where archive and modal reach the number via
    // different code paths — worth pinning down explicitly so a future
    // change doesn't accidentally make it silently return the wrong value
    // instead of falling back.
    const row = buildOrderRow({
      pricingSnapshot: null,
      priceExVat: 1000,
      rabatt: "100",
      leggTil: "",
    });

    expect(getEffectiveArchiveCustomerTotal(row)).toBe(900);
  });
});

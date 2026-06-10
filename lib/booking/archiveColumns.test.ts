import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/app/_components/Dahsboard/booking/archive/types";
import {
  getEffectiveArchiveCustomerTotal,
  getEffectiveArchiveSubcontractorTotal,
  getBookingArchiveColumns,
  sanitizeVisibleBookingArchiveColumns,
} from "@/lib/booking/archiveColumns";

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
    priceExVat: 1234,
    priceSubcontractor: 567,
    pricingSnapshot: null,
    rabatt: "",
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

describe("sanitizeVisibleBookingArchiveColumns", () => {
  it("migrates legacy summary column ids to the grouped order summary column", () => {
    expect(
      sanitizeVisibleBookingArchiveColumns("ADMIN", [
        "displayId",
        "productsSummary",
        "deliveryTypeSummary",
        "description",
      ]),
    ).toEqual(["displayId", "orderSummary", "description"]);
  });

  it("restores the VAT column when subcontractor price is visible for admins", () => {
    expect(
      sanitizeVisibleBookingArchiveColumns("ADMIN", [
        "displayId",
        "priceSubcontractor",
      ]),
    ).toEqual([
      "displayId",
      "priceExVat",
      "priceSubcontractor",
    ]);
  });

  it("keeps only valid column ids for admin rows without legacy summary columns", () => {
    expect(
      sanitizeVisibleBookingArchiveColumns("ADMIN", [
        "displayId",
        "description",
      ]),
    ).toEqual(["displayId", "description"]);
  });

  it("migrates the legacy admin customer-name column to the creator column", () => {
    expect(
      sanitizeVisibleBookingArchiveColumns("ADMIN", [
        "displayId",
        "customerName",
        "description",
      ]),
    ).toEqual(["displayId", "createdBy", "description"]);
  });

  it("uses subcontractor price instead of full order price for subcontractor rows", () => {
    const columnIds = getBookingArchiveColumns("SUBCONTRACTOR").map(
      (column) => column.id,
    );

    expect(columnIds).toContain("priceSubcontractor");
    expect(columnIds).not.toContain("priceExVat");
  });

  it("exports admin prices as numbers without NOK text", () => {
    const row = buildOrderRow();
    const columns = getBookingArchiveColumns("ADMIN");
    const priceExVat = columns.find((column) => column.id === "priceExVat");
    const priceSubcontractor = columns.find(
      (column) => column.id === "priceSubcontractor",
    );

    expect(priceExVat?.getExportValue?.(row)).toBe(1234);
    expect(priceSubcontractor?.getExportValue?.(row)).toBe(567);
  });

  it("exports order-creator prices as numbers without NOK text", () => {
    const row = buildOrderRow({ priceExVat: 987 });
    const priceExVat = getBookingArchiveColumns("ORDER_CREATOR").find(
      (column) => column.id === "priceExVat",
    );

    expect(priceExVat?.getExportValue?.(row)).toBe(987);
  });

  it("calculates effective customer total from discount and add-on adjustments", () => {
    const row = buildOrderRow({
      priceExVat: 1234,
      rabatt: "1234",
      leggTil: "",
    });
    const adminPriceExVat = getBookingArchiveColumns("ADMIN").find(
      (column) => column.id === "priceExVat",
    );

    expect(getEffectiveArchiveCustomerTotal(row)).toBe(0);
    expect(adminPriceExVat?.getExportValue?.(row)).toBe(0);
    expect(getEffectiveArchiveCustomerTotal({
      ...row,
      rabatt: "100",
      leggTil: "25,50",
    })).toBe(1159.5);
  });

  it("uses saved pricing snapshot totals when present", () => {
    const row = buildOrderRow({
      priceExVat: 0,
      priceSubcontractor: 0,
      rabatt: "1519",
      subcontractorMinus: "500",
      pricingSnapshot: {
        version: 1,
        customer: {
          subtotalExVat: 1819,
          discount: 1519,
          extra: 0,
          totalExVat: 300,
          vat: 75,
          totalIncVat: 375,
        },
        subcontractor: {
          subtotal: 900,
          minus: 0,
          plus: 0,
          total: 900,
        },
        lines: [],
      },
    });

    expect(getEffectiveArchiveCustomerTotal(row)).toBe(300);
    expect(getEffectiveArchiveSubcontractorTotal(row)).toBe(900);
  });

  it("derives zero archive customer total for cancelled rows without a stored discount", () => {
    expect(getEffectiveArchiveCustomerTotal(buildOrderRow({
      status: "cancelled",
      priceExVat: 1234,
      rabatt: "",
      leggTil: "",
    }))).toBe(0);
  });

  it("keeps protected cancelled fee lines visible when no discount is stored", () => {
    expect(getEffectiveArchiveCustomerTotal(buildOrderRow({
      status: "cancelled",
      priceExVat: 1234,
      rabatt: "",
      leggTil: "",
      calculatorItems: [
        {
          cardId: 1,
          productCode: "",
          productName: "Order extras",
          productModelNumber: "",
          deliveryType: "",
          itemType: "EXTRA_OPTION",
          optionCode: "CANCELED",
          optionLabel: "Deviation, dead end; Customer cancelled",
          quantity: 1,
          customerPriceCents: 59000,
          subcontractorPriceCents: 14900,
        },
        {
          cardId: 1,
          productCode: "",
          productName: "Delivery",
          productModelNumber: "",
          deliveryType: "",
          itemType: "EXTRA_OPTION",
          optionCode: "DELIVERY",
          optionLabel: "Delivery",
          quantity: 1,
          customerPriceCents: 64400,
          subcontractorPriceCents: 30000,
        },
      ],
    }))).toBe(590);
  });

  it("does not show negative customer totals for cancelled rows with zeroed stored price and a discount", () => {
    expect(getEffectiveArchiveCustomerTotal(buildOrderRow({
      status: "cancelled",
      priceExVat: 0,
      rabatt: "919",
      leggTil: "",
    }))).toBe(0);
  });

  it("calculates effective subcontractor total from minus and plus adjustments", () => {
    const row = buildOrderRow({
      priceSubcontractor: 567,
      subcontractorMinus: "500",
      subcontractorPlus: "25,50",
    });
    const adminPriceSubcontractor = getBookingArchiveColumns("ADMIN").find(
      (column) => column.id === "priceSubcontractor",
    );

    expect(getEffectiveArchiveSubcontractorTotal(row)).toBe(92.5);
    expect(adminPriceSubcontractor?.getExportValue?.(row)).toBe(92.5);
  });

  it("derives zero archive subcontractor total for cancelled rows without a stored minus", () => {
    expect(getEffectiveArchiveSubcontractorTotal(buildOrderRow({
      status: "cancelled",
      priceSubcontractor: 567,
      subcontractorMinus: "",
      subcontractorPlus: "",
    }))).toBe(0);
  });

  it("keeps protected cancelled subcontractor fee lines visible when no minus is stored", () => {
    expect(getEffectiveArchiveSubcontractorTotal(buildOrderRow({
      status: "cancelled",
      priceSubcontractor: 567,
      subcontractorMinus: "",
      subcontractorPlus: "",
      calculatorItems: [
        {
          cardId: 1,
          productCode: "",
          productName: "Order extras",
          productModelNumber: "",
          deliveryType: "",
          itemType: "EXTRA_OPTION",
          optionCode: "CANCELED",
          optionLabel: "Deviation, dead end; Customer cancelled",
          quantity: 1,
          customerPriceCents: 59000,
          subcontractorPriceCents: 14900,
        },
        {
          cardId: 1,
          productCode: "",
          productName: "Delivery",
          productModelNumber: "",
          deliveryType: "",
          itemType: "EXTRA_OPTION",
          optionCode: "DELIVERY",
          optionLabel: "Delivery",
          quantity: 1,
          customerPriceCents: 64400,
          subcontractorPriceCents: 30000,
        },
      ],
    }))).toBe(149);
  });

  it("does not show negative subcontractor totals for cancelled rows with zeroed stored price and a minus", () => {
    expect(getEffectiveArchiveSubcontractorTotal(buildOrderRow({
      status: "cancelled",
      priceSubcontractor: 0,
      subcontractorMinus: "600",
      subcontractorPlus: "",
    }))).toBe(0);
  });
});

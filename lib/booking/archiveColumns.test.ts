import { describe, expect, it } from "vitest";
import type { OrderRow } from "@/app/_components/Dahsboard/booking/archive/types";
import {
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
      "orderSummary",
      "priceExVat",
      "priceSubcontractor",
    ]);
  });

  it("always keeps the grouped products column visible for admin rows", () => {
    expect(
      sanitizeVisibleBookingArchiveColumns("ADMIN", [
        "displayId",
        "description",
      ]),
    ).toEqual(["displayId", "orderSummary", "description"]);
  });

  it("migrates the legacy admin customer-name column to the creator column", () => {
    expect(
      sanitizeVisibleBookingArchiveColumns("ADMIN", [
        "displayId",
        "customerName",
        "description",
      ]),
    ).toEqual(["displayId", "createdBy", "orderSummary", "description"]);
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
});

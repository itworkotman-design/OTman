import { describe, expect, it } from "vitest";
import { sanitizeVisibleBookingArchiveColumns } from "@/lib/booking/archiveColumns";

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
});

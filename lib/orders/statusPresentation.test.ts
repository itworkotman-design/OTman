import { describe, expect, it } from "vitest";

import { bookingStatusText } from "@/lib/booking/bookingUiText";
import {
  ORDER_STATUS_OPTIONS,
  getOrderStatusStyle,
  normalizeOrderStatus,
} from "@/lib/orders/statusPresentation";

describe("pending order status", () => {
  it("is offered as the first status option", () => {
    expect(ORDER_STATUS_OPTIONS[0]).toBe("pending");
  });

  it("normalizes Norwegian spellings to pending", () => {
    expect(normalizeOrderStatus("pending")).toBe("pending");
    expect(normalizeOrderStatus("Venter")).toBe("pending");
    expect(normalizeOrderStatus("avventer")).toBe("pending");
    expect(normalizeOrderStatus("På vent")).toBe("pending");
  });

  it("has its own badge style", () => {
    expect(getOrderStatusStyle("pending")).toEqual({
      color: "#be185d",
      backgroundColor: "#fce7f3",
    });
  });

  it("has a Norwegian label", () => {
    expect(bookingStatusText("nb", "pending")).toBe("På vent");
  });
});

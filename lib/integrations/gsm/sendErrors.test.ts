import { describe, expect, it } from "vitest";
import {
  GsmApiError,
  GsmOrderValidationError,
  describeGsmSendError,
  describeGsmSendReason,
  formatGsmSendFailures,
} from "@/lib/integrations/gsm/sendErrors";

describe("describeGsmSendError", () => {
  it("passes validation messages through", () => {
    expect(describeGsmSendError(new GsmOrderValidationError("Bad window"))).toBe("Bad window");
  });

  it("flattens GSM per-task field errors and names the stop", () => {
    const error = new GsmApiError(400, "/orders/", {
      tasks_data: [{}, { complete_before: ["Must be later than complete_after."] }],
    });

    expect(describeGsmSendError(error, { taskCategories: ["pick_up", "assignment"] })).toBe(
      "GSM rejected the order (400): stop 2 (delivery) › time window end: Must be later than complete_after.",
    );
  });

  it("explains auth, rate limit and outage statuses", () => {
    expect(describeGsmSendError(new GsmApiError(401, "/orders/", { detail: "Invalid token." }))).toMatch(/API key/);
    expect(describeGsmSendError(new GsmApiError(429, "/orders/", null))).toMatch(/rate-limiting/);
    expect(describeGsmSendError(new GsmApiError(502, "/orders/", null))).toMatch(/having problems/);
  });

  it("explains network failures", () => {
    expect(describeGsmSendError(new TypeError("fetch failed"))).toMatch(/Could not reach GSM/);
  });

  it("keeps the raw GSM body as the error message for logs", () => {
    expect(new GsmApiError(400, "/orders/", { detail: "x" }).message).toBe('{"detail":"x"}');
  });
});

describe("describeGsmSendReason", () => {
  it("maps route reason codes", () => {
    expect(describeGsmSendReason("FORBIDDEN")).toMatch(/owners and admins/);
    expect(describeGsmSendReason("SOMETHING")).toBe("Failed to send to GSM: SOMETHING");
  });
});

describe("formatGsmSendFailures", () => {
  it("is empty when everything was sent", () => {
    expect(formatGsmSendFailures([{ ok: true }])).toBe("");
  });

  it("lists each failed order with its ID and order number", () => {
    expect(
      formatGsmSendFailures([
        { ok: true, displayId: 1 },
        { ok: false, displayId: 23743, orderNumber: "TCR 92212433", error: "Time window bad" },
      ]),
    ).toBe("1 of 2 orders were sent. 1 failed:\n• ID23743 / TCR 92212433: Time window bad");
  });

  it("reports receipt problems on sent orders", () => {
    expect(formatGsmSendFailures([{ ok: true, displayId: 5, receiptError: "S3 upload failed (403)" }])).toBe(
      "Sent to GSM, but receipts could not be attached:\n• ID5: S3 upload failed (403)",
    );
  });
});

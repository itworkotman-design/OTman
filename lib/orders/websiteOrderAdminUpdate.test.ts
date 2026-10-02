import { describe, expect, it } from "vitest";
import { buildWebsiteOrderAdminUpdate } from "./websiteOrderAdminUpdate";

const initial = { status: "processing", statusNotes: "", subcontractorId: "" };

describe("buildWebsiteOrderAdminUpdate", () => {
  it("sends only what changed, as a one-order bulk update", () => {
    expect(
      buildWebsiteOrderAdminUpdate("order-1", initial, { ...initial, status: "confirmed" }),
    ).toEqual({ ok: true, body: { orderIds: ["order-1"], status: "confirmed" } });

    expect(
      buildWebsiteOrderAdminUpdate("order-1", initial, { ...initial, subcontractorId: "sub-1" }),
    ).toEqual({ ok: true, body: { orderIds: ["order-1"], subcontractorId: "sub-1" } });
  });

  it("never re-sends an unchanged status (it would e.g. re-issue an approval's payment link)", () => {
    const result = buildWebsiteOrderAdminUpdate(
      "order-1",
      { ...initial, status: "approved" },
      { status: "Godkjent", statusNotes: "", subcontractorId: "sub-1" },
    );
    expect(result).toEqual({ ok: true, body: { orderIds: ["order-1"], subcontractorId: "sub-1" } });
  });

  it("sends the status notes along with a status change", () => {
    expect(
      buildWebsiteOrderAdminUpdate("order-1", initial, { ...initial, status: "cancelled", statusNotes: " Kunden avbestilte " }),
    ).toEqual({ ok: true, body: { orderIds: ["order-1"], status: "cancelled", statusNotes: "Kunden avbestilte" } });
  });

  it("reports nothing to save", () => {
    expect(buildWebsiteOrderAdminUpdate("order-1", initial, initial)).toEqual({ ok: false, reason: "NO_CHANGES" });
  });

  it("needs a status change to save notes (the update can't carry notes on their own)", () => {
    expect(buildWebsiteOrderAdminUpdate("order-1", initial, { ...initial, statusNotes: "Ring først" })).toEqual({
      ok: false,
      reason: "NOTES_NEED_STATUS_CHANGE",
    });
  });

  it("requires a comment when rejecting", () => {
    expect(buildWebsiteOrderAdminUpdate("order-1", initial, { ...initial, status: "rejected", statusNotes: " " })).toEqual({
      ok: false,
      reason: "REJECTION_COMMENT_REQUIRED",
    });
  });
});

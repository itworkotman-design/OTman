import { describe, expect, it } from "vitest";
import { buildServiceReviewBlocks, type ServiceReviewInput } from "./serviceReview";

const input: ServiceReviewInput = {
  customerType: "business",
  serviceCode: "option-1",
  customService: "",
  address: "Storgata 1, Oslo",
  jobDescription: "Install three ceiling lights.",
  preferredDate: "2026-10-20",
  timeWindow: "08:00-16:00",
  contact: { name: "Kari Nordmann", phone: "+4712345678", email: "kari@example.com", notes: "" },
};

describe("buildServiceReviewBlocks", () => {
  it("shows the service, where, when and who — in that order", () => {
    const blocks = buildServiceReviewBlocks("en", input);
    expect(blocks.map((b) => [b.kind, b.title])).toEqual([
      ["details", "Service"],
      ["location", "Where"],
      ["details", "Timing"],
      ["contact", "Your details"],
    ]);
    expect(blocks[0].rows).toEqual([
      { label: "Ordering as", value: "Business" },
      { label: "Service", value: "Electrician" },
      { label: "What needs doing", value: "Install three ceiling lights." },
    ]);
    expect(blocks[1].rows).toEqual([{ label: "Address", value: "Storgata 1, Oslo" }]);
    expect(blocks[2].rows).toEqual([
      { label: "Preferred date", value: "20 October 2026" },
      { label: "Time window", value: "08:00-16:00" },
    ]);
  });

  it("leaves out blank optional answers", () => {
    const blocks = buildServiceReviewBlocks("no", input);
    expect(blocks[3].rows.map((r) => r.label)).toEqual(["Navn", "Telefon", "E-post"]);
  });

  it("names the custom service by what the customer typed", () => {
    const blocks = buildServiceReviewBlocks("no", { ...input, serviceCode: "custom", customService: "Maler" });
    expect(blocks[0].rows).toContainEqual({ label: "Tjeneste", value: "Egendefinert tjeneste — Maler" });
  });
});

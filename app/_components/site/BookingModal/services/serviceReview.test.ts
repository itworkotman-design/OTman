import { describe, expect, it } from "vitest";
import { buildServiceReviewBlocks, type ServiceReviewInput } from "./serviceReview";

const input: ServiceReviewInput = {
  customerType: "business",
  services: [
    { serviceCode: "option-1", customService: "", jobDescription: "Install three ceiling lights." },
    { serviceCode: "option-2", customService: "", jobDescription: "Fix the bedroom door." },
  ],
  address: "Storgata 1, Oslo",
  preferredDate: "2026-10-20",
  timeWindow: "08:00-16:00",
  contact: { name: "Kari Nordmann", phone: "+4712345678", email: "kari@example.com", notes: "" },
};

describe("buildServiceReviewBlocks", () => {
  it("shows the services, where, when and who — in that order", () => {
    const blocks = buildServiceReviewBlocks("en", input);
    expect(blocks.map((b) => [b.kind, b.title])).toEqual([
      ["details", "Services"],
      ["location", "Where"],
      ["details", "Timing"],
      ["contact", "Your details"],
    ]);
    // Each service with what needs doing for it.
    expect(blocks[0].rows).toEqual([
      { label: "Ordering as", value: "Business" },
      { label: "Electrician", value: "Install three ceiling lights." },
      { label: "Carpenter", value: "Fix the bedroom door." },
    ]);
    expect(blocks[1].rows).toEqual([{ label: "Address", value: "Storgata 1, Oslo" }]);
    expect(blocks[2].rows).toEqual([
      { label: "Preferred date", value: "20 October 2026" },
      { label: "Time window", value: "08:00-16:00" },
    ]);
  });

  it("calls a single service 'Service'", () => {
    expect(buildServiceReviewBlocks("en", { ...input, services: input.services.slice(0, 1) })[0].title).toBe("Service");
  });

  it("leaves out blank optional answers, and shows the comment with the contact details", () => {
    expect(buildServiceReviewBlocks("no", input)[3].rows.map((r) => r.label)).toEqual(["Navn", "Telefon", "E-post"]);
    const withComment = buildServiceReviewBlocks("no", { ...input, contact: { ...input.contact, notes: "Ring på" } });
    expect(withComment[3].rows).toContainEqual({ label: "Kommentar", value: "Ring på" });
  });

  it("names the custom service by what the customer typed", () => {
    const blocks = buildServiceReviewBlocks("no", { ...input, services: [{ serviceCode: "custom", customService: "Maler", jobDescription: "Male gangen." }] });
    expect(blocks[0].rows).toContainEqual({ label: "Egendefinert tjeneste — Maler", value: "Male gangen." });
  });
});

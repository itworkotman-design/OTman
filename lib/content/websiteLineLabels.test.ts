import { describe, expect, it } from "vitest";
import { localizeProductsSummary, localizeWebsiteLineLabel, localizeWebsiteLineLabelList, localizeWebsiteProductName } from "./websiteLineLabels";

describe("localizeWebsiteLineLabel", () => {
  it("translates the seeded delivery-type labels to Norwegian", () => {
    expect(localizeWebsiteLineLabel("Delivery to doorstep", "no")).toBe("Levering til ytterdør");
    expect(localizeWebsiteLineLabel("Delivery with carry-in", "no")).toBe("Levering med innbæring");
    expect(localizeWebsiteLineLabel("Installation only", "no")).toBe("Kun montering");
  });

  it("translates the seeded order-extra labels to Norwegian", () => {
    expect(localizeWebsiteLineLabel("Additional pickup / pickup in another store", "no")).toBe("Ekstra hentested / henting i annen butikk");
    expect(localizeWebsiteLineLabel("Per km when distance is over 20 km", "no")).toBe("Per km når avstanden er over 20 km");
    expect(localizeWebsiteLineLabel("Per km when distance is over 100 km", "no")).toBe("Per km når avstanden er over 100 km");
    expect(localizeWebsiteLineLabel("Floor surcharge per chargeable floor, no lift", "no")).toBe("Etasjetillegg per etasje uten heis");
  });

  it("ignores surrounding whitespace", () => {
    expect(localizeWebsiteLineLabel("  Delivery to doorstep ", "no")).toBe("Levering til ytterdør");
  });

  it("keeps the label as-is in English, and keeps labels it doesn't know (staff-edited, already Norwegian)", () => {
    expect(localizeWebsiteLineLabel("Delivery to doorstep", "en")).toBe("Delivery to doorstep");
    expect(localizeWebsiteLineLabel("Montering – integrert", "no")).toBe("Montering – integrert");
    expect(localizeWebsiteLineLabel("Our own custom km fee", "no")).toBe("Our own custom km fee");
  });
});

describe("localizeWebsiteProductName", () => {
  it("translates a website product name to Norwegian, keeping a count, number or item-name suffix", () => {
    expect(localizeWebsiteProductName("Washing machine", "no")).toBe("Vaskemaskin");
    expect(localizeWebsiteProductName("Microwave oven", "no")).toBe("Mikrobølgeovn");
    expect(localizeWebsiteProductName("Washing machine x2", "no")).toBe("Vaskemaskin x2");
    expect(localizeWebsiteProductName("TV #2", "no")).toBe("TV #2");
    expect(localizeWebsiteProductName("Other furniture (Piano stool)", "no")).toBe("Andre møbler (Piano stool)");
    expect(localizeWebsiteProductName("Other furniture - Piano stool", "no")).toBe("Andre møbler - Piano stool");
  });

  it("keeps unknown names, and everything in English", () => {
    expect(localizeWebsiteProductName("Some custom product", "no")).toBe("Some custom product");
    expect(localizeWebsiteProductName("Washing machine x2", "en")).toBe("Washing machine x2");
  });
});

describe("localizeProductsSummary", () => {
  it("translates every item of a stored products summary", () => {
    expect(localizeProductsSummary("Washing machine x2, Side-by-side refrigerator, Other furniture (Stool, oak), Boxes x3", "no")).toBe(
      "Vaskemaskin x2, Side-by-side kjøleskap, Andre møbler (Stool, oak), Esker x3",
    );
  });

  it("passes empty and English summaries through", () => {
    expect(localizeProductsSummary(null, "no")).toBeNull();
    expect(localizeProductsSummary("Washing machine x2", "en")).toBe("Washing machine x2");
  });
});

describe("localizeWebsiteLineLabel — catalog option labels", () => {
  it("translates a website catalog option stored by its English label", () => {
    expect(localizeWebsiteLineLabel("Unpacking and disposal of packaging", "no")).toBe("Utpakking og kasting av emballasje");
  });
});

describe("localizeWebsiteLineLabelList", () => {
  it("translates each label of a stored comma list, keeping an xN count", () => {
    expect(localizeWebsiteLineLabelList("Delivery with carry-in x2, Delivery to doorstep", "no")).toBe(
      "Levering med innbæring x2, Levering til ytterdør",
    );
    expect(localizeWebsiteLineLabelList("Unpacking and disposal of packaging, Some staff text", "no")).toBe(
      "Utpakking og kasting av emballasje, Some staff text",
    );
  });

  it("passes empty and English lists through", () => {
    expect(localizeWebsiteLineLabelList(null, "no")).toBeNull();
    expect(localizeWebsiteLineLabelList("Delivery to doorstep", "en")).toBe("Delivery to doorstep");
  });
});

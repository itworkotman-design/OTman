import { describe, expect, it } from "vitest";
import { serviceWindowContent } from "@/lib/content/ServiceWindowContent";
import { serviceModalKind } from "./serviceModalRouting";

describe("serviceModalKind", () => {
  it("routes each homepage card to its own modal", () => {
    const kinds = Object.fromEntries(serviceWindowContent.items.map((item) => [item.title.en, serviceModalKind(item.id)]));
    expect(kinds).toEqual({
      Delivery: "white-goods",
      Services: "placeholder",
      Moving: "moving",
    });
  });

  it("falls back to the placeholder modal for an unknown id", () => {
    expect(serviceModalKind("something-else")).toBe("placeholder");
  });
});

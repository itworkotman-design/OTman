import { describe, expect, it } from "vitest";
import { serviceWindowContent } from "@/lib/content/ServiceWindowContent";
import { serviceCardIdForSwitch, serviceModalKind } from "./serviceModalRouting";

describe("serviceModalKind", () => {
  it("routes each homepage card to its own modal", () => {
    const kinds = Object.fromEntries(serviceWindowContent.items.map((item) => [item.title.en, serviceModalKind(item.id)]));
    expect(kinds).toEqual({
      "Delivery or assembly": "white-goods",
      Services: "services",
      Moving: "moving",
    });
  });

  it("falls back to the placeholder modal for an unknown id", () => {
    expect(serviceModalKind("something-else")).toBe("placeholder");
  });
});

describe("serviceCardIdForSwitch", () => {
  it("maps the services modal's switch tiles back to a homepage card that opens that flow", () => {
    const ids = serviceWindowContent.items.map((item) => item.id);
    for (const target of ["white-goods", "moving"] as const) {
      const id = serviceCardIdForSwitch(target);
      expect(ids).toContain(id);
      expect(serviceModalKind(id)).toBe(target);
    }
  });
});

import { describe, expect, it } from "vitest";
import { serviceWindowContent } from "./ServiceWindowContent";

describe("serviceWindowContent", () => {
  it("has exactly the Delivery, Moving and Services cards, in that order", () => {
    expect(serviceWindowContent.items.map((item) => item.title.en)).toEqual(["Delivery or assembly", "Moving", "Services"]);
    expect(serviceWindowContent.items.map((item) => item.title.no)).toEqual(["Levering eller montering", "Flytting", "Tjenester"]);
  });

  it("gives every card a unique id", () => {
    const ids = serviceWindowContent.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

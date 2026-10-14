import { describe, expect, it } from "vitest";
import { buildCustomerEditPayload, customerEditPrimaryAction, withPickupContacts, type CustomerEditDraft } from "./customerEditPayload";

const initial: CustomerEditDraft = {
  customer: { name: "Kari", phone: "87654321", email: "kari@example.no", comments: "" },
  preferredDate: "2026-10-10",
  timeWindow: "10:00-16:00",
  pickups: [{ address: "Strømmen 1" }],
  delivery: { address: "Kirkegata 5", floor: 2, liftAvailable: false },
  productCards: [{ cardId: 0, productId: "wm" }],
};

describe("buildCustomerEditPayload", () => {
  it("is empty when nothing changed", () => {
    expect(buildCustomerEditPayload(initial, structuredClone(initial), true)).toEqual({});
  });

  it("only sends the parts that changed", () => {
    const current = { ...structuredClone(initial), customer: { ...initial.customer, phone: "91234567" } };
    expect(buildCustomerEditPayload(initial, current, true)).toEqual({ customer: current.customer });

    const cards = [{ cardId: 0, productId: "wm", selectedExtraOptionIds: ["UNPACKING"] }];
    expect(buildCustomerEditPayload(initial, { ...structuredClone(initial), productCards: cards }, true)).toEqual({
      productCards: cards,
    });
  });

  it("sends a changed date and time window together", () => {
    const current = { ...structuredClone(initial), timeWindow: "16:00-21:00" };
    expect(buildCustomerEditPayload(initial, current, true)).toEqual({ preferredDate: "2026-10-10", timeWindow: "16:00-21:00" });
  });

  it("never sends date, addresses or stops after the cutoff — they can't change then", () => {
    const current = {
      ...structuredClone(initial),
      timeWindow: "16:00-21:00",
      delivery: { address: "Annen vei", floor: 2, liftAvailable: false },
      pickups: [{ address: "Elsewhere" }],
    };
    expect(buildCustomerEditPayload(initial, current, false)).toEqual({});
  });

  it("after the cutoff sends a changed pickup contact person — on the stops as loaded, nothing else changed", () => {
    const current = {
      ...structuredClone(initial),
      pickups: [{ address: "Elsewhere", contactName: "Ola", contactPhone: "12345678" }],
    };
    expect(buildCustomerEditPayload(initial, current, false)).toEqual({
      pickups: [{ address: "Strømmen 1", contactName: "Ola", contactPhone: "12345678" }],
    });
  });
});

describe("withPickupContacts", () => {
  it("keeps each stop as loaded and only takes its contact person from the form", () => {
    const loaded = [
      { address: "Strømmen 1", productNames: ["Vaskemaskin"], contactName: "", contactPhone: "" },
      { address: "Bjerkeveien 2", contactName: "Kari", contactPhone: "87654321" },
    ];
    const form = [
      { address: "Strømmen 1", cardIds: [0], contactName: "Ola", contactPhone: "12345678" },
      { address: "Bjerkeveien 2", cardIds: [1], contactName: "Kari", contactPhone: "87654321" },
    ];
    expect(withPickupContacts(loaded, form)).toEqual([
      { address: "Strømmen 1", productNames: ["Vaskemaskin"], contactName: "Ola", contactPhone: "12345678" },
      { address: "Bjerkeveien 2", contactName: "Kari", contactPhone: "87654321" },
    ]);
  });
});

describe("customerEditPrimaryAction", () => {
  it("goes to the summary first when the whole order can still be changed", () => {
    expect(customerEditPrimaryAction({ beforeCutoff: true, summaryOpen: false })).toBe("summary");
  });

  it("saves from the summary", () => {
    expect(customerEditPrimaryAction({ beforeCutoff: true, summaryOpen: true })).toBe("save");
  });

  it("saves straight away within 24h (only contact details and added services)", () => {
    expect(customerEditPrimaryAction({ beforeCutoff: false, summaryOpen: false })).toBe("save");
  });
});

import { describe, expect, it } from "vitest";
import {
  classifyCustomerOrderEdit,
  findForbiddenChanges,
  getCustomerEditPermissions,
  getEditCutoff,
  isAllowedNewSchedule,
  isBookableDeliveryDate,
  type CustomerEditState,
} from "./customerOrderEditPolicy";

describe("getEditCutoff", () => {
  it("is 24h before a preset window's start, in Oslo summer time", () => {
    // 10:00 Oslo (UTC+2) on 2026-10-06 = 08:00Z
    expect(getEditCutoff("2026-10-06", "10:00-16:00")).toEqual(new Date("2026-10-05T08:00:00Z"));
    expect(getEditCutoff("2026-10-06", "16:00-21:00")).toEqual(new Date("2026-10-05T14:00:00Z"));
  });

  it("uses Oslo winter time", () => {
    // 10:00 Oslo (UTC+1) on 2026-12-10 = 09:00Z
    expect(getEditCutoff("2026-12-10", "10:00-16:00")).toEqual(new Date("2026-12-09T09:00:00Z"));
  });

  it("is exactly 24 hours before across the DST change", () => {
    // DST ends 2026-10-25 03:00. 10:00 Oslo on the 26th is 09:00Z.
    expect(getEditCutoff("2026-10-26", "10:00-16:00")).toEqual(new Date("2026-10-25T09:00:00Z"));
  });

  it("uses a custom window's from-time", () => {
    expect(getEditCutoff("2026-12-10", "13:30-15:00")).toEqual(new Date("2026-12-09T12:30:00Z"));
  });

  it("treats a missing or free-text window as the start of the day", () => {
    expect(getEditCutoff("2026-12-10", "")).toEqual(new Date("2026-12-08T23:00:00Z"));
    expect(getEditCutoff("2026-12-10", null)).toEqual(new Date("2026-12-08T23:00:00Z"));
    expect(getEditCutoff("2026-12-10", "whenever suits")).toEqual(new Date("2026-12-08T23:00:00Z"));
  });

  it("has no cutoff without a valid date", () => {
    expect(getEditCutoff(null, "10:00-16:00")).toBeNull();
    expect(getEditCutoff("", "10:00-16:00")).toBeNull();
    expect(getEditCutoff("next week", "10:00-16:00")).toBeNull();
  });
});

describe("getCustomerEditPermissions", () => {
  const base = {
    status: "processing",
    deliveryDate: "2026-10-06",
    timeWindow: "10:00-16:00",
    websiteOrderKind: "WHITE_GOODS" as string | null,
  };

  it("is open and before the cutoff well ahead of the job", () => {
    expect(getCustomerEditPermissions(base, new Date("2026-10-05T07:59:59Z"))).toEqual({
      open: true,
      beforeCutoff: true,
      cutoffAt: new Date("2026-10-05T08:00:00Z"),
      canEditItems: true,
    });
  });

  it("is past the cutoff exactly at it", () => {
    expect(getCustomerEditPermissions(base, new Date("2026-10-05T08:00:00Z")).beforeCutoff).toBe(false);
  });

  it("is never before the cutoff on a closed order", () => {
    const permissions = getCustomerEditPermissions({ ...base, status: "failed" }, new Date("2026-09-01T00:00:00Z"));
    expect(permissions.open).toBe(false);
    expect(permissions.beforeCutoff).toBe(false);
  });

  it("is always before the cutoff when the order has no date", () => {
    expect(getCustomerEditPermissions({ ...base, deliveryDate: null }, new Date("2030-01-01T00:00:00Z")).beforeCutoff).toBe(true);
  });

  it("only lets white-goods orders edit items", () => {
    expect(getCustomerEditPermissions({ ...base, websiteOrderKind: null }, new Date("2026-09-01T00:00:00Z")).canEditItems).toBe(false);
  });
});

function state(overrides: Partial<CustomerEditState> = {}): CustomerEditState {
  return {
    customer: { name: "Kari", phone: "+4790000000", email: "kari@example.com", comments: "" },
    preferredDate: "2026-10-06",
    timeWindow: "10:00-16:00",
    pickups: [
      {
        source: "store",
        placeName: "Elkjøp",
        address: "Storgata 1, Oslo",
        floor: null,
        liftAvailable: false,
        contactName: "",
        contactPhone: "",
        productNames: ["Washing machine"],
        cardIds: [0],
      },
    ],
    delivery: { address: "Lillegata 2, Oslo", floor: 3, liftAvailable: false },
    cards: [
      { cardId: 0, productId: "wm", amount: 1, deliveryType: "FIRST_STEP", selectedExtraOptionIds: [] },
    ],
    ...overrides,
  };
}

describe("classifyCustomerOrderEdit", () => {
  it("finds nothing when nothing changed", () => {
    expect(classifyCustomerOrderEdit(state(), state())).toEqual([]);
  });

  it("finds contact changes, including a pickup stop's contact", () => {
    expect(classifyCustomerOrderEdit(state(), state({ customer: { ...state().customer, phone: "+4791111111" } }))).toEqual(["contact"]);
    const pickups = state().pickups!.map((stop) => ({ ...stop, contactName: "Ola" }));
    expect(classifyCustomerOrderEdit(state(), state({ pickups }))).toEqual(["contact"]);
  });

  it("finds notes", () => {
    expect(classifyCustomerOrderEdit(state(), state({ customer: { ...state().customer, comments: "Ring på" } }))).toEqual(["notes"]);
  });

  it("finds schedule changes", () => {
    expect(classifyCustomerOrderEdit(state(), state({ timeWindow: "16:00-21:00" }))).toEqual(["schedule"]);
    expect(classifyCustomerOrderEdit(state(), state({ preferredDate: "2026-10-08" }))).toEqual(["schedule"]);
  });

  it("finds address, floor and lift changes", () => {
    expect(classifyCustomerOrderEdit(state(), state({ delivery: { address: "Annen vei 3", floor: 3, liftAvailable: false } }))).toEqual(["addresses"]);
    expect(classifyCustomerOrderEdit(state(), state({ delivery: { address: "Lillegata 2, Oslo", floor: 3, liftAvailable: true } }))).toEqual(["addresses"]);
    expect(classifyCustomerOrderEdit(state(), state({ pickups: [] }))).toEqual(["addresses"]);
  });

  it("ignores display-only product names on a stop", () => {
    const pickups = state().pickups!.map((stop) => ({ ...stop, productNames: ["Vaskemaskin"] }));
    expect(classifyCustomerOrderEdit(state(), state({ pickups }))).toEqual([]);
  });

  it("finds purely added services (extra add-ons, doorstep → carry-in) as addOns", () => {
    const cards = [{ ...state().cards![0], selectedExtraOptionIds: ["UNPACKING"] }];
    expect(classifyCustomerOrderEdit(state(), state({ cards }))).toEqual(["addOns"]);
    const indoor = [{ ...state().cards![0], deliveryType: "INDOOR" }];
    expect(classifyCustomerOrderEdit(state(), state({ cards: indoor }))).toEqual(["addOns"]);
    const returned = [{ ...state().cards![0], selectedReturnOptionId: "RETURN", demontEnabled: true }];
    expect(classifyCustomerOrderEdit(state(), state({ cards: returned }))).toEqual(["addOns"]);
  });

  it("finds removing or swapping a service, or a downgrade, as a reconfigure", () => {
    const withUnpacking = state({ cards: [{ ...state().cards![0], deliveryType: "INDOOR", selectedExtraOptionIds: ["UNPACKING"] }] });
    const removed = [{ ...withUnpacking.cards![0], selectedExtraOptionIds: [] }];
    expect(classifyCustomerOrderEdit(withUnpacking, state({ cards: removed }))).toEqual(["reconfigure"]);
    const downgraded = [{ ...withUnpacking.cards![0], deliveryType: "FIRST_STEP" }];
    expect(classifyCustomerOrderEdit(withUnpacking, state({ cards: downgraded }))).toEqual(["reconfigure"]);
    const installed = state({ cards: [{ ...state().cards![0], selectedInstallOptionIds: ["WALL"] }] });
    const swapped = [{ ...installed.cards![0], selectedInstallOptionIds: ["TABLE"] }];
    expect(classifyCustomerOrderEdit(installed, state({ cards: swapped }))).toEqual(["reconfigure"]);
  });

  it("finds a quantity change", () => {
    const cards = [{ ...state().cards![0], amount: 2 }];
    expect(classifyCustomerOrderEdit(state(), state({ cards }))).toEqual(["quantity"]);
  });

  it("finds added and removed products", () => {
    const added = [...state().cards!, { cardId: 1, productId: "dryer", amount: 1, deliveryType: "FIRST_STEP", selectedExtraOptionIds: [] }];
    expect(classifyCustomerOrderEdit(state(), state({ cards: added }))).toEqual(["addProduct"]);
    expect(classifyCustomerOrderEdit(state(), state({ cards: [] }))).toEqual(["removeProduct"]);
  });

  it("treats a card swapped to another product as remove + add", () => {
    const swapped = [{ ...state().cards![0], productId: "dryer" }];
    expect(classifyCustomerOrderEdit(state(), state({ cards: swapped })).sort()).toEqual(["addProduct", "removeProduct"]);
  });

  it("ignores parts the edit didn't send", () => {
    expect(classifyCustomerOrderEdit(state(), state({ cards: undefined, pickups: undefined, delivery: undefined }))).toEqual([]);
  });
});

describe("findForbiddenChanges", () => {
  const before = { open: true, beforeCutoff: true, cutoffAt: null, canEditItems: true };
  const after = { ...before, beforeCutoff: false };

  it("allows everything before the cutoff", () => {
    expect(
      findForbiddenChanges(["contact", "notes", "schedule", "addresses", "addOns", "reconfigure", "addProduct", "removeProduct", "quantity"], before),
    ).toEqual([]);
  });

  it("only allows contact, notes and added services after the cutoff", () => {
    expect(findForbiddenChanges(["contact", "notes", "addOns"], after)).toEqual([]);
    expect(findForbiddenChanges(["schedule", "addresses", "reconfigure", "addProduct", "removeProduct", "quantity", "notes"], after)).toEqual([
      "schedule",
      "addresses",
      "reconfigure",
      "addProduct",
      "removeProduct",
      "quantity",
    ]);
  });

  it("forbids everything on a closed order", () => {
    expect(findForbiddenChanges(["contact", "notes"], { ...after, open: false })).toEqual(["contact", "notes"]);
  });

  it("forbids item and address changes on orders that can't edit items", () => {
    expect(
      findForbiddenChanges(["contact", "schedule", "addresses", "addOns", "reconfigure"], { ...before, canEditItems: false }),
    ).toEqual(["addresses", "addOns", "reconfigure"]);
  });
});

describe("isAllowedNewSchedule", () => {
  const now = new Date("2026-10-05T10:00:00Z"); // 12:00 Oslo

  it("refuses today and earlier", () => {
    expect(isAllowedNewSchedule("2026-10-05", "16:00-21:00", now)).toBe(false);
    expect(isAllowedNewSchedule("2026-10-01", "10:00-16:00", now)).toBe(false);
  });

  it("refuses a slot that is already inside its own 24h cutoff", () => {
    // Tomorrow 10:00 Oslo is 22h away.
    expect(isAllowedNewSchedule("2026-10-06", "10:00-16:00", now)).toBe(false);
  });

  it("accepts a slot more than 24h away", () => {
    expect(isAllowedNewSchedule("2026-10-06", "16:00-21:00", now)).toBe(true);
    expect(isAllowedNewSchedule("2026-10-12", "10:00-16:00", now)).toBe(true);
  });

  it("refuses Sundays and Norwegian public holidays, like the booking calendar", () => {
    expect(isAllowedNewSchedule("2026-10-11", "10:00-16:00", now)).toBe(false); // Sunday
    expect(isAllowedNewSchedule("2026-12-25", "10:00-16:00", now)).toBe(false); // Christmas Day
    expect(isAllowedNewSchedule("2026-10-10", "10:00-16:00", now)).toBe(true); // Saturday
  });

  it("refuses a missing or invalid date", () => {
    expect(isAllowedNewSchedule("", "10:00-16:00", now)).toBe(false);
    expect(isAllowedNewSchedule("2026-13-40", "10:00-16:00", now)).toBe(false);
  });
});

describe("isBookableDeliveryDate", () => {
  const now = new Date("2026-10-05T10:00:00Z"); // Monday, 12:00 Oslo

  it("accepts tomorrow and later (the booking calendar's rule — no 24h cutoff)", () => {
    expect(isBookableDeliveryDate("2026-10-06", now)).toBe(true);
    expect(isBookableDeliveryDate("2026-10-16", now)).toBe(true);
  });

  it("refuses today, the past, Sundays, public holidays and non-dates", () => {
    expect(isBookableDeliveryDate("2026-10-05", now)).toBe(false);
    expect(isBookableDeliveryDate("2026-09-30", now)).toBe(false);
    expect(isBookableDeliveryDate("2026-10-11", now)).toBe(false);
    expect(isBookableDeliveryDate("2026-12-25", now)).toBe(false);
    expect(isBookableDeliveryDate("15.10.2026", now)).toBe(false);
  });
});

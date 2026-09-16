import { describe, expect, it } from "vitest";
import { filterImpreciseAddressNotesForTask } from "./addressPrecision";

describe("filterImpreciseAddressNotesForTask", () => {
  it("keeps a field's own imprecise-address note when building that field's task", () => {
    const description = 'Product\n\nDelivery address: exact address not found on map, customer entered "oslo s"';

    expect(filterImpreciseAddressNotesForTask(description, "deliveryAddress")).toBe(description);
  });

  it("strips another field's imprecise-address note so it doesn't leak onto this task", () => {
    const description = 'Product\n\nDelivery address: exact address not found on map, customer entered "oslo s"';

    expect(filterImpreciseAddressNotesForTask(description, "pickupAddress")).toBe("Product\n");
    expect(filterImpreciseAddressNotesForTask(description, "returnAddress")).toBe("Product\n");
  });

  it("strips a Norwegian-labelled note the same way", () => {
    const description = 'Heis - Nei\n\nLeveringsadresse: exact address not found on map, customer entered "oslo s"';

    expect(filterImpreciseAddressNotesForTask(description, "pickupAddress")).toBe("Heis - Nei\n");
  });

  it("leaves manually-typed text that merely mentions another field alone", () => {
    const description = "Product\n\nCustomer said delivery address might change tomorrow";

    expect(filterImpreciseAddressNotesForTask(description, "pickupAddress")).toBe(description);
  });

  it("passes through an empty or missing description unchanged", () => {
    expect(filterImpreciseAddressNotesForTask("", "pickupAddress")).toBe("");
    expect(filterImpreciseAddressNotesForTask(null, "pickupAddress")).toBe("");
    expect(filterImpreciseAddressNotesForTask(undefined, "pickupAddress")).toBe("");
  });
});

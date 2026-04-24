import { describe, expect, it } from "vitest";

import {
  buildWordpressExtraPickupContacts,
  getWordpressExpressDelivery,
  getWordpressExtraPickupAddresses,
  toWordpressMetaRecord,
} from "./orderMeta";

describe("wordpress order meta helpers", () => {
  it("parses extra pickup addresses from nested and flattened legacy meta", () => {
    expect(
      getWordpressExtraPickupAddresses({
        field_68248234acd3e: [
          { field_68248274acd3f: "Pickup 1" },
          { pickup: "Pickup 2" },
        ],
        extra_pickup_locations_0_pickup: "Pickup 1",
        field_68248234acd3e_1_field_68248274acd3f: "Pickup 3",
      }),
    ).toEqual(["Pickup 1", "Pickup 2", "Pickup 3"]);
  });

  it("builds default contacts for imported extra pickup addresses", () => {
    expect(buildWordpressExtraPickupContacts(["Pickup 1"])).toEqual([
      {
        address: "Pickup 1",
        phone: "",
        email: "",
        sendEmail: true,
      },
    ]);
  });

  it("detects express delivery from explicit legacy meta or breakdown html", () => {
    expect(
      getWordpressExpressDelivery({
        field_684c3ad580b60: ["Express"],
      }),
    ).toBe(true);

    expect(
      getWordpressExpressDelivery({
        field_684c3ad580b60: "1",
      }),
    ).toBe(true);

    expect(
      getWordpressExpressDelivery({
        field_684c3ad580b60: 1,
      }),
    ).toBe(true);

    expect(
      getWordpressExpressDelivery({
        price_breakdown_html:
          '<div class="price-breakdown-label">EXPRESS DELIVERY</div>',
      }),
    ).toBe(true);

    expect(
      getWordpressExpressDelivery({
        field_684c3ad580b60: ["No"],
      }),
    ).toBe(false);
  });

  it("normalizes non-object legacy meta values to an empty record", () => {
    expect(toWordpressMetaRecord(null)).toEqual({});
    expect(toWordpressMetaRecord(["x"])).toEqual({});
  });
});

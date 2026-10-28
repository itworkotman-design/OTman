import { describe, expect, it } from "vitest";
import {
  buildPrepareEmailPreview,
  buildContactRecipients,
  getOrderStoreMembershipId,
  groupOrdersForPrepareEmail,
  type PrepareEmailContact,
  type PrepareEmailOrder,
} from "./prepareOrdersEmailGroups";

function contact(name: string, email: string, warehouseEmail = ""): PrepareEmailContact {
  return { name, recipients: buildContactRecipients(name, email, warehouseEmail) };
}

function order(partial: Partial<PrepareEmailOrder> & Pick<PrepareEmailOrder, "id">): PrepareEmailOrder {
  return {
    customPickupAddressId: null,
    customerMembershipId: null,
    createdByMembershipId: "m-storo",
    pickupAddress: "Main pickup",
    extraPickups: [],
    ...partial,
  };
}

describe("buildContactRecipients", () => {
  it("returns login email and a distinct warehouse email", () => {
    expect(buildContactRecipients("Store", " a@x.no ", "w@x.no")).toEqual([
      { email: "a@x.no", name: "Store" },
      { email: "w@x.no", name: "Store" },
    ]);
  });

  it("drops a warehouse email equal to the login email and empty values", () => {
    expect(buildContactRecipients("Store", "a@x.no", "a@x.no")).toEqual([{ email: "a@x.no", name: "Store" }]);
    expect(buildContactRecipients("Store", "", "")).toEqual([]);
  });
});

describe("getOrderStoreMembershipId", () => {
  it("prefers the customer membership, like the Store filter", () => {
    expect(getOrderStoreMembershipId({ customerMembershipId: "cust", createdByMembershipId: "creator" })).toBe("cust");
    expect(getOrderStoreMembershipId({ customerMembershipId: null, createdByMembershipId: "creator" })).toBe("creator");
  });
});

describe("groupOrdersForPrepareEmail", () => {
  const pickupContacts = new Map([
    ["cpa-alnabru", contact("POWER Alnabru", "alnabru@power.no", "lager@power.no")],
    ["cpa-askim", contact("POWER Askim", "askim@power.no")],
  ]);
  const storeContacts = new Map([
    ["m-storo", contact("POWER Storo", "storo@power.no")],
    ["m-noemail", contact("No email store", "")],
  ]);

  it("groups orders by pickup contact, falling back to the store", () => {
    const result = groupOrdersForPrepareEmail(
      [
        order({ id: "o1", customPickupAddressId: "cpa-alnabru", pickupAddress: "Alnabru" }),
        order({ id: "o2", customPickupAddressId: "cpa-alnabru", pickupAddress: "Alnabru" }),
        // Pickup without a main user → store fallback.
        order({ id: "o3", customPickupAddressId: "cpa-no-main", pickupAddress: "Somewhere" }),
        order({ id: "o4", customerMembershipId: "m-storo", createdByMembershipId: "admin", pickupAddress: "Storo" }),
      ],
      pickupContacts,
      storeContacts,
    );

    expect(result.unresolved).toEqual([]);
    expect(result.groups).toEqual([
      {
        key: "pickup:cpa-alnabru",
        recipientName: "POWER Alnabru",
        recipients: [
          { email: "alnabru@power.no", name: "POWER Alnabru" },
          { email: "lager@power.no", name: "POWER Alnabru" },
        ],
        orderIds: ["o1", "o2"],
        stops: [
          { orderId: "o1", pickupAddress: "Alnabru", extra: false },
          { orderId: "o2", pickupAddress: "Alnabru", extra: false },
        ],
      },
      {
        key: "store:m-storo",
        recipientName: "POWER Storo",
        recipients: [{ email: "storo@power.no", name: "POWER Storo" }],
        orderIds: ["o3", "o4"],
        stops: [
          { orderId: "o3", pickupAddress: "Somewhere", extra: false },
          { orderId: "o4", pickupAddress: "Storo", extra: false },
        ],
      },
    ]);
  });

  it("sends each extra pickup as its own email, to the saved address's main user or the pickup's own email", () => {
    const result = groupOrdersForPrepareEmail(
      [
        order({
          id: "o1",
          customPickupAddressId: "cpa-alnabru",
          pickupAddress: "Alnabru",
          extraPickups: [
            { address: "Askim", email: "", sendEmail: true, customPickupAddressId: "cpa-askim" },
            { address: "Elkjøp Lager", email: "Lager@Elkjop.no", sendEmail: true, customPickupAddressId: null },
          ],
        }),
      ],
      pickupContacts,
      storeContacts,
    );

    expect(result.unresolved).toEqual([]);
    expect(result.groups.map((group) => [group.key, group.orderIds, group.stops])).toEqual([
      ["pickup:cpa-alnabru", ["o1"], [{ orderId: "o1", pickupAddress: "Alnabru", extra: false }]],
      ["pickup:cpa-askim", ["o1"], [{ orderId: "o1", pickupAddress: "Askim", extra: true }]],
      ["email:lager@elkjop.no", ["o1"], [{ orderId: "o1", pickupAddress: "Elkjøp Lager", extra: true }]],
    ]);
    expect(result.groups[2].recipients).toEqual([{ email: "Lager@Elkjop.no", name: "Elkjøp Lager" }]);
  });

  it("never falls back to the store for an extra pickup, and respects sendEmail = false", () => {
    const result = groupOrdersForPrepareEmail(
      [
        order({
          id: "o1",
          pickupAddress: "Storo",
          extraPickups: [
            { address: "No contact", email: "", sendEmail: true, customPickupAddressId: null },
            { address: "Opted out", email: "x@y.no", sendEmail: false, customPickupAddressId: null },
          ],
        }),
      ],
      pickupContacts,
      storeContacts,
    );

    expect(result.groups.map((group) => group.key)).toEqual(["store:m-storo"]);
    expect(result.unresolved).toEqual([
      { orderId: "o1", pickupAddress: "No contact", extra: true },
      { orderId: "o1", pickupAddress: "Opted out", extra: true },
    ]);
  });

  it("lists an order once per group when its main and extra pickup go to the same place", () => {
    const result = groupOrdersForPrepareEmail(
      [
        order({
          id: "o1",
          customPickupAddressId: "cpa-alnabru",
          pickupAddress: "Alnabru",
          extraPickups: [{ address: "Alnabru gate 2", email: "", sendEmail: true, customPickupAddressId: "cpa-alnabru" }],
        }),
      ],
      pickupContacts,
      storeContacts,
    );

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].orderIds).toEqual(["o1"]);
    expect(result.groups[0].stops).toHaveLength(2);
  });

  it("reports main pickups with no reachable recipient as unresolved", () => {
    const result = groupOrdersForPrepareEmail(
      [
        order({ id: "o1", createdByMembershipId: "m-noemail" }),
        order({ id: "o2", createdByMembershipId: "m-unknown" }),
      ],
      pickupContacts,
      storeContacts,
    );

    expect(result.groups).toEqual([]);
    expect(result.unresolved).toEqual([
      { orderId: "o1", pickupAddress: "Main pickup", extra: false },
      { orderId: "o2", pickupAddress: "Main pickup", extra: false },
    ]);
  });
});

describe("buildPrepareEmailPreview", () => {
  const orders = [
    { id: "o1", displayId: 101 },
    { id: "o2", displayId: 102 },
  ];

  it("maps each group to its kind, emails and one row per pickup stop", () => {
    const preview = buildPrepareEmailPreview(
      [
        {
          key: "pickup:cpa-alnabru",
          recipientName: "POWER Alnabru",
          recipients: [{ email: "alnabru@power.no", name: "POWER Alnabru" }, { email: "lager@power.no" }],
          orderIds: ["o1"],
          stops: [{ orderId: "o1", pickupAddress: "Alnabru", extra: false }],
        },
        {
          key: "email:lager@elkjop.no",
          recipientName: "Elkjøp Lager",
          recipients: [{ email: "lager@elkjop.no" }],
          orderIds: ["o1"],
          stops: [{ orderId: "o1", pickupAddress: "Elkjøp Lager", extra: true }],
        },
      ],
      [{ orderId: "missing", pickupAddress: "", extra: false }],
      orders,
    );

    expect(preview.groups).toEqual([
      {
        key: "pickup:cpa-alnabru",
        kind: "pickup",
        recipientName: "POWER Alnabru",
        emails: ["alnabru@power.no", "lager@power.no"],
        rows: [{ key: "o1:0", displayId: "101", pickupAddress: "Alnabru", extra: false }],
      },
      {
        key: "email:lager@elkjop.no",
        kind: "extra",
        recipientName: "Elkjøp Lager",
        emails: ["lager@elkjop.no"],
        rows: [{ key: "o1:0", displayId: "101", pickupAddress: "Elkjøp Lager", extra: true }],
      },
    ]);
    // Unknown rows (e.g. not on the current page) still show, by id.
    expect(preview.unresolved).toEqual([{ key: "missing:0", displayId: "missing", pickupAddress: "", extra: false }]);
  });
});

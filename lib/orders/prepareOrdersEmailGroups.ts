// Groups selected orders into one "prepare orders" email per recipient. Every
// pickup on an order is its own stop, so an order with extra pickups is sent
// to each place it's collected from:
// - main pickup: the saved address's main user (the user whose
//   mainPickupAddress it is — never the mainReturnAddress link, so a shared
//   return address like Franzefoss gjenvinning can't pull orders in); with no
//   main user or no saved address, the order's store, resolved the same way
//   as the archive Store filter.
// - extra pickup: the saved address's main user, else the extra pickup's own
//   contact email (unless its sendEmail is off). Never the store — the store
//   is where the main pickup happens.

export const PREPARE_ORDERS_EMAIL = {
  subject: "Forbered bestillinger",
  // The email template already opens with "Hei <name>,".
  message: "Se valgte bestillinger nedenfor.",
} as const;

export type PrepareEmailRecipient = { email: string; name?: string };

export type PrepareEmailContact = {
  name: string;
  recipients: PrepareEmailRecipient[];
};

export type PrepareEmailExtraPickup = {
  address: string;
  email: string;
  sendEmail: boolean;
  customPickupAddressId: string | null;
};

export type PrepareEmailOrder = {
  id: string;
  customPickupAddressId: string | null;
  customerMembershipId: string | null;
  createdByMembershipId: string;
  pickupAddress: string;
  extraPickups: PrepareEmailExtraPickup[];
};

export type PrepareEmailStop = { orderId: string; pickupAddress: string; extra: boolean };

export type PrepareEmailGroup = {
  key: string;
  recipientName: string;
  recipients: PrepareEmailRecipient[];
  // Unique order ids sent in this email; `stops` has one entry per pickup.
  orderIds: string[];
  stops: PrepareEmailStop[];
};

// Same rule as the old store email bar: login email plus a distinct warehouse email.
export function buildContactRecipients(
  name: string,
  email?: string | null,
  warehouseEmail?: string | null,
): PrepareEmailRecipient[] {
  const primary = email?.trim() || "";
  const warehouse = warehouseEmail?.trim() || "";
  const recipients: PrepareEmailRecipient[] = [];

  if (primary) recipients.push({ email: primary, name });
  if (warehouse && warehouse !== primary) recipients.push({ email: warehouse, name });

  return recipients;
}

export function getOrderStoreMembershipId(order: Pick<PrepareEmailOrder, "customerMembershipId" | "createdByMembershipId">) {
  return order.customerMembershipId ?? order.createdByMembershipId;
}

export function groupOrdersForPrepareEmail(
  orders: PrepareEmailOrder[],
  pickupContacts: Map<string, PrepareEmailContact>,
  storeContacts: Map<string, PrepareEmailContact>,
): { groups: PrepareEmailGroup[]; unresolved: PrepareEmailStop[] } {
  const groups = new Map<string, PrepareEmailGroup>();
  const unresolved: PrepareEmailStop[] = [];

  const savedPickup = (id: string | null) => {
    const found = id ? pickupContacts.get(id) : undefined;
    return found && found.recipients.length > 0 ? ([`pickup:${id}`, found] as const) : null;
  };

  function add(stop: PrepareEmailStop, target: readonly [string, PrepareEmailContact | undefined] | null) {
    const [key, contact] = target ?? [];
    if (!key || !contact || contact.recipients.length === 0) {
      unresolved.push(stop);
      return;
    }

    let group = groups.get(key);
    if (!group) {
      group = { key, recipientName: contact.name, recipients: contact.recipients, orderIds: [], stops: [] };
      groups.set(key, group);
    }
    if (!group.orderIds.includes(stop.orderId)) group.orderIds.push(stop.orderId);
    group.stops.push(stop);
  }

  for (const order of orders) {
    const storeId = getOrderStoreMembershipId(order);
    add(
      { orderId: order.id, pickupAddress: order.pickupAddress, extra: false },
      savedPickup(order.customPickupAddressId) ?? [`store:${storeId}`, storeContacts.get(storeId)],
    );

    for (const pickup of order.extraPickups) {
      const ownEmail = pickup.sendEmail ? pickup.email.trim() : "";
      add(
        { orderId: order.id, pickupAddress: pickup.address, extra: true },
        savedPickup(pickup.customPickupAddressId) ??
          (ownEmail
            ? [`email:${ownEmail.toLowerCase()}`, { name: pickup.address, recipients: [{ email: ownEmail, name: pickup.address }] }]
            : null),
      );
    }
  }

  return { groups: [...groups.values()], unresolved };
}

export type PrepareEmailPreviewRow = { key: string; displayId: string; pickupAddress: string; extra: boolean };

export type PrepareEmailPreviewGroup = {
  key: string;
  kind: "pickup" | "store" | "extra";
  recipientName: string;
  emails: string[];
  rows: PrepareEmailPreviewRow[];
};

// Rows for the confirmation modal, one per pickup stop. Orders are looked up
// in the loaded archive rows; one that isn't there still shows, by its id.
export function buildPrepareEmailPreview(
  groups: PrepareEmailGroup[],
  unresolved: PrepareEmailStop[],
  orders: Array<{ id: string; displayId: number }>,
): { groups: PrepareEmailPreviewGroup[]; unresolved: PrepareEmailPreviewRow[] } {
  const byId = new Map(orders.map((order) => [order.id, order]));
  const toRow = (stop: PrepareEmailStop, index: number): PrepareEmailPreviewRow => {
    const order = byId.get(stop.orderId);
    return {
      key: `${stop.orderId}:${index}`,
      displayId: order ? String(order.displayId) : stop.orderId,
      pickupAddress: stop.pickupAddress,
      extra: stop.extra,
    };
  };

  return {
    groups: groups.map((group) => ({
      key: group.key,
      kind: group.key.startsWith("pickup:") ? "pickup" : group.key.startsWith("store:") ? "store" : "extra",
      recipientName: group.recipientName,
      emails: group.recipients.map((recipient) => recipient.email),
      rows: group.stops.map(toRow),
    })),
    unresolved: unresolved.map(toRow),
  };
}

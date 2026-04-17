import { Prisma } from "@prisma/client";

type OrderEventClient = {
  orderEvent?: {
    create: (args: {
      data: Prisma.OrderEventUncheckedCreateInput;
    }) => Promise<unknown>;
    createMany?: (args: {
      data: Prisma.OrderEventCreateManyInput[];
    }) => Promise<unknown>;
  };
  $executeRaw?: (query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => Promise<unknown>;
};

export type OrderEventActor = {
  membershipId?: string | null;
  name?: string | null;
  email?: string | null;
  source?: string | null;
};

export type OrderEventSnapshot = {
  displayId: number | null;
  orderNumber: string | null;
  status: string | null;
  statusNotes: string | null;
  customerLabel: string | null;
  customerName: string | null;
  deliveryDate: string | null;
  timeWindow: string | null;
  expressDelivery: boolean;
  contactCustomerForCustomTimeWindow: boolean;
  customTimeContactNote: string | null;
  pickupAddress: string | null;
  extraPickupAddress: string[];
  deliveryAddress: string | null;
  returnAddress: string | null;
  drivingDistance: string | null;
  phone: string | null;
  phoneTwo: string | null;
  email: string | null;
  customerComments: string | null;
  description: string | null;
  productsSummary: string | null;
  deliveryTypeSummary: string | null;
  servicesSummary: string | null;
  cashierName: string | null;
  cashierPhone: string | null;
  subcontractor: string | null;
  driver: string | null;
  secondDriver: string | null;
  driverInfo: string | null;
  licensePlate: string | null;
  deviation: string | null;
  feeExtraWork: boolean;
  feeAddToOrder: boolean;
  dontSendEmail: boolean;
  priceExVat: number | null;
  priceSubcontractor: number | null;
  rabatt: string | null;
  leggTil: string | null;
  subcontractorMinus: string | null;
  subcontractorPlus: string | null;
  gsmLastTaskState: string | null;
};

export type OrderEventChange = {
  field: keyof OrderEventSnapshot;
  label: string;
  previousValue: string;
  nextValue: string;
};

export type OrderEventProductChange = {
  cardId: number;
  title: string;
  changeType: "ADDED" | "REMOVED" | "UPDATED";
  changes: Array<{
    label: string;
    previousValue: string;
    nextValue: string;
  }>;
};

type OrderEventSnapshotSource = Partial<OrderEventSnapshot>;

type CreatedPayload = {
  kind: "created";
  snapshot: OrderEventSnapshot;
};

type UpdatedPayload = {
  kind: "updated";
  changes: OrderEventChange[];
  productChanges?: OrderEventProductChange[];
};

type StatusChangedPayload = {
  kind: "status_changed";
  fromStatus: string;
  toStatus: string;
  note: string | null;
};

export type OrderEventPayload =
  | CreatedPayload
  | UpdatedPayload
  | StatusChangedPayload;

const FIELD_LABELS: Record<keyof OrderEventSnapshot, string> = {
  displayId: "Order ID",
  orderNumber: "Order number",
  status: "Status",
  statusNotes: "Status notes",
  customerLabel: "Customer",
  customerName: "Customer name",
  deliveryDate: "Delivery date",
  timeWindow: "Time window",
  expressDelivery: "Express delivery",
  contactCustomerForCustomTimeWindow: "Contact customer for custom time",
  customTimeContactNote: "Custom time contact note",
  pickupAddress: "Pickup address",
  extraPickupAddress: "Extra pickup",
  deliveryAddress: "Delivery address",
  returnAddress: "Return address",
  drivingDistance: "Driving distance",
  phone: "Phone",
  phoneTwo: "Phone 2",
  email: "Email",
  customerComments: "Customer comments",
  description: "Description",
  productsSummary: "Products",
  deliveryTypeSummary: "Delivery type",
  servicesSummary: "Services",
  cashierName: "Cashier name",
  cashierPhone: "Cashier phone",
  subcontractor: "Subcontractor",
  driver: "Driver",
  secondDriver: "Second driver",
  driverInfo: "Driver info",
  licensePlate: "License plate",
  deviation: "Deviation",
  feeExtraWork: "Extra work fee",
  feeAddToOrder: "Add fee to order",
  dontSendEmail: "Do not send email",
  priceExVat: "Price ex. VAT",
  priceSubcontractor: "Subcontractor price",
  rabatt: "Discount",
  leggTil: "Add-on",
  subcontractorMinus: "Subcontractor minus",
  subcontractorPlus: "Subcontractor plus",
  gsmLastTaskState: "GSM task state",
};

const SNAPSHOT_FIELDS = Object.keys(FIELD_LABELS) as Array<
  keyof OrderEventSnapshot
>;

function normalizeString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizeBoolean(value: boolean | null | undefined) {
  return value === true;
}

function formatValue(
  field: keyof OrderEventSnapshot,
  value: OrderEventSnapshot[keyof OrderEventSnapshot],
) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    if (field === "priceExVat" || field === "priceSubcontractor") {
      return `NOK ${value.toLocaleString("nb-NO")}`;
    }

    return String(value);
  }

  if (!value) {
    return "-";
  }

  return value;
}

function payloadToJson(payload: OrderEventPayload) {
  return payload as unknown as Prisma.InputJsonValue;
}

function getOrderEventDelegate(client: OrderEventClient) {
  return client.orderEvent ?? null;
}

function isMissingOrderEventTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

async function insertOrderEventRaw(
  client: OrderEventClient,
  data: Prisma.OrderEventUncheckedCreateInput,
) {
  const rawClient = client as OrderEventClient;

  if (!rawClient.$executeRaw) {
    return false;
  }

  await rawClient.$executeRaw(
    Prisma.sql`
      INSERT INTO "OrderEvent" (
        "id",
        "orderId",
        "companyId",
        "type",
        "actorMembershipId",
        "actorName",
        "actorEmail",
        "actorSource",
        "payload",
        "createdAt"
      ) VALUES (
        ${data.id ?? crypto.randomUUID()},
        ${data.orderId},
        ${data.companyId},
        ${data.type},
        ${data.actorMembershipId ?? null},
        ${data.actorName ?? null},
        ${data.actorEmail ?? null},
        ${data.actorSource ?? null},
        ${JSON.stringify(data.payload)}::jsonb,
        ${data.createdAt ?? new Date()}
      )
    `,
  );

  return true;
}

export function buildOrderEventSnapshot(
  source: OrderEventSnapshotSource,
): OrderEventSnapshot {
  return {
    displayId: normalizeNumber(source.displayId),
    orderNumber: normalizeString(source.orderNumber),
    status: normalizeString(source.status),
    statusNotes: normalizeString(source.statusNotes),
    customerLabel: normalizeString(source.customerLabel),
    customerName: normalizeString(source.customerName),
    deliveryDate: normalizeString(source.deliveryDate),
    timeWindow: normalizeString(source.timeWindow),
    expressDelivery: normalizeBoolean(source.expressDelivery),
    contactCustomerForCustomTimeWindow: normalizeBoolean(
      source.contactCustomerForCustomTimeWindow,
    ),
    customTimeContactNote: normalizeString(source.customTimeContactNote),
    pickupAddress: normalizeString(source.pickupAddress),
    extraPickupAddress: normalizeStringArray(source.extraPickupAddress),
    deliveryAddress: normalizeString(source.deliveryAddress),
    returnAddress: normalizeString(source.returnAddress),
    drivingDistance: normalizeString(source.drivingDistance),
    phone: normalizeString(source.phone),
    phoneTwo: normalizeString(source.phoneTwo),
    email: normalizeString(source.email),
    customerComments: normalizeString(source.customerComments),
    description: normalizeString(source.description),
    productsSummary: normalizeString(source.productsSummary),
    deliveryTypeSummary: normalizeString(source.deliveryTypeSummary),
    servicesSummary: normalizeString(source.servicesSummary),
    cashierName: normalizeString(source.cashierName),
    cashierPhone: normalizeString(source.cashierPhone),
    subcontractor: normalizeString(source.subcontractor),
    driver: normalizeString(source.driver),
    secondDriver: normalizeString(source.secondDriver),
    driverInfo: normalizeString(source.driverInfo),
    licensePlate: normalizeString(source.licensePlate),
    deviation: normalizeString(source.deviation),
    feeExtraWork: normalizeBoolean(source.feeExtraWork),
    feeAddToOrder: normalizeBoolean(source.feeAddToOrder),
    dontSendEmail: normalizeBoolean(source.dontSendEmail),
    priceExVat: normalizeNumber(source.priceExVat),
    priceSubcontractor: normalizeNumber(source.priceSubcontractor),
    rabatt: normalizeString(source.rabatt),
    leggTil: normalizeString(source.leggTil),
    subcontractorMinus: normalizeString(source.subcontractorMinus),
    subcontractorPlus: normalizeString(source.subcontractorPlus),
    gsmLastTaskState: normalizeString(source.gsmLastTaskState),
  };
}

export function diffOrderEventSnapshots(
  previousSnapshot: OrderEventSnapshot,
  nextSnapshot: OrderEventSnapshot,
) {
  const changes: OrderEventChange[] = [];

  for (const field of SNAPSHOT_FIELDS) {
    const previousValue = previousSnapshot[field];
    const nextValue = nextSnapshot[field];

    const previousSerialized = JSON.stringify(previousValue);
    const nextSerialized = JSON.stringify(nextValue);

    if (previousSerialized === nextSerialized) {
      continue;
    }

    changes.push({
      field,
      label: FIELD_LABELS[field],
      previousValue: formatValue(field, previousValue),
      nextValue: formatValue(field, nextValue),
    });
  }

  return changes;
}

export async function createOrderCreatedEvent(
  client: OrderEventClient,
  input: {
    orderId: string;
    companyId: string;
    actor: OrderEventActor;
    snapshot: OrderEventSnapshot;
    createdAt?: Date;
  },
) {
  const orderEvent = getOrderEventDelegate(client);
  const data: Prisma.OrderEventUncheckedCreateInput = {
    id: crypto.randomUUID(),
    orderId: input.orderId,
    companyId: input.companyId,
    type: "CREATED",
    actorMembershipId: input.actor.membershipId ?? null,
    actorName: input.actor.name ?? null,
    actorEmail: input.actor.email ?? null,
    actorSource: input.actor.source ?? "USER",
    payload: payloadToJson({
      kind: "created",
      snapshot: input.snapshot,
    }),
    createdAt: input.createdAt ?? new Date(),
  };

  if (!orderEvent) {
    await insertOrderEventRaw(client, data);
    return;
  }

  try {
    await orderEvent.create({ data });
  } catch (error) {
    if (isMissingOrderEventTableError(error)) {
      await insertOrderEventRaw(client, data);
      return;
    }

    throw error;
  }
}

export async function createOrderUpdatedEvent(
  client: OrderEventClient,
  input: {
    orderId: string;
    companyId: string;
    actor: OrderEventActor;
    changes: OrderEventChange[];
    productChanges?: OrderEventProductChange[];
    createdAt?: Date;
  },
) {
  if (
    input.changes.length === 0 &&
    (!input.productChanges || input.productChanges.length === 0)
  ) {
    return;
  }

  const orderEvent = getOrderEventDelegate(client);
  const data: Prisma.OrderEventUncheckedCreateInput = {
    id: crypto.randomUUID(),
    orderId: input.orderId,
    companyId: input.companyId,
    type: "UPDATED",
    actorMembershipId: input.actor.membershipId ?? null,
    actorName: input.actor.name ?? null,
    actorEmail: input.actor.email ?? null,
    actorSource: input.actor.source ?? "USER",
    payload: payloadToJson({
      kind: "updated",
      changes: input.changes,
      productChanges: input.productChanges ?? [],
    }),
    createdAt: input.createdAt ?? new Date(),
  };

  if (!orderEvent) {
    await insertOrderEventRaw(client, data);
    return;
  }

  try {
    await orderEvent.create({ data });
  } catch (error) {
    if (isMissingOrderEventTableError(error)) {
      await insertOrderEventRaw(client, data);
      return;
    }

    throw error;
  }
}

export async function createOrderStatusChangedEvent(
  client: OrderEventClient,
  input: {
    orderId: string;
    companyId: string;
    actor: OrderEventActor;
    fromStatus: string | null | undefined;
    toStatus: string | null | undefined;
    note?: string | null;
    createdAt?: Date;
  },
) {
  const fromStatus = normalizeString(input.fromStatus) ?? "-";
  const toStatus = normalizeString(input.toStatus) ?? "-";

  if (fromStatus === toStatus) {
    return;
  }

  const orderEvent = getOrderEventDelegate(client);
  const data: Prisma.OrderEventUncheckedCreateInput = {
    id: crypto.randomUUID(),
    orderId: input.orderId,
    companyId: input.companyId,
    type: "STATUS_CHANGED",
    actorMembershipId: input.actor.membershipId ?? null,
    actorName: input.actor.name ?? null,
    actorEmail: input.actor.email ?? null,
    actorSource: input.actor.source ?? "USER",
    payload: payloadToJson({
      kind: "status_changed",
      fromStatus,
      toStatus,
      note: normalizeString(input.note),
    }),
    createdAt: input.createdAt ?? new Date(),
  };

  if (!orderEvent) {
    await insertOrderEventRaw(client, data);
    return;
  }

  try {
    await orderEvent.create({ data });
  } catch (error) {
    if (isMissingOrderEventTableError(error)) {
      await insertOrderEventRaw(client, data);
      return;
    }

    throw error;
  }
}

export async function createManyOrderStatusChangedEvents(
  client: OrderEventClient,
  input: Array<{
    orderId: string;
    companyId: string;
    actor: OrderEventActor;
    fromStatus: string | null | undefined;
    toStatus: string | null | undefined;
    note?: string | null;
    createdAt?: Date;
  }>,
) {
  const orderEvent = getOrderEventDelegate(client);

  const mappedRows = input.map((item) => {
    const fromStatus = normalizeString(item.fromStatus) ?? "-";
    const toStatus = normalizeString(item.toStatus) ?? "-";

    if (fromStatus === toStatus) {
      return null;
    }

    return {
      orderId: item.orderId,
      companyId: item.companyId,
      type: "STATUS_CHANGED" as const,
      actorMembershipId: item.actor.membershipId ?? null,
      actorName: item.actor.name ?? null,
      actorEmail: item.actor.email ?? null,
      actorSource: item.actor.source ?? "USER",
      payload: payloadToJson({
        kind: "status_changed",
        fromStatus,
        toStatus,
        note: normalizeString(item.note),
      }),
      createdAt: item.createdAt ?? new Date(),
    };
  });

  const rows: Prisma.OrderEventCreateManyInput[] = mappedRows.filter(
    (
      row,
    ): row is Exclude<(typeof mappedRows)[number], null> => row !== null,
  );

  if (rows.length === 0) {
    return;
  }

  if (!orderEvent) {
    for (const row of rows) {
      await insertOrderEventRaw(client, {
        id: crypto.randomUUID(),
        orderId: row.orderId,
        companyId: row.companyId,
        type: row.type,
        actorMembershipId: row.actorMembershipId ?? null,
        actorName: row.actorName ?? null,
        actorEmail: row.actorEmail ?? null,
        actorSource: row.actorSource ?? null,
        payload: row.payload,
        createdAt: row.createdAt ?? new Date(),
      });
    }

    return;
  }

  try {
    if (orderEvent.createMany) {
      await orderEvent.createMany({ data: rows });
      return;
    }

    for (const row of rows) {
      await orderEvent.create({ data: row });
    }
  } catch (error) {
    if (isMissingOrderEventTableError(error)) {
      for (const row of rows) {
        await insertOrderEventRaw(client, {
          id: crypto.randomUUID(),
          orderId: row.orderId,
          companyId: row.companyId,
          type: row.type,
          actorMembershipId: row.actorMembershipId ?? null,
          actorName: row.actorName ?? null,
          actorEmail: row.actorEmail ?? null,
          actorSource: row.actorSource ?? null,
          payload: row.payload,
          createdAt: row.createdAt ?? new Date(),
        });
      }
      return;
    }

    throw error;
  }
}

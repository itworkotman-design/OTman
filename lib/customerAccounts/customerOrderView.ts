import { prisma } from "@/lib/db";
import { getOrderChargeAmountIncVatNok } from "@/lib/orders/orderTotals";
import { getCustomerEditPermissions, type CustomerEditPermissions } from "@/lib/orders/customerOrderEditPolicy";
import { editableDetailsFromOrder, type AdminOrderDetails } from "@/lib/orders/websiteOrderDetailsEdit";
import { buildOrderProgress } from "./orderProgress";
import { customerOrderProducts } from "./customerOrderProducts";

// A customer's own order as "My order" reads it. Orders are only ever found
// through the logged-in account (customerAccountId) — never by number alone.

// The order's status changes, for when each progress step was reached.
const STATUS_EVENTS = {
  where: { type: "STATUS_CHANGED" },
  orderBy: { createdAt: "asc" },
  select: { payload: true, createdAt: true },
} as const;

function statusEventsOf(events: { payload: unknown; createdAt: Date }[]) {
  return events.flatMap((event) => {
    const payload = event.payload && typeof event.payload === "object" ? (event.payload as Record<string, unknown>) : null;
    return typeof payload?.toStatus === "string" ? [{ toStatus: payload.toStatus, createdAt: event.createdAt }] : [];
  });
}

function progressOf(order: { status: string | null; createdAt: Date; events: { payload: unknown; createdAt: Date }[] }) {
  return buildOrderProgress({ status: order.status, createdAt: order.createdAt, statusEvents: statusEventsOf(order.events) });
}

export const CUSTOMER_ORDER_SELECT = {
  id: true,
  companyId: true,
  displayId: true,
  orderNumber: true,
  status: true,
  createdAt: true,
  customerName: true,
  customerLabel: true,
  statusNotes: true,
  phone: true,
  email: true,
  customerComments: true,
  description: true,
  deviation: true,
  actionToken: true,
  emailThreadToken: true,
  priceExVat: true,
  productsSummary: true,
  deliveryTypeSummary: true,
  servicesSummary: true,
  rabatt: true,
  leggTil: true,
  subcontractorMinus: true,
  subcontractorPlus: true,
  pricingSnapshot: true,
  pickupAddress: true,
  deliveryAddress: true,
  deliveryDate: true,
  timeWindow: true,
  drivingDistance: true,
  expressDelivery: true,
  floorNo: true,
  lift: true,
  extraPickupAddress: true,
  gsmSentAt: true,
  websiteOrderKind: true,
  websiteBookingDetails: true,
  productCardsSnapshot: true,
  payments: { select: { amountChargedCents: true, createdAt: true, orderSnapshot: true } },
  events: STATUS_EVENTS,
  items: {
    select: {
      cardId: true,
      itemType: true,
      productId: true,
      productCode: true,
      productName: true,
      deliveryType: true,
      optionLabel: true,
      quantity: true,
      rawData: true,
    },
  },
} as const;

export async function findCustomerOrder(accountId: string, orderNumber: string) {
  if (!orderNumber) return null;
  return prisma.order.findFirst({ where: { customerAccountId: accountId, orderNumber }, select: CUSTOMER_ORDER_SELECT });
}

export type CustomerOrder = NonNullable<Awaited<ReturnType<typeof findCustomerOrder>>>;

// What the customer edits: the full details (stops, delivery) on a homepage
// catalog order, just contact + date on the others (moving, quotes).
export type CustomerOrderDetails =
  | (AdminOrderDetails & { kind: "catalog" })
  | {
      kind: "basic";
      customer: { name: string; phone: string; email: string; comments: string };
      preferredDate: string;
      timeWindow: string;
    };

export function customerOrderDetails(order: CustomerOrder): CustomerOrderDetails {
  const full = order.websiteOrderKind === "WHITE_GOODS" ? editableDetailsFromOrder(order) : null;
  if (full) return { ...full, kind: "catalog" };
  return {
    kind: "basic",
    customer: {
      name: order.customerName ?? "",
      phone: order.phone ?? "",
      email: order.email ?? "",
      comments: order.customerComments ?? "",
    },
    preferredDate: order.deliveryDate ?? "",
    timeWindow: order.timeWindow ?? "",
  };
}

export function customerOrderTotalIncVatNok(order: {
  priceExVat: number;
  rabatt: string | null;
  leggTil: string | null;
  pricingSnapshot: unknown;
  websiteOrderKind: string | null;
}) {
  // A quote not priced yet has no total to show.
  return order.priceExVat > 0 ? getOrderChargeAmountIncVatNok(order) : null;
}

// The order as the customer sees it — nothing internal (partner prices,
// drivers, staff notes).
export function customerOrderView(order: CustomerOrder, now: Date = new Date()) {
  const permissions: CustomerEditPermissions = getCustomerEditPermissions(order, now);
  const details = customerOrderDetails(order);
  return {
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      websiteOrderKind: order.websiteOrderKind,
      customerName: order.customerName,
      phone: order.phone,
      email: order.email,
      customerComments: order.customerComments,
      pickupAddress: order.pickupAddress,
      extraPickupAddress: order.extraPickupAddress,
      deliveryAddress: order.deliveryAddress,
      deliveryDate: order.deliveryDate,
      timeWindow: order.timeWindow,
      productsSummary: order.productsSummary,
      deliveryTypeSummary: order.deliveryTypeSummary,
      servicesSummary: order.servicesSummary,
      createdAt: order.createdAt,
      totalIncVatNok: customerOrderTotalIncVatNok(order),
      progress: progressOf(order),
    },
    permissions: { ...permissions, canEditItems: permissions.canEditItems && details.kind === "catalog" },
    details,
  };
}

// The account's orders for the "My orders" list, newest first.
export async function listCustomerOrders(accountId: string) {
  const orders = await prisma.order.findMany({
    where: { customerAccountId: accountId, orderNumber: { not: null } },
    orderBy: { createdAt: "desc" },
    select: {
      orderNumber: true,
      status: true,
      createdAt: true,
      deliveryDate: true,
      timeWindow: true,
      pickupAddress: true,
      extraPickupAddress: true,
      deliveryAddress: true,
      productsSummary: true,
      deliveryTypeSummary: true,
      events: STATUS_EVENTS,
      priceExVat: true,
      rabatt: true,
      leggTil: true,
      pricingSnapshot: true,
      websiteOrderKind: true,
    },
  });
  return orders.map((order) => ({
    orderNumber: order.orderNumber as string,
    status: order.status,
    createdAt: order.createdAt,
    deliveryDate: order.deliveryDate,
    timeWindow: order.timeWindow,
    pickupAddress: order.pickupAddress,
    extraPickupCount: order.extraPickupAddress.length,
    deliveryAddress: order.deliveryAddress,
    productsSummary: order.productsSummary,
    deliveryTypeSummary: order.deliveryTypeSummary,
    totalIncVatNok: customerOrderTotalIncVatNok(order),
    progress: progressOf(order),
  }));
}

// The order's products for the "Varer og tjenester" tiles, with each
// product's icon key (Product.iconKey) looked up.
export async function findCustomerOrderProducts(order: Pick<CustomerOrder, "items">) {
  const ids = [...new Set(order.items.map((item) => item.productId).filter((id): id is string => !!id))];
  const products = ids.length > 0 ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, iconKey: true } }) : [];
  return customerOrderProducts(order.items, products);
}

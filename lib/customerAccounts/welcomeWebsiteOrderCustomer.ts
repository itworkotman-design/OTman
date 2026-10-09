import { prisma } from "@/lib/db";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { sendOrderReceivedEmail } from "@/lib/orders/sendOrderReceivedEmail";
import type { LifecycleEmailOrderInput } from "@/lib/orders/sendCustomerLifecycleEmail";
import type { OrderReceivedDetails } from "@/lib/orders/customerLifecycleEmails";
import { getOrderChargeAmountIncVatNok } from "@/lib/orders/orderTotals";
import { parseWhiteGoodsBookingDetails, withLiveOrderFields } from "@/lib/orders/websiteBookingDetails";
import { ensureCustomerAccountForOrder } from "./ensureCustomerAccount";

// The saved order row, as the order routes pass it. The detail fields are
// optional so a caller can't break the email by passing a narrower order.
export type WelcomeOrder = LifecycleEmailOrderInput & {
  deliveryDate?: string | null;
  timeWindow?: string | null;
  phone?: string | null;
  pickupAddress?: string | null;
  extraPickupAddress?: string[];
  deliveryAddress?: string | null;
  returnAddress?: string | null;
  floorNo?: string | null;
  lift?: string | null;
  productsSummary?: string | null;
  deliveryTypeSummary?: string | null;
  servicesSummary?: string | null;
  customerComments?: string | null;
  priceExVat?: number;
  rabatt?: string | null;
  leggTil?: string | null;
  pricingSnapshot?: unknown;
  websiteOrderKind?: string | null;
  drivingDistance?: string | null;
  websiteBookingDetails?: unknown;
};

// Every pickup stop and the delivery as booked (homepage white-goods orders
// only), with the order's current addresses laid on top.
function bookedStops(order: WelcomeOrder): Pick<OrderReceivedDetails, "pickups" | "delivery"> {
  const booked = parseWhiteGoodsBookingDetails(order.websiteBookingDetails);
  if (!booked || booked.pickups.length === 0) return {};
  const { pickups, delivery } = withLiveOrderFields(booked, {
    pickupAddress: order.pickupAddress ?? null,
    deliveryAddress: order.deliveryAddress ?? null,
    extraPickupAddress: order.extraPickupAddress ?? [],
    deliveryDate: order.deliveryDate ?? null,
    timeWindow: order.timeWindow ?? null,
    drivingDistance: order.drivingDistance ?? null,
  });
  return { pickups, delivery };
}

function orderReceivedDetails(order: WelcomeOrder): OrderReceivedDetails {
  return {
    ...bookedStops(order),
    deliveryDate: order.deliveryDate ?? null,
    timeWindow: order.timeWindow ?? null,
    customerName: order.customerName,
    phone: order.phone ?? null,
    email: order.email,
    pickupAddress: order.pickupAddress ?? null,
    extraPickupAddress: order.extraPickupAddress ?? [],
    deliveryAddress: order.deliveryAddress ?? null,
    returnAddress: order.returnAddress ?? null,
    floorNo: order.floorNo ?? null,
    lift: order.lift ?? null,
    productsSummary: order.productsSummary ?? null,
    deliveryTypeSummary: order.deliveryTypeSummary ?? null,
    servicesSummary: order.servicesSummary ?? null,
    customerComments: order.customerComments ?? null,
    // A quote not priced yet has no total to show.
    totalIncVatNok:
      order.priceExVat && order.priceExVat > 0
        ? getOrderChargeAmountIncVatNok({
            priceExVat: order.priceExVat,
            rabatt: order.rabatt ?? null,
            leggTil: order.leggTil ?? null,
            pricingSnapshot: order.pricingSnapshot ?? null,
            websiteOrderKind: order.websiteOrderKind ?? null,
          })
        : null,
  };
}

// Called by every homepage order route right after the order is saved: links
// the order to the customer's temporary "My order" account (creating it), then
// sends the ONE order-received email — confirmation, login (username and, for
// a new account, the password), what can be changed until when, and the order
// details. Never throws: the order already exists, so any failure only raises
// a staff alert.
export async function welcomeWebsiteOrderCustomer(order: WelcomeOrder): Promise<void> {
  let account: Awaited<ReturnType<typeof ensureCustomerAccountForOrder>> = null;
  try {
    account = await ensureCustomerAccountForOrder({ orderId: order.id, email: order.email });
  } catch (error) {
    console.error("[welcome customer] Could not create the customer account", order.id, error);
    try {
      await createOrderNotification(prisma, {
        orderId: order.id,
        companyId: order.companyId,
        type: "MANUAL_REVIEW",
        title: "Customer login NOT created",
        message: `No "My order" login could be created for order ${order.orderNumber ?? order.displayId}. Use "Send new login" on the order.`,
      });
    } catch (alertError) {
      console.error("[welcome customer] Could not raise staff alert", order.id, alertError);
    }
  }

  await sendOrderReceivedEmail({
    ...order,
    orderDetails: orderReceivedDetails(order),
    ...(account ? { customerLogin: { email: account.email, password: account.newPassword } } : {}),
  });
}

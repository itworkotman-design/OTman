import { prisma } from "@/lib/db";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { sendLifecycleEmailsForOrders, type LifecycleEmailOrderInput } from "@/lib/orders/sendCustomerLifecycleEmail";

// "We got your order" email, called by every homepage order route right after
// the order row is saved. It can't fail the submission — the order already
// exists — but the customer must never be silently left without it, so any
// failure (Gmail error, or an order with no email) raises a staff notification
// on the order. The failed attempt is also on the order as a FAILED
// OrderEmailMessage, and staff can resend it (kind order_received) from the
// lifecycle-email route.
export async function sendOrderReceivedEmail(order: LifecycleEmailOrderInput): Promise<void> {
  const reference = order.orderNumber ?? String(order.displayId ?? order.id);

  if (!order.email) {
    await alertStaff(order, `Order ${reference} has no email, so the customer got NO order-received confirmation. Contact them another way.`);
    return;
  }

  try {
    const { failedOrderIds } = await sendLifecycleEmailsForOrders({
      orders: [order],
      kind: "order_received",
      actor: { source: "SYSTEM", name: "Website" },
    });

    if (failedOrderIds.length > 0) {
      await alertStaff(order, `The order-received email for order ${reference} FAILED to send to ${order.email}. The customer has not been notified — resend it or contact them.`);
    }
  } catch (error) {
    console.error("[order-received email] Failed to send", order.id, error);
    await alertStaff(order, `The order-received email for order ${reference} FAILED to send to ${order.email}. The customer has not been notified — resend it or contact them.`);
  }
}

async function alertStaff(order: LifecycleEmailOrderInput, message: string): Promise<void> {
  try {
    await createOrderNotification(prisma, {
      orderId: order.id,
      companyId: order.companyId,
      type: "MANUAL_REVIEW",
      title: "Order-received email NOT sent",
      message,
    });
  } catch (error) {
    console.error("[order-received email] Could not raise staff alert", order.id, error);
  }
}

import { prisma } from "@/lib/db";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { sendLifecycleEmailsForOrders, type LifecycleEmailOrderInput } from "@/lib/orders/sendCustomerLifecycleEmail";

// The one "we got your order" email, called by every homepage order route
// right after the order row is saved (through welcomeWebsiteOrderCustomer),
// sent through the company Gmail like every other order email. With a new
// "My order" password in it, the copy logged on the order has the password
// masked (sendLifecycleEmailsForOrders). It can't fail the submission — the
// order already exists — but the customer must never be silently left
// without it, so any failure (Gmail error, or an order with no email) raises
// a staff notification on the order. The failed attempt is also on the order
// as a FAILED OrderEmailMessage, and staff can resend it (kind
// order_received) from the lifecycle-email route.
export async function sendOrderReceivedEmail(order: LifecycleEmailOrderInput): Promise<void> {
  const reference = order.orderNumber ?? String(order.displayId ?? order.id);
  const hasPassword = Boolean(order.customerLogin?.password);
  const failedMessage = hasPassword
    ? `The order-received email (with the "My order" login) for order ${reference} FAILED to send to ${order.email}. The customer has not been notified — use "Send new login" on the order and contact them.`
    : `The order-received email for order ${reference} FAILED to send to ${order.email}. The customer has not been notified — resend it or contact them.`;

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
      await alertStaff(order, failedMessage);
    }
  } catch (error) {
    // The error text could echo the request, and so the password.
    if (hasPassword) console.error("[order-received email] Failed to send", order.id);
    else console.error("[order-received email] Failed to send", order.id, error);
    await alertStaff(order, failedMessage);
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

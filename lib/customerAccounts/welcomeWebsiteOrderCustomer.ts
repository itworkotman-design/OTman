import { prisma } from "@/lib/db";
import { createOrderNotification } from "@/lib/orders/orderNotifications";
import { sendOrderReceivedEmail } from "@/lib/orders/sendOrderReceivedEmail";
import type { LifecycleEmailOrderInput } from "@/lib/orders/sendCustomerLifecycleEmail";
import { ensureCustomerAccountForOrder } from "./ensureCustomerAccount";
import { sendCustomerCredentialsEmail } from "./customerCredentialsEmail";

// Called by every homepage order route right after the order is saved: links
// the order to the customer's temporary "My order" account (creating it),
// sends the order-received email with the login link and username, and — when
// a password was just set — the password in its own email. Never throws: the
// order already exists, so any failure only raises a staff alert.
export async function welcomeWebsiteOrderCustomer(order: LifecycleEmailOrderInput): Promise<void> {
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

  await sendOrderReceivedEmail(
    account ? { ...order, customerLogin: { email: account.email, hasNewPassword: account.newPassword !== null } } : order,
  );

  if (account?.newPassword) {
    await sendCustomerCredentialsEmail({
      order: {
        id: order.id,
        companyId: order.companyId,
        displayId: order.displayId,
        orderNumber: order.orderNumber ?? null,
        customerName: order.customerName,
      },
      email: account.email,
      password: account.newPassword,
    });
  }
}

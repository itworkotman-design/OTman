import { prisma } from "@/lib/db";
import { createOrderNotification } from "@/lib/orders/orderNotifications";

// Something went wrong on an order that staff must see — an email to the
// customer that didn't go out, a Stripe payment that couldn't be recorded or
// arrived late. Shown as a review notification on the order (Alert Center →
// Notifications), not just a server log line. Never throws: an alert must not
// break the thing it reports on.
export async function alertStaff(input: { orderId: string; companyId?: string; title: string; message: string }): Promise<void> {
  try {
    const companyId =
      input.companyId ?? (await prisma.order.findUnique({ where: { id: input.orderId }, select: { companyId: true } }))?.companyId;
    if (!companyId) return;
    await createOrderNotification(prisma, {
      orderId: input.orderId,
      companyId,
      type: "MANUAL_REVIEW",
      title: input.title,
      message: input.message,
    });
  } catch (error) {
    console.error("[staff alert] Could not create the alert", input.orderId, input.title, error);
  }
}

// Read-only: checks that every homepage order's prices agree everywhere
// (lib/orders/websitePriceConsistency.ts) — the lines vs the charged total,
// the booking charge vs what the customer was shown, and the payment badge.
// Writes nothing.
//
//   npm run check:website-prices                  (uses .env.local)
//   ENV_FILE=.env npm run check:website-prices    (another env file)
import { config } from "dotenv";

config({ path: process.env.ENV_FILE ?? ".env.local" });

async function main() {
  const { prisma } = await import("@/lib/db");
  const { buildOrderStateSnapshot } = await import("@/lib/orders/paidOrderSnapshot");
  const { ORDER_STATE_SOURCE_SELECT } = await import("@/lib/orders/paidOrderSnapshot");
  const { ORDER_PAYMENT_LEDGER_SELECT } = await import("@/lib/orders/orderPayments");
  const { isClosedOrderStatus } = await import("@/lib/orders/statusPresentation");
  const { isManualPaymentMode } = await import("@/lib/orders/paymentMode");
  const { checkWebsiteOrderPricing } = await import("@/lib/orders/websitePriceConsistency");

  console.log("DB host:", new URL(process.env.DATABASE_URL ?? "").host);

  const orders = await prisma.order.findMany({
    where: { isWebsiteOrder: true, gdprAnonymized: false },
    select: {
      ...ORDER_STATE_SOURCE_SELECT,
      displayId: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      payments: { select: ORDER_PAYMENT_LEDGER_SELECT },
    },
    orderBy: { displayId: "asc" },
  });

  const stripe = !isManualPaymentMode();
  let withIssues = 0;
  for (const order of orders) {
    const details = order.websiteBookingDetails as { shownTotal?: unknown } | null;
    const issues = checkWebsiteOrderPricing({
      current: buildOrderStateSnapshot({ ...order, extraPickupAddress: order.extraPickupAddress ?? [] }),
      shownTotalIncVat: typeof details?.shownTotal === "number" ? details.shownTotal : null,
      payments: order.payments,
      paymentStatus: order.paymentStatus,
      closed: isClosedOrderStatus(order.status),
      stripe,
    });
    if (issues.length === 0) continue;
    withIssues += 1;
    console.log(`#${order.orderNumber ?? order.displayId} (${order.status}):`);
    for (const issue of issues) console.log(`  ${issue.code}: ${issue.detail}`);
  }
  console.log(`\nChecked ${orders.length} homepage orders (payments: ${stripe ? "stripe" : "manual"}); ${withIssues} with issues.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

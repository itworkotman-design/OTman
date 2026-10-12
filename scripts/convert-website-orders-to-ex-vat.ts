import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { getOrderChargeAmountIncVatNok } from "../lib/orders/orderTotals";
import { convertWebsiteOrderToExVat } from "../lib/orders/websiteOrderExVatConversion";

// One-time: homepage (WHITE_GOODS) orders stored before website prices became
// ex. VAT get every customer amount divided by 1.25 (see
// lib/orders/websiteOrderExVatConversion.ts). What each customer is charged
// stays exactly the same — checked per order before anything is written.
//
// Dry run by default (prints what would change). Writes only with --apply:
//   npx tsx --tsconfig tsconfig.json scripts/convert-website-orders-to-ex-vat.ts
//   npx tsx --tsconfig tsconfig.json scripts/convert-website-orders-to-ex-vat.ts --apply
// The database is DATABASE_URL (DOTENV_CONFIG_PATH picks the .env file).
// Already-converted orders (pricingSnapshot.vatBasis "exVat") are skipped,
// so running it twice is safe.

const apply = process.argv.includes("--apply");

async function main() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host;
    } catch {
      return "(unknown)";
    }
  })();
  console.log(`${apply ? "APPLYING" : "DRY RUN"} against ${host}`);

  const orders = await prisma.order.findMany({
    where: { websiteOrderKind: "WHITE_GOODS" },
    orderBy: { displayId: "asc" },
    select: {
      id: true,
      displayId: true,
      websiteOrderKind: true,
      priceExVat: true,
      rabatt: true,
      leggTil: true,
      pricingSnapshot: true,
      websiteBookingDetails: true,
      productCardsSnapshot: true,
      items: { select: { id: true, customerPriceCents: true } },
    },
  });

  let converted = 0;
  let skipped = 0;
  let refused = 0;
  for (const order of orders) {
    const result = convertWebsiteOrderToExVat(order);
    if (result.skip) {
      skipped += 1;
      console.log(`#${order.displayId}: skipped (${result.skip})`);
      continue;
    }

    // Before the switch a website order was charged its stored (incl.-VAT) total as is.
    const oldCharge = (() => {
      const customer = (order.pricingSnapshot as { customer?: { totalExVat?: unknown } } | null)?.customer;
      return typeof customer?.totalExVat === "number" ? customer.totalExVat : order.priceExVat;
    })();
    const chargedAfter = getOrderChargeAmountIncVatNok({ ...order, ...result.order });
    if (Math.abs(chargedAfter - oldCharge) >= 0.005) {
      refused += 1;
      console.log(`#${order.displayId}: REFUSED — the charge would move from ${oldCharge} to ${chargedAfter}`);
      continue;
    }

    console.log(
      `#${order.displayId}: total ${order.priceExVat} → ${result.order.priceExVat} ex. VAT, customer still pays ${chargedAfter}` +
        (result.inexact.length ? ` (rounded to øre: ${result.inexact.join(", ")})` : ""),
    );
    if (apply) {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            priceExVat: result.order.priceExVat,
            rabatt: result.order.rabatt,
            leggTil: result.order.leggTil,
            pricingSnapshot: result.order.pricingSnapshot as Prisma.InputJsonValue,
            websiteBookingDetails: (result.order.websiteBookingDetails ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            productCardsSnapshot: (result.order.productCardsSnapshot ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          },
        }),
        ...result.items.map((item) => prisma.orderItem.update({ where: { id: item.id }, data: { customerPriceCents: item.customerPriceCents } })),
      ]);
    }
    converted += 1;
  }

  console.log(
    `${apply ? "Converted" : "Would convert"} ${converted}, skipped ${skipped}, refused ${refused} (of ${orders.length} website orders).`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import {
  cleanWebsiteDeliveryTypes,
  cleanWebsiteExVatPrice,
  cleanWebsitePriceListSettings,
} from "../lib/booking/pricing/websiteCleanPrice";
import { parsePriceListSettings, serializePriceListSettings } from "../lib/products/priceListSettings";

// One-time: every customer price on the website price lists (code WEBSITE_*)
// is raised to a multiple of 8 kr ex. VAT, so what a private customer sees
// (+25%) ends in 0 — 260 (325) → 264 (330). See
// lib/booking/pricing/websiteCleanPrice.ts. Partner (subcontractor) prices and
// the per-km rates are left alone. Existing orders keep their frozen prices.
//
// Dry run by default (prints what would change). Writes only with --apply:
//   npx tsx --tsconfig tsconfig.json scripts/clean-website-prices.ts
//   npx tsx --tsconfig tsconfig.json scripts/clean-website-prices.ts --apply
// The database is DATABASE_URL (DOTENV_CONFIG_PATH picks the .env file).
// Already-clean prices are untouched, so running it twice is safe.

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

  const priceLists = await prisma.priceList.findMany({
    where: { code: { startsWith: "WEBSITE_" } },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      description: true,
      items: {
        select: {
          id: true,
          customerPriceCents: true,
          discountAmountCents: true,
          discountEndsAt: true,
          productOption: { select: { code: true, pricingMode: true, productId: true, product: { select: { code: true } } } },
        },
      },
      deliveryOnlyProducts: { select: { productId: true } },
      specialOptions: { select: { id: true, code: true, customerPrice: true } },
    },
  });
  const websiteListIds = new Set(priceLists.map((list) => list.id));

  // Run one by one inside the transaction (see the end of main).
  const writes: ((tx: Prisma.TransactionClient) => Promise<unknown>)[] = [];
  const productIds = new Set<string>();
  const warnings: string[] = [];

  for (const list of priceLists) {
    console.log(`\n== ${list.code}`);

    for (const item of list.items) {
      productIds.add(item.productOption.productId);
      const label = `${item.productOption.product.code}/${item.productOption.code}`;
      if (item.productOption.pricingMode !== "FIXED") {
        warnings.push(`${list.code} ${label}: ${item.productOption.pricingMode} option left alone (its total depends on weight/size)`);
        continue;
      }
      if (item.discountAmountCents && item.discountEndsAt && item.discountEndsAt > new Date()) {
        warnings.push(`${list.code} ${label}: has an active discount of ${item.discountAmountCents / 100} kr — the discounted price won't end in 0`);
      }
      const cleanedCents = Math.round(cleanWebsiteExVatPrice(item.customerPriceCents / 100) * 100);
      if (cleanedCents === item.customerPriceCents) continue;
      console.log(`  option ${label}: ${item.customerPriceCents / 100} → ${cleanedCents / 100} (customer ${(cleanedCents / 100) * 1.25})`);
      writes.push((tx) => tx.priceListItem.update({ where: { id: item.id }, data: { customerPriceCents: cleanedCents } }));
    }

    for (const option of list.specialOptions) {
      const current = Number(option.customerPrice);
      const cleaned = cleanWebsiteExVatPrice(current);
      if (cleaned === current) continue;
      console.log(`  special option ${option.code}: ${current} → ${cleaned}`);
      writes.push((tx) => tx.priceListSpecialOption.update({ where: { id: option.id }, data: { customerPrice: cleaned } }));
    }

    const settings = parsePriceListSettings(list.description);
    const before = serializePriceListSettings(settings);
    const cleanedSettings = cleanWebsitePriceListSettings(settings);
    const after = serializePriceListSettings(cleanedSettings);
    if (after !== before) {
      for (const key of ["extraPickup", "expressDelivery", "xtraPallet", "extraWork", "addToOrder", "floorSurcharge"] as const) {
        if (settings[key].price !== cleanedSettings[key].price) {
          console.log(`  fee ${key}: ${settings[key].price} → ${cleanedSettings[key].price}`);
        }
      }
      for (const [key, fee] of Object.entries(cleanedSettings.deviations)) {
        if (settings.deviations[key]?.price !== fee.price) console.log(`  deviation ${key}: ${settings.deviations[key]?.price} → ${fee.price}`);
      }
      writes.push((tx) => tx.priceList.update({ where: { id: list.id }, data: { description: after } }));
    }
    for (const link of list.deliveryOnlyProducts) productIds.add(link.productId);
  }

  // Delivery-type prices live on Product (one row shared by every list that
  // prices it), so a product also priced on a non-website list is skipped.
  const products = await prisma.product.findMany({
    where: { id: { in: [...productIds] } },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      deliveryTypes: true,
      autoDeliveryPrice: true,
      options: { select: { priceListItems: { select: { priceListId: true } } } },
      priceListProducts: { select: { priceListId: true } },
    },
  });
  console.log(`\n== delivery types`);
  for (const product of products) {
    const listIds = [
      ...product.options.flatMap((o) => o.priceListItems.map((i) => i.priceListId)),
      ...product.priceListProducts.map((p) => p.priceListId),
    ];
    if (listIds.some((id) => !websiteListIds.has(id))) {
      warnings.push(`${product.code}: also priced on a non-website price list — delivery prices left alone`);
      continue;
    }
    const cleaned = cleanWebsiteDeliveryTypes(product.deliveryTypes);
    if (JSON.stringify(cleaned) === JSON.stringify(product.deliveryTypes)) continue;
    const changes = (Array.isArray(product.deliveryTypes) ? product.deliveryTypes : []).flatMap((entry, i) => {
      const a = entry as Record<string, unknown>;
      const b = (cleaned as Record<string, unknown>[])[i];
      return ["price", "xtraPrice"].filter((f) => a[f] !== b[f]).map((f) => `${a.key}.${f} ${a[f]} → ${b[f]}`);
    });
    console.log(`  ${product.code}: ${changes.join(", ")}`);
    writes.push((tx) => tx.product.update({ where: { id: product.id }, data: { deliveryTypes: cleaned as Prisma.InputJsonValue } }));
  }

  if (warnings.length) console.log(`\n== left alone\n  ${warnings.join("\n  ")}`);

  // Hundreds of single-row updates over a remote connection take well over
  // Prisma's default 5 s transaction timeout.
  if (apply && writes.length) {
    await prisma.$transaction(
      async (tx) => {
        for (const write of writes) await write(tx);
      },
      { maxWait: 20_000, timeout: 300_000 },
    );
  }
  console.log(`\n${apply ? "Wrote" : "Would write"} ${writes.length} rows.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

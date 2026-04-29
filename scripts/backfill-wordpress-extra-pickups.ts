import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import {
  buildWordpressExtraPickupContacts,
  normalizeWordpressExtraPickups,
} from "../lib/integrations/wordpress/orderMeta";

const BATCH_SIZE = 100;

function hasStoredContacts(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

async function main() {
  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;
  let skippedAlreadyNormalized = 0;
  let skippedNoExtraPickups = 0;
  let failed = 0;

  for (;;) {
    const orders = await prisma.order.findMany({
      where: {
        legacyWordpressOrderId: {
          not: null,
        },
        legacyWordpressRawMeta: {
          not: Prisma.JsonNull,
        },
      },
      select: {
        id: true,
        displayId: true,
        legacyWordpressOrderId: true,
        legacyWordpressRawMeta: true,
        extraPickupAddress: true,
        extraPickupContacts: true,
      },
      orderBy: {
        id: "asc",
      },
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: BATCH_SIZE,
    });

    if (orders.length === 0) {
      break;
    }

    for (const order of orders) {
      scanned += 1;

      const hasAddresses = order.extraPickupAddress.length > 0;
      const hasContacts = hasStoredContacts(order.extraPickupContacts);

      if (hasAddresses && hasContacts) {
        skippedAlreadyNormalized += 1;
        continue;
      }

      const normalized = normalizeWordpressExtraPickups(
        order.legacyWordpressRawMeta,
      );
      const addresses = hasAddresses
        ? order.extraPickupAddress
        : normalized.addresses;

      if (addresses.length === 0) {
        skippedNoExtraPickups += 1;
        continue;
      }

      const data: Prisma.OrderUpdateInput = {};

      if (!hasAddresses) {
        data.extraPickupAddress = addresses;
      }

      if (!hasContacts) {
        data.extraPickupContacts = buildWordpressExtraPickupContacts(
          addresses,
        ) as unknown as Prisma.InputJsonValue;
      }

      try {
        await prisma.order.update({
          where: {
            id: order.id,
          },
          data,
        });
        updated += 1;
      } catch (error) {
        failed += 1;
        console.error("WordPress extra pickup backfill failed", {
          orderId: order.id,
          displayId: order.displayId,
          legacyWordpressOrderId: order.legacyWordpressOrderId,
          error,
        });
      }
    }

    cursor = orders[orders.length - 1]?.id;
  }

  console.log("WordPress extra pickup backfill complete", {
    scanned,
    updated,
    skippedAlreadyNormalized,
    skippedNoExtraPickups,
    failed,
  });
}

main()
  .catch((error) => {
    console.error("WordPress extra pickup backfill crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

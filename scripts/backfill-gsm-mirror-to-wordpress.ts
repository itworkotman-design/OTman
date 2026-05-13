import "dotenv/config";
import { prisma } from "../lib/db";
import { mirrorGsmUpdateToWordpress } from "../lib/integrations/wordpress/mirrorGsmUpdateToWordpress";

const BATCH_SIZE = 100;

type BackfillMode = "dry-run" | "apply";

function getMode(): BackfillMode {
  return process.argv.includes("--apply") ? "apply" : "dry-run";
}

function getLimit(): number | null {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  if (!limitArg) return null;

  const parsed = Number.parseInt(limitArg.replace("--limit=", ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function main() {
  const mode = getMode();
  const limit = getLimit();
  let cursor: string | undefined;
  let scanned = 0;
  let mirrored = 0;
  let skippedMissingLegacyId = 0;
  let failed = 0;

  console.log("GSM to WordPress mirror backfill starting", {
    mode,
    dryRun: mode !== "apply",
    limit,
  });

  for (;;) {
    const remaining = limit === null ? BATCH_SIZE : Math.min(BATCH_SIZE, limit - scanned);
    if (remaining <= 0) {
      break;
    }

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          {
            gsmLastWebhookAt: {
              not: null,
            },
          },
          {
            gsmTasks: {
              some: {
                lastWebhookAt: {
                  not: null,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        legacyWordpressOrderId: true,
        status: true,
        statusNotes: true,
        driver: true,
        secondDriver: true,
        driverInfo: true,
        licensePlate: true,
        deviation: true,
        feeExtraWork: true,
        extraWorkMinutes: true,
        feeAddToOrder: true,
        rabatt: true,
        leggTil: true,
        subcontractorMinus: true,
        subcontractorPlus: true,
        completedAt: true,
        orderAttachments: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            category: true,
            source: true,
            gsmTaskId: true,
            gsmDocumentId: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        gsmTasks: {
          select: {
            gsmTaskId: true,
            lastWebhookAt: true,
          },
          orderBy: {
            lastWebhookAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        id: "asc",
      },
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: remaining,
    });

    if (orders.length === 0) {
      break;
    }

    for (const order of orders) {
      scanned += 1;

      if (!order.legacyWordpressOrderId) {
        skippedMissingLegacyId += 1;
        console.warn("Skipping GSM mirror backfill without legacy WordPress id", {
          orderId: order.id,
        });
        continue;
      }

      const latestGsmTask = order.gsmTasks[0];

      if (mode !== "apply") {
        console.log("Dry-run: would mirror GSM order update to WordPress", {
          orderId: order.id,
          legacyWordpressOrderId: order.legacyWordpressOrderId,
          status: order.status,
          attachmentCount: order.orderAttachments.length,
          gsmTaskId: latestGsmTask?.gsmTaskId ?? null,
        });
        continue;
      }

      try {
        await mirrorGsmUpdateToWordpress({
          legacyWordpressOrderId: order.legacyWordpressOrderId,
          orderId: order.id,
          status: order.status,
          statusNotes: order.statusNotes,
          driver: order.driver,
          secondDriver: order.secondDriver,
          driverInfo: order.driverInfo,
          licensePlate: order.licensePlate,
          deviation: order.deviation,
          feeExtraWork: order.feeExtraWork,
          extraWorkMinutes: order.extraWorkMinutes,
          feeAddToOrder: order.feeAddToOrder,
          rabatt: order.rabatt,
          leggTil: order.leggTil,
          subcontractorMinus: order.subcontractorMinus,
          subcontractorPlus: order.subcontractorPlus,
          completedAt: order.completedAt,
          gsmTaskId: latestGsmTask?.gsmTaskId ?? null,
          attachments: order.orderAttachments,
        });

        mirrored += 1;
        console.log("Mirrored GSM order update to WordPress", {
          orderId: order.id,
          legacyWordpressOrderId: order.legacyWordpressOrderId,
          attachmentCount: order.orderAttachments.length,
        });
      } catch (error) {
        failed += 1;
        console.error("Failed to mirror GSM order update to WordPress", {
          orderId: order.id,
          legacyWordpressOrderId: order.legacyWordpressOrderId,
          error,
        });
      }
    }

    cursor = orders[orders.length - 1]?.id;
  }

  console.log("GSM to WordPress mirror backfill complete", {
    mode,
    scanned,
    mirrored,
    skippedMissingLegacyId,
    failed,
  });
}

main()
  .catch((error) => {
    console.error("GSM to WordPress mirror backfill crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

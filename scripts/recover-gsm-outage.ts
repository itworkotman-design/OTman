import "dotenv/config";
import { prisma } from "../lib/db";
import { fetchGsmTask } from "../lib/integrations/gsm/fetchTask";
import { syncPodPdfWithRetry } from "../lib/integrations/gsm/downloadPodPdf";

// Recovers GSM tasks whose webhooks arrived while GSM API auth was failing:
// the webhook was stored and acknowledged, but the fresh task fetch (driver,
// subcontractor, license plate) and the POD PDF download never happened.

type Mode = "dry-run" | "apply";

type GsmTask = Record<string, unknown>;

function getMode(): Mode {
  return process.argv.includes("--apply") ? "apply" : "dry-run";
}

function getSince(): Date {
  const index = process.argv.indexOf("--since");
  const raw = index >= 0 ? process.argv[index + 1] : undefined;
  if (!raw) {
    throw new Error(
      'Missing --since, e.g. --since "2026-10-06T14:45:00+02:00"',
    );
  }
  const since = new Date(raw);
  if (Number.isNaN(since.getTime())) {
    throw new Error(`Invalid --since date: ${raw}`);
  }
  return since;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getMetafields(task: GsmTask): Record<string, unknown> {
  const metafields = task.metafields;
  return metafields && typeof metafields === "object" && !Array.isArray(metafields)
    ? (metafields as Record<string, unknown>)
    : {};
}

// Mirrors the field sources used by app/api/integrations/gsm/webhook/route.ts.
function getGsmFields(task: GsmTask) {
  const metafields = getMetafields(task);
  return {
    state: getString(task.state),
    driver:
      getString(task.assignee_name) ??
      getString(metafields["app:name"]) ??
      getString(metafields.driver),
    secondDriver:
      getString(metafields["app:driver2"]) ?? getString(metafields.driver2),
    licensePlate:
      getString(metafields["app:carnumber"]) ?? getString(metafields.carnumber),
    subcontractor: getString(metafields["sub:contr"]),
  };
}

function getDatabaseHost() {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function main() {
  const mode = getMode();
  const since = getSince();

  console.log(`Mode: ${mode}`);
  console.log(`Database: ${getDatabaseHost()}`);
  console.log(`Tasks with webhooks since: ${since.toISOString()}`);

  const tasks = await prisma.orderGsmTask.findMany({
    where: { lastWebhookAt: { gte: since } },
    orderBy: { lastWebhookAt: "asc" },
    select: {
      gsmTaskId: true,
      state: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          displayId: true,
          status: true,
          driver: true,
          secondDriver: true,
          licensePlate: true,
          subcontractor: true,
        },
      },
    },
  });

  console.log(`Found ${tasks.length} task(s)\n`);

  const summary = {
    podsRecovered: 0,
    podsAlreadyPresent: 0,
    podsFailed: 0,
    ordersFilled: 0,
    fetchFailed: 0,
    needsReview: 0,
  };

  for (const task of tasks) {
    const order = task.order;
    const label = `order ${order.orderNumber ?? order.displayId ?? order.id} / task ${task.gsmTaskId}`;

    let gsmTask: GsmTask;
    try {
      gsmTask = await fetchGsmTask(task.gsmTaskId);
    } catch (error) {
      summary.fetchFailed += 1;
      console.error(`[FETCH FAILED] ${label}`, error);
      continue;
    }

    const gsm = getGsmFields(gsmTask);
    console.log(
      `${label}: GSM state=${gsm.state ?? "-"}, local state=${task.state ?? "-"}, order status=${order.status ?? "-"}`,
    );

    // Only fill fields that are empty locally — never overwrite manual edits.
    const fill: Record<string, string> = {};
    if (!order.driver && gsm.driver) fill.driver = gsm.driver;
    if (!order.secondDriver && gsm.secondDriver) fill.secondDriver = gsm.secondDriver;
    if (!order.licensePlate && gsm.licensePlate) fill.licensePlate = gsm.licensePlate;
    if (!order.subcontractor && gsm.subcontractor) fill.subcontractor = gsm.subcontractor;

    for (const [field, gsmValue] of [
      ["driver", gsm.driver],
      ["subcontractor", gsm.subcontractor],
      ["licensePlate", gsm.licensePlate],
    ] as const) {
      const localValue = order[field];
      if (localValue && gsmValue && localValue !== gsmValue) {
        summary.needsReview += 1;
        console.log(
          `  [REVIEW] ${field} differs: order="${localValue}" GSM="${gsmValue}"`,
        );
      }
    }

    if (Object.keys(fill).length > 0) {
      console.log(`  [FILL] ${JSON.stringify(fill)}`);
      if (fill.subcontractor) {
        console.log(
          "  [REVIEW] subcontractor filled by name only — link the subcontractor profile manually if needed",
        );
        summary.needsReview += 1;
      }
      if (mode === "apply") {
        await prisma.order.update({ where: { id: order.id }, data: fill });
      }
      summary.ordersFilled += 1;
    }

    if (gsm.state && gsm.state !== task.state) {
      console.log(`  [STATE] local task state ${task.state ?? "-"} -> ${gsm.state}`);
      if (mode === "apply") {
        await prisma.orderGsmTask.update({
          where: { gsmTaskId: task.gsmTaskId },
          data: { state: gsm.state, lastSyncedAt: new Date() },
        });
      }
    }

    if (gsm.state !== "completed") continue;

    const existingPod = await prisma.orderAttachment.findFirst({
      where: {
        orderId: order.id,
        gsmTaskId: task.gsmTaskId,
        gsmDocumentId: `pod:${task.gsmTaskId}`,
      },
      select: { id: true },
    });

    if (existingPod) {
      summary.podsAlreadyPresent += 1;
      continue;
    }

    console.log("  [POD] missing — will download");
    if (mode === "apply") {
      try {
        // Waits 8s+ before the first fetch; fine for a one-off recovery.
        await syncPodPdfWithRetry(order.id, task.gsmTaskId);
        summary.podsRecovered += 1;
        console.log("  [POD] recovered");
      } catch (error) {
        summary.podsFailed += 1;
        console.error("  [POD] failed", error);
      }
    } else {
      summary.podsRecovered += 1;
    }
  }

  console.log("\nSummary", mode === "dry-run" ? "(dry run — nothing written)" : "", summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

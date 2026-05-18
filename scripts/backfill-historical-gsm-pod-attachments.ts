import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { getGsmToken } from "../lib/integrations/gsm/client";
import {
  isS3AttachmentStorageConfigured,
  uploadAttachmentBufferToS3,
} from "../lib/orders/orderAttachmentStorage";

const GSM_API_BASE = process.env.GSM_API_BASE ?? "https://api.gsmtasks.com";
const GSM_API_VERSION =
  process.env.GSM_API_VERSION ?? "application/json; version=2.4.36";
const PDF_MIN_BYTES = 100;

export type BackfillMode = "dry-run" | "apply";

export type HistoricalGsmPodBackfillOptions = {
  mode: BackfillMode;
  limit: number | null;
  legacyWordpressOrderId: number | null;
  force: boolean;
  debug: boolean;
};

export type HistoricalGsmPodBackfillSummary = {
  mode: BackfillMode;
  candidates: number;
  dryRunDownloadable: number;
  uploaded: number;
  skippedExisting: number;
  failed: number;
};

type HistoricalGsmTaskCandidate = {
  orderId: string;
  legacyWordpressOrderId: number;
  orderNumber: string | null;
  gsmTaskId: string;
  source: string;
};

type HistoricalGsmTaskCandidateResult = {
  candidates: HistoricalGsmTaskCandidate[];
  ordersScanned: number;
};

type GsmTaskResponse = Record<string, Prisma.JsonValue>;
type ExistingPodAttachment = {
  id: string;
  orderId: string;
  storagePath: string;
};

const GSM_TASK_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const GSM_TASK_ID_GLOBAL_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;

function parseIntegerArg(name: string, value: string | undefined): number {
  if (!value) {
    throw new Error(`${name} requires a value`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

export function parseHistoricalGsmPodBackfillArgs(
  argv: string[],
): HistoricalGsmPodBackfillOptions {
  const options: HistoricalGsmPodBackfillOptions = {
    mode: "dry-run",
    limit: null,
    legacyWordpressOrderId: null,
    force: false,
    debug: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--apply") {
      options.mode = "apply";
      continue;
    }

    if (arg === "--dry-run") {
      options.mode = "dry-run";
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--debug") {
      options.debug = true;
      continue;
    }

    if (arg === "--limit") {
      options.limit = parseIntegerArg("--limit", next);
      index += 1;
      continue;
    }

    if (arg === "--legacy-wordpress-order-id") {
      options.legacyWordpressOrderId = parseIntegerArg(
        "--legacy-wordpress-order-id",
        next,
      );
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;

  if (typeof value === "string") {
    const parsed = parseJsonString(value);
    return isRecord(parsed) ? parsed : null;
  }

  return null;
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    const parsed = parseJsonString(value);
    return Array.isArray(parsed) ? parsed : [];
  }

  return [];
}

function collectGsmTaskIdsFromAttachmentLinks(value: unknown): string[] {
  const rawValue = typeof value === "string" ? value : JSON.stringify(value);
  if (!rawValue) return [];

  const taskIds = new Set<string>();
  const matches = rawValue.matchAll(
    /gsmTaskId["\s,\\:]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/giu,
  );

  for (const match of matches) {
    const taskId = match[1];
    if (taskId) taskIds.add(taskId);
  }

  return Array.from(taskIds);
}

function collectGsmTaskIdsFromRawPostMeta(value: unknown): string[] {
  const entries = toArray(value);

  const taskIds = new Set<string>();

  for (const entry of entries) {
    if (!isRecord(entry)) continue;

    const metaKey = asString(entry.meta_key);
    if (!metaKey?.startsWith("_gsmtasks_note_added_")) continue;

    const match = metaKey.match(
      /^_gsmtasks_note_added_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/iu,
    );
    if (match?.[1]) taskIds.add(match[1]);
  }

  return Array.from(taskIds);
}

function collectFallbackGsmUuids(value: unknown): string[] {
  const rawValue = typeof value === "string" ? value : JSON.stringify(value);
  if (!rawValue) return [];

  return Array.from(new Set(rawValue.match(GSM_TASK_ID_GLOBAL_PATTERN) ?? []));
}

function parseGsmOrderId(orderUrl: string | null): string | null {
  if (!orderUrl) return null;

  const match = orderUrl.match(/\/orders\/([^/]+)\/?$/u);
  return match?.[1] ?? null;
}

function parseCompletedAt(value: unknown): Date | null {
  const raw = asString(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stringifyAddress(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const rawAddress = (value as { raw_address?: unknown }).raw_address;
  return asString(rawAddress);
}

async function fetchGsmTask(
  gsmTaskId: string,
  token: string,
): Promise<GsmTaskResponse | null> {
  const response = await fetch(
    `${GSM_API_BASE}/tasks/${encodeURIComponent(gsmTaskId)}/`,
    {
      headers: {
        Accept: GSM_API_VERSION,
        Authorization: `Token ${token}`,
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload: unknown = await response.json().catch(() => null);
  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as GsmTaskResponse)
    : null;
}

async function fetchPodPdfBuffer(gsmTaskId: string, token: string) {
  const response = await fetch(
    `${GSM_API_BASE}/tasks/${encodeURIComponent(gsmTaskId)}/pod/`,
    {
      headers: {
        Accept: "application/pdf",
        Authorization: `Token ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`POD download failed (${response.status})`);
  }

  const contentType = response.headers.get("content-type");
  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length < PDF_MIN_BYTES) {
    throw new Error(`POD download was too small (${bytes.length} bytes)`);
  }

  return {
    bytes,
    contentType: contentType?.split(";")[0]?.trim() || "application/pdf",
  };
}

async function getHistoricalGsmTaskCandidates(
  options: HistoricalGsmPodBackfillOptions,
): Promise<HistoricalGsmTaskCandidateResult> {
  const orders = await prisma.order.findMany({
    where: {
      legacyWordpressOrderId:
        options.legacyWordpressOrderId === null
          ? { not: null }
          : options.legacyWordpressOrderId,
    },
    select: {
      id: true,
      legacyWordpressOrderId: true,
      orderNumber: true,
      legacyWordpressRawMeta: true,
    },
    orderBy: {
      legacyWordpressOrderId: "desc",
    },
  });

  const candidates: HistoricalGsmTaskCandidate[] = [];
  const seen = new Set<string>();

  for (const order of orders) {
    if (order.legacyWordpressOrderId === null) continue;
    const rawMeta = toRecord(order.legacyWordpressRawMeta);
    if (!rawMeta) continue;

    if (options.debug && options.legacyWordpressOrderId !== null) {
      const rawPostMeta = rawMeta.__rawPostMeta;
      console.log("Debug historical GSM raw metadata", {
        legacyWordpressOrderId: order.legacyWordpressOrderId,
        orderNumber: order.orderNumber,
        keys: Object.keys(rawMeta).toSorted(),
        rawPostMetaIsArray: Array.isArray(rawPostMeta),
        rawPostMetaLength: toArray(rawPostMeta).length,
        hasGsmAttachmentDownloadLinks:
          rawMeta.gsm_attachment_download_links !== undefined,
        hasGsmTaskId: rawMeta.gsm_task_id !== undefined,
      });
    }

    const sources: Array<{ source: string; taskIds: string[] }> = [
      {
        source: "gsm_attachment_download_links",
        taskIds: collectGsmTaskIdsFromAttachmentLinks(
          rawMeta.gsm_attachment_download_links,
        ),
      },
      {
        source: "gsm_task_id",
        taskIds:
          asString(rawMeta.gsm_task_id)?.match(
            GSM_TASK_ID_PATTERN,
          )
            ? [asString(rawMeta.gsm_task_id) ?? ""]
            : [],
      },
      {
        source: "_gsmtasks_note_added",
        taskIds: collectGsmTaskIdsFromRawPostMeta(
          rawMeta.__rawPostMeta,
        ),
      },
    ];

    if (sources.every((source) => source.taskIds.length === 0)) {
      sources.push({
        source: "legacyWordpressRawMeta_uuid_fallback",
        taskIds: collectFallbackGsmUuids(rawMeta),
      });
    }

    for (const source of sources) {
      for (const gsmTaskId of source.taskIds) {
        if (!GSM_TASK_ID_PATTERN.test(gsmTaskId)) continue;

        const key = `${order.id}:${gsmTaskId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        candidates.push({
          orderId: order.id,
          legacyWordpressOrderId: order.legacyWordpressOrderId,
          orderNumber: order.orderNumber,
          gsmTaskId,
          source: source.source,
        });

        if (options.limit !== null && candidates.length >= options.limit) {
          return {
            candidates,
            ordersScanned: orders.length,
          };
        }
      }
    }
  }

  return {
    candidates,
    ordersScanned: orders.length,
  };
}

async function upsertGsmTask(params: {
  candidate: HistoricalGsmTaskCandidate;
  task: GsmTaskResponse | null;
}) {
  const orderUrl = asString(params.task?.order);
  const syncedAt = new Date();

  await prisma.orderGsmTask.upsert({
    where: {
      gsmTaskId: params.candidate.gsmTaskId,
    },
    update: {
      orderId: params.candidate.orderId,
      gsmOrderId: parseGsmOrderId(orderUrl),
      category: asString(params.task?.category),
      reference: asString(params.task?.reference) ?? params.candidate.orderNumber,
      state: asString(params.task?.state),
      address: stringifyAddress(params.task?.address),
      completedAt: parseCompletedAt(params.task?.completed_at),
      lastSyncedAt: syncedAt,
      rawPayload: params.task ?? {
        source: params.candidate.source,
        legacyWordpressOrderId: params.candidate.legacyWordpressOrderId,
      },
    },
    create: {
      orderId: params.candidate.orderId,
      gsmTaskId: params.candidate.gsmTaskId,
      gsmOrderId: parseGsmOrderId(orderUrl),
      category: asString(params.task?.category),
      reference: asString(params.task?.reference) ?? params.candidate.orderNumber,
      state: asString(params.task?.state),
      address: stringifyAddress(params.task?.address),
      completedAt: parseCompletedAt(params.task?.completed_at),
      lastSyncedAt: syncedAt,
      rawPayload: params.task ?? {
        source: params.candidate.source,
        legacyWordpressOrderId: params.candidate.legacyWordpressOrderId,
      },
    },
  });
}

async function findExistingPodAttachment(params: {
  orderId: string;
  gsmTaskId: string;
  podDocumentId: string;
}): Promise<ExistingPodAttachment | null> {
  const existingByGsmIdentity = await prisma.orderAttachment.findFirst({
    where: {
      gsmTaskId: params.gsmTaskId,
      gsmDocumentId: params.podDocumentId,
    },
    select: {
      id: true,
      orderId: true,
      storagePath: true,
    },
  });

  if (existingByGsmIdentity) {
    return existingByGsmIdentity;
  }

  return prisma.orderAttachment.findFirst({
    where: {
      orderId: params.orderId,
      OR: [
        {
          filename: {
            contains: params.gsmTaskId,
            mode: "insensitive",
          },
        },
        {
          sourceUrl: {
            contains: params.gsmTaskId,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      orderId: true,
      storagePath: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function runHistoricalGsmPodBackfill(
  options: HistoricalGsmPodBackfillOptions,
): Promise<HistoricalGsmPodBackfillSummary> {
  if (options.mode === "apply" && !isS3AttachmentStorageConfigured()) {
    throw new Error(
      "S3 attachment storage is not configured. Required env: S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    );
  }

  const candidateResult = await getHistoricalGsmTaskCandidates(options);
  const candidates = candidateResult.candidates;
  let skippedExisting = 0;
  let dryRunDownloadable = 0;
  let uploaded = 0;
  let failed = 0;

  console.log("Historical GSM POD backfill starting", {
    mode: options.mode,
    ordersScanned: candidateResult.ordersScanned,
    candidates: candidates.length,
    limit: options.limit,
    legacyWordpressOrderId: options.legacyWordpressOrderId,
    force: options.force,
    debug: options.debug,
  });

  const token = await getGsmToken();

  for (const candidate of candidates) {
    const podDocumentId = `pod:${candidate.gsmTaskId}`;
    const existing = await findExistingPodAttachment({
      orderId: candidate.orderId,
      gsmTaskId: candidate.gsmTaskId,
      podDocumentId,
    });

    if (existing && !options.force) {
      skippedExisting += 1;
      continue;
    }

    try {
      const task = await fetchGsmTask(candidate.gsmTaskId, token);
      const downloaded = await fetchPodPdfBuffer(candidate.gsmTaskId, token);
      const filename = `pod-${candidate.gsmTaskId}.pdf`;

      if (options.mode !== "apply") {
        dryRunDownloadable += 1;
        console.log("Dry-run: would import historical GSM POD", {
          legacyWordpressOrderId: candidate.legacyWordpressOrderId,
          orderNumber: candidate.orderNumber,
          orderId: candidate.orderId,
          gsmTaskId: candidate.gsmTaskId,
          source: candidate.source,
          sizeBytes: downloaded.bytes.length,
          existingAttachmentId: existing?.id ?? null,
          taskState: asString(task?.state),
        });
        continue;
      }

      await upsertGsmTask({ candidate, task });

      const storedFile = await uploadAttachmentBufferToS3({
        bytes: downloaded.bytes,
        scope: candidate.orderId,
        filename,
        contentType: downloaded.contentType,
      });

      if (existing) {
        await prisma.orderAttachment.update({
          where: {
            id: existing.id,
          },
          data: {
            filename,
            mimeType: downloaded.contentType,
            sizeBytes: downloaded.bytes.length,
            storagePath: storedFile.storagePath,
            source: "GSM",
            sourceUrl: `${GSM_API_BASE}/tasks/${candidate.gsmTaskId}/pod/`,
          },
        });
      } else {
        await prisma.orderAttachment.create({
          data: {
            orderId: candidate.orderId,
            filename,
            mimeType: downloaded.contentType,
            sizeBytes: downloaded.bytes.length,
            storagePath: storedFile.storagePath,
            source: "GSM",
            sourceUrl: `${GSM_API_BASE}/tasks/${candidate.gsmTaskId}/pod/`,
            gsmTaskId: candidate.gsmTaskId,
            gsmDocumentId: podDocumentId,
          },
        });
      }

      uploaded += 1;
      console.log("Imported historical GSM POD", {
        legacyWordpressOrderId: candidate.legacyWordpressOrderId,
        orderNumber: candidate.orderNumber,
        orderId: candidate.orderId,
        gsmTaskId: candidate.gsmTaskId,
        storagePath: storedFile.storagePath,
        taskState: asString(task?.state),
      });
    } catch (error) {
      failed += 1;
      console.error("Failed to import historical GSM POD", {
        legacyWordpressOrderId: candidate.legacyWordpressOrderId,
        orderNumber: candidate.orderNumber,
        orderId: candidate.orderId,
        gsmTaskId: candidate.gsmTaskId,
        source: candidate.source,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("Historical GSM POD backfill complete", {
    mode: options.mode,
    candidates: candidates.length,
    dryRunDownloadable,
    uploaded,
    skippedExisting,
    failed,
  });

  return {
    mode: options.mode,
    candidates: candidates.length,
    dryRunDownloadable,
    uploaded,
    skippedExisting,
    failed,
  };
}

async function main() {
  const options = parseHistoricalGsmPodBackfillArgs(process.argv.slice(2));
  const summary = await runHistoricalGsmPodBackfill(options);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Historical GSM POD backfill crashed", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

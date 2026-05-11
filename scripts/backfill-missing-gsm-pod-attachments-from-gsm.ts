import "dotenv/config";
import { stat } from "fs/promises";
import path from "path";
import { prisma } from "../lib/db";
import { getGsmToken } from "../lib/integrations/gsm/client";
import {
  isS3AttachmentStorageConfigured,
  uploadAttachmentBufferToS3,
} from "../lib/orders/orderAttachmentStorage";

const GSM_API_BASE = process.env.GSM_API_BASE ?? "https://api.gsmtasks.com";
const LOCAL_UPLOAD_PREFIX = "/uploads/orders/";
const BATCH_SIZE = 100;

type BackfillMode = "dry-run" | "apply";

function getMode(): BackfillMode {
  return process.argv.includes("--apply") ? "apply" : "dry-run";
}

function getLocalUploadPath(storagePath: string): string | null {
  if (!storagePath.startsWith(LOCAL_UPLOAD_PREFIX)) return null;

  const relativePath = storagePath.replace(/^\//, "");
  const absolutePath = path.resolve(process.cwd(), "public", relativePath);
  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");

  if (
    absolutePath !== uploadsRoot &&
    !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)
  ) {
    return null;
  }

  return absolutePath;
}

async function localFileExists(absolutePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(absolutePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

function isPodDocumentForTask(gsmDocumentId: string, gsmTaskId: string) {
  return gsmDocumentId === `pod:${gsmTaskId}`;
}

async function fetchPodPdfBuffer(gsmTaskId: string) {
  const token = await getGsmToken();

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
    throw new Error(`Failed to download GSM POD PDF (${response.status})`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length <= 0) {
    throw new Error("Downloaded GSM POD PDF was empty");
  }

  return bytes;
}

async function main() {
  const mode = getMode();

  if (mode === "apply" && !isS3AttachmentStorageConfigured()) {
    throw new Error(
      "S3 attachment storage is not configured. Required env: S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    );
  }

  let cursor: string | undefined;
  let scanned = 0;
  let missingLocalFiles = 0;
  let uploaded = 0;
  let skippedExistingLocalFile = 0;
  let skippedMissingGsmIds = 0;
  let skippedUnsupportedDocument = 0;
  let skippedUnsafePath = 0;
  let failed = 0;

  console.log("Missing GSM POD attachment recovery starting", {
    mode,
    dryRun: mode !== "apply",
    localPrefix: LOCAL_UPLOAD_PREFIX,
  });

  for (;;) {
    const attachments = await prisma.orderAttachment.findMany({
      where: {
        source: "GSM",
        OR: [
          {
            storagePath: {
              startsWith: LOCAL_UPLOAD_PREFIX,
            },
          },
          {
            sourceUrl: {
              startsWith: LOCAL_UPLOAD_PREFIX,
            },
          },
        ],
      },
      select: {
        id: true,
        orderId: true,
        filename: true,
        mimeType: true,
        storagePath: true,
        sourceUrl: true,
        gsmTaskId: true,
        gsmDocumentId: true,
      },
      orderBy: {
        id: "asc",
      },
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: BATCH_SIZE,
    });

    if (attachments.length === 0) {
      break;
    }

    for (const attachment of attachments) {
      scanned += 1;

      const localStoragePath = attachment.storagePath.startsWith(LOCAL_UPLOAD_PREFIX)
        ? attachment.storagePath
        : attachment.sourceUrl?.startsWith(LOCAL_UPLOAD_PREFIX)
          ? attachment.sourceUrl
          : null;

      if (!localStoragePath) {
        skippedUnsafePath += 1;
        console.warn("Skipping GSM POD attachment without local upload path", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          storagePath: attachment.storagePath,
          sourceUrl: attachment.sourceUrl,
        });
        continue;
      }

      const absolutePath = getLocalUploadPath(localStoragePath);

      if (!absolutePath) {
        skippedUnsafePath += 1;
        console.warn("Skipping GSM POD attachment with unsafe local path", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          localStoragePath,
        });
        continue;
      }

      if (await localFileExists(absolutePath)) {
        skippedExistingLocalFile += 1;
        console.log("Skipping GSM POD attachment because local file still exists", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          filename: attachment.filename,
          localStoragePath,
        });
        continue;
      }

      if (!attachment.gsmTaskId || !attachment.gsmDocumentId) {
        skippedMissingGsmIds += 1;
        console.warn("Skipping missing GSM POD attachment without GSM ids", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          filename: attachment.filename,
          gsmTaskId: attachment.gsmTaskId,
          gsmDocumentId: attachment.gsmDocumentId,
        });
        continue;
      }

      if (!isPodDocumentForTask(attachment.gsmDocumentId, attachment.gsmTaskId)) {
        skippedUnsupportedDocument += 1;
        console.warn("Skipping unsupported GSM document id", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          filename: attachment.filename,
          gsmTaskId: attachment.gsmTaskId,
          gsmDocumentId: attachment.gsmDocumentId,
        });
        continue;
      }

      missingLocalFiles += 1;

      if (mode !== "apply") {
        console.log("Dry-run: would re-download missing GSM POD and upload to S3", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          filename: attachment.filename,
          localStoragePath,
          gsmTaskId: attachment.gsmTaskId,
          gsmDocumentId: attachment.gsmDocumentId,
        });
        continue;
      }

      try {
        const bytes = await fetchPodPdfBuffer(attachment.gsmTaskId);
        const storedFile = await uploadAttachmentBufferToS3({
          bytes,
          scope: attachment.orderId,
          filename: attachment.filename,
          contentType: attachment.mimeType || "application/pdf",
        });

        await prisma.orderAttachment.update({
          where: {
            id: attachment.id,
          },
          data: {
            storagePath: storedFile.storagePath,
            sizeBytes: bytes.length,
          },
        });

        uploaded += 1;
        console.log("Recovered missing GSM POD attachment to S3", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          filename: attachment.filename,
          previousStoragePath: attachment.storagePath,
          storagePath: storedFile.storagePath,
          gsmTaskId: attachment.gsmTaskId,
          gsmDocumentId: attachment.gsmDocumentId,
        });
      } catch (error) {
        failed += 1;
        console.error("Failed to recover missing GSM POD attachment", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          filename: attachment.filename,
          localStoragePath,
          gsmTaskId: attachment.gsmTaskId,
          gsmDocumentId: attachment.gsmDocumentId,
          error,
        });
      }
    }

    cursor = attachments[attachments.length - 1]?.id;
  }

  console.log("Missing GSM POD attachment recovery complete", {
    mode,
    scanned,
    missingLocalFiles,
    uploaded,
    skippedExistingLocalFile,
    skippedMissingGsmIds,
    skippedUnsupportedDocument,
    skippedUnsafePath,
    failed,
  });
}

main()
  .catch((error) => {
    console.error("Missing GSM POD attachment recovery crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

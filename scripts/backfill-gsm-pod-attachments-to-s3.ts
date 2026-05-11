import "dotenv/config";
import { stat, readFile } from "fs/promises";
import path from "path";
import { prisma } from "../lib/db";
import {
  isS3AttachmentStorageConfigured,
  uploadAttachmentBufferToS3,
} from "../lib/orders/orderAttachmentStorage";

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

async function main() {
  const mode = getMode();

  if (mode === "apply" && !isS3AttachmentStorageConfigured()) {
    throw new Error(
      "S3 attachment storage is not configured. Required env: S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    );
  }

  let cursor: string | undefined;
  let scanned = 0;
  let eligible = 0;
  let uploaded = 0;
  let skippedMissingLocalFile = 0;
  let skippedUnsafePath = 0;
  let failed = 0;

  console.log("GSM POD attachment S3 backfill starting", {
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
        sizeBytes: true,
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
        console.warn("Skipping GSM attachment without local upload path", {
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
        console.warn("Skipping GSM attachment with unsafe local path", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          localStoragePath,
        });
        continue;
      }

      if (!(await localFileExists(absolutePath))) {
        skippedMissingLocalFile += 1;
        console.warn("Skipping GSM attachment because local file is missing", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          filename: attachment.filename,
          localStoragePath,
          absolutePath,
        });
        continue;
      }

      eligible += 1;

      if (mode !== "apply") {
        console.log("Dry-run: would upload GSM attachment to S3", {
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
        const bytes = await readFile(absolutePath);
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
        console.log("Uploaded GSM attachment to S3", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          filename: attachment.filename,
          previousStoragePath: attachment.storagePath,
          storagePath: storedFile.storagePath,
        });
      } catch (error) {
        failed += 1;
        console.error("Failed to backfill GSM attachment to S3", {
          attachmentId: attachment.id,
          orderId: attachment.orderId,
          filename: attachment.filename,
          localStoragePath,
          error,
        });
      }
    }

    cursor = attachments[attachments.length - 1]?.id;
  }

  console.log("GSM POD attachment S3 backfill complete", {
    mode,
    scanned,
    eligible,
    uploaded,
    skippedMissingLocalFile,
    skippedUnsafePath,
    failed,
  });
}

main()
  .catch((error) => {
    console.error("GSM POD attachment S3 backfill crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

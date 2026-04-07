// path: lib/integrations/gsm/downloadPodPdf.ts
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getGsmToken } from "@/lib/integrations/gsm/client";

const GSM_API_BASE = process.env.GSM_API_BASE ?? "https://api.gsmtasks.com";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPodPdfBuffer(taskId: string) {
  const token = await getGsmToken();

  const res = await fetch(
    `${GSM_API_BASE}/tasks/${encodeURIComponent(taskId)}/pod/`,
    {
      headers: {
        Accept: "application/pdf",
        Authorization: `Token ${token}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to download POD PDF (${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer;
}

function buildPaths(orderId: string) {
  const relativeDir = path.join("uploads", "orders", orderId);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);

  return {
    relativeDir,
    absoluteDir,
  };
}

async function writePodPdf(orderId: string, taskId: string, buffer: Buffer) {
  const { relativeDir, absoluteDir } = buildPaths(orderId);

  await mkdir(absoluteDir, { recursive: true });

  const storedFilename = `pod-${taskId}-${randomUUID()}.pdf`;
  const absolutePath = path.join(absoluteDir, storedFilename);
  const publicPath = `/${relativeDir.replaceAll("\\", "/")}/${storedFilename}`;

  await writeFile(absolutePath, buffer);

  return {
    filename: storedFilename,
    storagePath: publicPath,
    sizeBytes: buffer.length,
    mimeType: "application/pdf",
  };
}

export async function syncPodPdfWithRetry(orderId: string, taskId: string) {
  const podDocumentId = `pod:${taskId}`;

  // Wait a bit first so GSM has time to finalize the PDF with images/signature
  const delays = [8000, 12000, 18000];

  let lastBuffer: Buffer | null = null;

  for (const delay of delays) {
    await sleep(delay);

    try {
      const buffer = await fetchPodPdfBuffer(taskId);

      // Keep the biggest version we see, usually later versions contain more data
      if (!lastBuffer || buffer.length > lastBuffer.length) {
        lastBuffer = buffer;
      }

      // If it looks reasonably sized, stop early
      if (buffer.length > 20_000) {
        break;
      }
    } catch (error) {
      console.error("POD FETCH RETRY FAILED:", {
        orderId,
        taskId,
        delay,
        error,
      });
    }
  }

  if (!lastBuffer) {
    throw new Error("POD PDF could not be downloaded");
  }

  const existing = await prisma.orderAttachment.findFirst({
    where: {
      orderId,
      gsmTaskId: taskId,
      gsmDocumentId: podDocumentId,
    },
    select: {
      id: true,
      storagePath: true,
    },
  });

  const saved = await writePodPdf(orderId, taskId, lastBuffer);

  if (existing) {
    await prisma.orderAttachment.update({
      where: { id: existing.id },
      data: {
        filename: saved.filename,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        storagePath: saved.storagePath,
        source: "GSM",
      },
    });

    if (existing.storagePath.startsWith("/uploads/")) {
      const oldAbsolutePath = path.join(
        process.cwd(),
        "public",
        existing.storagePath.replace(/^\//, ""),
      );

      try {
        await unlink(oldAbsolutePath);
      } catch {
        // ignore missing old file
      }
    }

    return;
  }

  await prisma.orderAttachment.create({
    data: {
      orderId,
      filename: saved.filename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      storagePath: saved.storagePath,
      source: "GSM",
      gsmTaskId: taskId,
      gsmDocumentId: podDocumentId,
    },
  });
}

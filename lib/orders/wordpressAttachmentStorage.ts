import { randomUUID } from "crypto";
import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import type { AttachmentCategory } from "@/lib/orders/attachmentCategories";

export const WORDPRESS_ATTACHMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export type WordpressAttachmentCandidate = {
  legacyWordpressAttachmentId: number;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  sourceUrl: string;
  category: AttachmentCategory;
};

type StoredWordpressAttachment = {
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storagePath: string;
};

function sanitizeFilename(filename: string): string {
  const parsed = path.parse(filename.trim() || "wordpress-attachment");
  const safeName = (parsed.name || "wordpress-attachment")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 80);
  const safeExt = parsed.ext.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 16);

  return `${safeName || "wordpress-attachment"}${safeExt}`;
}

function getExtensionForMimeType(mimeType: string | null): string {
  if (!mimeType) return "";
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  return "";
}

function normalizeMimeType(value: string | null): string | null {
  if (!value) return null;
  const mimeType = value.split(";")[0]?.trim().toLowerCase();
  return mimeType || null;
}

function getLocalUploadPath(storagePath: string): string | null {
  if (!storagePath.startsWith("/uploads/")) return null;

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

export async function localUploadFileExists(storagePath: string): Promise<boolean> {
  const absolutePath = getLocalUploadPath(storagePath);
  if (!absolutePath) return false;

  try {
    const fileStat = await stat(absolutePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function downloadWordpressAttachment(
  attachment: WordpressAttachmentCandidate,
): Promise<{
  buffer: Buffer;
  mimeType: string | null;
  sizeBytes: number;
}> {
  const response = await fetch(attachment.sourceUrl, {
    headers: {
      Accept: attachment.mimeType ?? "*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`WordPress attachment fetch failed (${response.status})`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (
      Number.isFinite(parsedLength) &&
      parsedLength > WORDPRESS_ATTACHMENT_MAX_FILE_SIZE
    ) {
      throw new Error("WordPress attachment is larger than the allowed limit");
    }
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length <= 0) {
    throw new Error("WordPress attachment response was empty");
  }

  if (buffer.length > WORDPRESS_ATTACHMENT_MAX_FILE_SIZE) {
    throw new Error("WordPress attachment is larger than the allowed limit");
  }

  const responseMimeType = normalizeMimeType(response.headers.get("content-type"));

  return {
    buffer,
    mimeType: responseMimeType ?? attachment.mimeType,
    sizeBytes: buffer.length,
  };
}

async function writeWordpressAttachment(params: {
  orderId: string;
  attachment: WordpressAttachmentCandidate;
  buffer: Buffer;
  mimeType: string | null;
}): Promise<StoredWordpressAttachment> {
  const { orderId, attachment, buffer, mimeType } = params;
  const safeFilename = sanitizeFilename(attachment.filename);
  const currentExt = path.extname(safeFilename);
  const requiredExt = currentExt ? "" : getExtensionForMimeType(mimeType);
  const storedFilename = `${attachment.legacyWordpressAttachmentId}-${Date.now()}-${randomUUID()}-${safeFilename}${requiredExt}`;
  const relativeDir = path.join(
    "uploads",
    "orders",
    orderId,
    "wordpress",
  );
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  const absolutePath = path.join(absoluteDir, storedFilename);
  const storagePath = `/${relativeDir.replaceAll("\\", "/")}/${storedFilename}`;

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    filename: attachment.filename,
    mimeType,
    sizeBytes: buffer.length,
    storagePath,
  };
}

export async function copyWordpressAttachmentToLocalStorage(params: {
  orderId: string;
  attachment: WordpressAttachmentCandidate;
}): Promise<StoredWordpressAttachment> {
  const downloaded = await downloadWordpressAttachment(params.attachment);

  return writeWordpressAttachment({
    orderId: params.orderId,
    attachment: params.attachment,
    buffer: downloaded.buffer,
    mimeType: downloaded.mimeType,
  });
}

export async function upsertWordpressOrderAttachment(params: {
  orderId: string;
  attachment: WordpressAttachmentCandidate;
}) {
  const { orderId, attachment } = params;
  const existing = await prisma.orderAttachment.findUnique({
    where: {
      orderId_legacyWordpressAttachmentId: {
        orderId,
        legacyWordpressAttachmentId: attachment.legacyWordpressAttachmentId,
      },
    },
    select: {
      id: true,
      storagePath: true,
    },
  });

  if (existing && (await localUploadFileExists(existing.storagePath))) {
    return existing;
  }

  let stored: StoredWordpressAttachment | null = null;

  try {
    stored = await copyWordpressAttachmentToLocalStorage({
      orderId,
      attachment,
    });
  } catch (error) {
    console.error("Failed to copy WordPress attachment", {
      orderId,
      legacyWordpressAttachmentId: attachment.legacyWordpressAttachmentId,
      sourceUrl: attachment.sourceUrl,
      error,
    });
  }

  const data = {
    filename: stored?.filename ?? attachment.filename,
    mimeType: stored?.mimeType ?? attachment.mimeType,
    sizeBytes: stored?.sizeBytes ?? attachment.sizeBytes,
    storagePath: stored?.storagePath ?? attachment.sourceUrl,
    sourceUrl: attachment.sourceUrl,
    source: "wordpress_import",
    category: attachment.category,
  };

  if (existing) {
    return prisma.orderAttachment.update({
      where: { id: existing.id },
      data,
      select: { id: true, storagePath: true },
    });
  }

  return prisma.orderAttachment.create({
    data: {
      orderId,
      legacyWordpressAttachmentId: attachment.legacyWordpressAttachmentId,
      ...data,
    },
    select: { id: true, storagePath: true },
  });
}


import { randomUUID } from "crypto";
import { unlink } from "fs/promises";
import path from "path";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type StoredAttachment = {
  storagePath: string;
  key: string;
};

type DownloadedAttachment = {
  bytes: Buffer;
  contentType: string | null;
  sizeBytes: number;
};

type AttachmentAccessUrls = {
  url: string;
  downloadUrl: string;
};

const S3_STORAGE_PREFIX = "s3://";
const TEMP_KEY_PREFIX = "tmp";
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 5;

let cachedS3Client: S3Client | null = null;
let cachedConfigKey: string | null = null;

function getS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
  };
}

function getRequiredS3Config(): S3Config {
  const config = getS3Config();

  if (!config) {
    throw new Error(
      "Missing S3 attachment storage environment variables: S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    );
  }

  return config;
}

function getS3Client(config: S3Config): S3Client {
  const configKey = [
    config.bucket,
    config.region,
    config.accessKeyId,
    config.secretAccessKey,
  ].join(":");

  if (!cachedS3Client || cachedConfigKey !== configKey) {
    cachedS3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedConfigKey = configKey;
  }

  return cachedS3Client;
}

function sanitizeFilename(filename: string): string {
  const trimmedFilename = filename.trim() || "attachment";
  const lastDotIndex = trimmedFilename.lastIndexOf(".");
  const baseName =
    lastDotIndex > 0 ? trimmedFilename.slice(0, lastDotIndex) : trimmedFilename;
  const extension = lastDotIndex > 0 ? trimmedFilename.slice(lastDotIndex) : "";

  const safeBaseName = baseName
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 80);

  return `${safeBaseName || "attachment"}${extension}`;
}

function toS3StoragePath(key: string): string {
  return `${S3_STORAGE_PREFIX}${key}`;
}

function parseS3StoragePath(storagePath: string): string | null {
  if (!storagePath.startsWith(S3_STORAGE_PREFIX)) return null;

  const key = storagePath.slice(S3_STORAGE_PREFIX.length).trim();
  return key.length > 0 ? key : null;
}

function hasTransformToByteArray(
  value: unknown,
): value is { transformToByteArray: () => Promise<Uint8Array> } {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as { transformToByteArray?: unknown };
  return typeof candidate.transformToByteArray === "function";
}

function contentDispositionFilename(filename: string): string {
  return filename.replace(/["\r\n]/g, "_");
}

function getSignedUrlTtlSeconds(): number {
  const rawValue = process.env.S3_SIGNED_URL_TTL_SECONDS?.trim();

  if (!rawValue) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 60) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }

  return Math.floor(parsedValue);
}

export function isS3AttachmentStorageConfigured(): boolean {
  return getS3Config() !== null;
}

export function isS3StoragePath(storagePath: string): boolean {
  return parseS3StoragePath(storagePath) !== null;
}

export async function uploadAttachmentToS3(params: {
  file: File;
  scope: string;
}): Promise<StoredAttachment> {
  const bytes = Buffer.from(await params.file.arrayBuffer());
  return uploadAttachmentBufferToS3({
    bytes,
    scope: params.scope,
    filename: params.file.name,
    contentType: params.file.type || "application/octet-stream",
  });
}

export async function uploadAttachmentBufferToS3(params: {
  bytes: Buffer;
  scope: string;
  filename: string;
  contentType?: string | null;
}): Promise<StoredAttachment> {
  return putAttachmentBuffer({ ...params, keyPrefix: "orders" });
}

// Staging area for public, unauthenticated uploads that aren't attached to an
// order yet (special-goods quote photos). Lives under tmp/ in the SAME bucket
// so one S3 lifecycle rule ("expire objects with prefix tmp/ after 1 day")
// mops up anything never promoted — see promoteTempAttachmentToOrders.
export async function uploadTempAttachmentBufferToS3(params: {
  bytes: Buffer;
  scope: string;
  filename: string;
  contentType?: string | null;
}): Promise<StoredAttachment> {
  return putAttachmentBuffer({ ...params, keyPrefix: TEMP_KEY_PREFIX });
}

async function putAttachmentBuffer(params: {
  bytes: Buffer;
  scope: string;
  filename: string;
  contentType?: string | null;
  keyPrefix: string;
}): Promise<StoredAttachment> {
  const config = getRequiredS3Config();
  const client = getS3Client(config);
  const key = `${params.keyPrefix}/${params.scope}/${Date.now()}-${randomUUID()}-${sanitizeFilename(
    params.filename,
  )}`;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: params.bytes,
      ContentType: params.contentType || "application/octet-stream",
    }),
  );

  return {
    key,
    storagePath: toS3StoragePath(key),
  };
}

// tmp/<rest> -> orders/<rest>; null for any key that isn't a real tmp/ object.
export function tempKeyToOrderKey(key: string): string | null {
  if (!key.startsWith(`${TEMP_KEY_PREFIX}/`)) return null;

  const rest = key.slice(TEMP_KEY_PREFIX.length + 1);
  return rest.length > 0 ? `orders/${rest}` : null;
}

// Moves a staged tmp/ object to its permanent orders/ key (copy, then delete)
// and returns the new storage path. A failed copy throws and leaves the tmp
// object untouched. A failed delete after a good copy is swallowed: the file
// is safely at its final key and the tmp/ lifecycle rule removes the leftover.
export async function promoteTempAttachmentToOrders(storagePath: string): Promise<string> {
  const tempKey = parseS3StoragePath(storagePath);
  const orderKey = tempKey ? tempKeyToOrderKey(tempKey) : null;

  if (!tempKey || !orderKey) {
    throw new Error(`Not a temp S3 attachment path: ${storagePath}`);
  }

  const config = getRequiredS3Config();
  const client = getS3Client(config);

  await client.send(
    new CopyObjectCommand({
      Bucket: config.bucket,
      Key: orderKey,
      CopySource: `${config.bucket}/${encodeURIComponent(tempKey).replace(/%2F/g, "/")}`,
    }),
  );

  try {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: tempKey }));
  } catch {
    // leftover tmp/ object; the lifecycle rule expires it
  }

  return toS3StoragePath(orderKey);
}

export async function downloadAttachmentFromS3(
  storagePath: string,
): Promise<DownloadedAttachment | null> {
  const key = parseS3StoragePath(storagePath);

  if (!key) return null;

  const config = getRequiredS3Config();
  const response = await getS3Client(config).send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );

  if (!hasTransformToByteArray(response.Body)) {
    return null;
  }

  const bytes = Buffer.from(await response.Body.transformToByteArray());

  if (bytes.length <= 0) {
    return null;
  }

  return {
    bytes,
    contentType: response.ContentType ?? null,
    sizeBytes: bytes.length,
  };
}

export async function deleteAttachmentFromS3(
  storagePath: string,
): Promise<void> {
  const key = parseS3StoragePath(storagePath);

  if (!key) return;

  const config = getRequiredS3Config();
  await getS3Client(config).send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}

// Shared by every place that removes an attachment's underlying file
// (order attachment delete route, GSM POD resync, GDPR retention cleanup) so
// the S3-vs-local-upload branching and "ignore if already missing" behavior
// stay in one place.
export async function deleteAttachmentFile(storagePath: string): Promise<void> {
  if (isS3StoragePath(storagePath)) {
    try {
      await deleteAttachmentFromS3(storagePath);
    } catch {
      // file may already be missing, ignore
    }
    return;
  }

  if (storagePath.startsWith("/uploads/")) {
    const absolutePath = path.join(
      process.cwd(),
      "public",
      storagePath.replace(/^\//, ""),
    );

    try {
      await unlink(absolutePath);
    } catch {
      // file may already be missing, ignore
    }
  }
}

export async function getSignedAttachmentUrl(params: {
  storagePath: string;
  filename: string;
  mimeType: string | null;
  download?: boolean;
}): Promise<string | null> {
  const key = parseS3StoragePath(params.storagePath);

  if (!key) return null;

  const config = getRequiredS3Config();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ResponseContentDisposition: `${
      params.download ? "attachment" : "inline"
    }; filename="${contentDispositionFilename(params.filename)}"`,
    ResponseContentType: params.mimeType || undefined,
  });

  return getSignedUrl(getS3Client(config), command, {
    expiresIn: getSignedUrlTtlSeconds(),
  });
}

export async function getAttachmentAccessUrls(params: {
  storagePath: string;
  filename: string;
  mimeType: string | null;
  defaultUrl: string;
  defaultDownloadUrl?: string;
}): Promise<AttachmentAccessUrls> {
  const fallbackDownloadUrl = params.defaultDownloadUrl ?? params.defaultUrl;

  if (!isS3StoragePath(params.storagePath)) {
    return {
      url: params.defaultUrl,
      downloadUrl: fallbackDownloadUrl,
    };
  }

  const signedOpenUrl = await getSignedAttachmentUrl({
    storagePath: params.storagePath,
    filename: params.filename,
    mimeType: params.mimeType,
    download: false,
  });
  const signedDownloadUrl = await getSignedAttachmentUrl({
    storagePath: params.storagePath,
    filename: params.filename,
    mimeType: params.mimeType,
    download: true,
  });

  return {
    url: signedOpenUrl ?? params.defaultUrl,
    downloadUrl: signedDownloadUrl ?? fallbackDownloadUrl,
  };
}

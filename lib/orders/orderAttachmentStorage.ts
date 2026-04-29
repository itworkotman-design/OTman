import { randomUUID } from "crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  const config = getRequiredS3Config();
  const client = getS3Client(config);
  const bytes = Buffer.from(await params.file.arrayBuffer());
  const key = `orders/${params.scope}/${Date.now()}-${randomUUID()}-${sanitizeFilename(
    params.file.name,
  )}`;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes,
      ContentType: params.file.type || "application/octet-stream",
    }),
  );

  return {
    key,
    storagePath: toS3StoragePath(key),
  };
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

  return {
    url: signedOpenUrl ?? params.defaultUrl,
    downloadUrl: fallbackDownloadUrl,
  };
}

import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { deleteAttachmentFile } from "@/lib/orders/orderAttachmentStorage";

type BlogS3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

// Distinct from the "s3://" prefix used by the (private) orders bucket, so a
// storagePath always says which bucket/access-model it belongs to. Blog
// images live in their own bucket, one folder per post, served directly from
// a public-read bucket policy — no presigning needed since this is public
// content.
const BLOG_STORAGE_PREFIX = "blogs3://";

let cachedClient: S3Client | null = null;
let cachedConfigKey: string | null = null;

function getBlogS3Config(): BlogS3Config | null {
  const bucket = process.env.BLOG_S3_BUCKET?.trim();
  const region = (process.env.BLOG_S3_REGION || process.env.AWS_REGION)?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const publicBaseUrl = (process.env.BLOG_S3_PUBLIC_BASE_URL?.trim() || `https://${bucket}.s3.${region}.amazonaws.com`).replace(/\/$/, "");

  return { bucket, region, accessKeyId, secretAccessKey, publicBaseUrl };
}

function getRequiredBlogS3Config(): BlogS3Config {
  const config = getBlogS3Config();

  if (!config) {
    throw new Error(
      "Missing blog image storage environment variables: BLOG_S3_BUCKET, AWS_REGION (or BLOG_S3_REGION), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY",
    );
  }

  return config;
}

function getBlogS3Client(config: BlogS3Config): S3Client {
  const configKey = [config.bucket, config.region, config.accessKeyId, config.secretAccessKey].join(":");

  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedConfigKey = configKey;
  }

  return cachedClient;
}

function sanitizeFilename(filename: string): string {
  const trimmedFilename = filename.trim() || "image";
  const lastDotIndex = trimmedFilename.lastIndexOf(".");
  const baseName = lastDotIndex > 0 ? trimmedFilename.slice(0, lastDotIndex) : trimmedFilename;
  const extension = lastDotIndex > 0 ? trimmedFilename.slice(lastDotIndex) : "";

  const safeBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);

  return `${safeBaseName || "image"}${extension}`;
}

// blogPostId is a cuid segment of the S3 key, so it's restricted to a safe
// charset to rule out path traversal (e.g. "../") reaching outside the
// post's own folder in the bucket.
function isValidBlogPostId(blogPostId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(blogPostId);
}

export function isBlogStoragePath(storagePath: string): boolean {
  return storagePath.startsWith(BLOG_STORAGE_PREFIX);
}

export function isBlogImageStorageConfigured(): boolean {
  return getBlogS3Config() !== null;
}

export function getBlogImagePublicUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath || !storagePath.startsWith(BLOG_STORAGE_PREFIX)) return null;

  const config = getBlogS3Config();
  if (!config) return null;

  const key = storagePath.slice(BLOG_STORAGE_PREFIX.length);
  return `${config.publicBaseUrl}/${key}`;
}

export async function uploadBlogImageToS3(params: {
  file: File;
  blogPostId: string;
}): Promise<{ storagePath: string; key: string }> {
  if (!isValidBlogPostId(params.blogPostId)) {
    throw new Error("Invalid blogPostId");
  }

  const config = getRequiredBlogS3Config();
  const client = getBlogS3Client(config);
  const bytes = Buffer.from(await params.file.arrayBuffer());
  const key = `${params.blogPostId}/${Date.now()}-${randomUUID()}-${sanitizeFilename(params.file.name)}`;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes,
      ContentType: params.file.type || "application/octet-stream",
    }),
  );

  return { key, storagePath: `${BLOG_STORAGE_PREFIX}${key}` };
}

export async function deleteBlogImageFromS3(storagePath: string): Promise<void> {
  if (!storagePath.startsWith(BLOG_STORAGE_PREFIX)) return;

  const config = getBlogS3Config();
  if (!config) return;

  const key = storagePath.slice(BLOG_STORAGE_PREFIX.length);

  try {
    await getBlogS3Client(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch {
    // file may already be missing, ignore
  }
}

// Shared by every place that removes a blog image's underlying file
// (post delete, section delete/update). Dispatches to the blog bucket for
// current-scheme paths, falling back to the legacy shared-orders-bucket
// cleanup for any pre-existing "s3://" paths uploaded before the dedicated
// blog bucket existed.
export async function deleteBlogImageFile(storagePath: string): Promise<void> {
  if (isBlogStoragePath(storagePath)) {
    await deleteBlogImageFromS3(storagePath);
    return;
  }

  await deleteAttachmentFile(storagePath);
}

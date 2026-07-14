// Pure, SDK-free helpers shared by both server code (upload/delete) and
// client components (image previews) — kept separate from
// blogImageStorage.ts so client bundles never pull in the AWS SDK.

// Distinct from the "s3://" prefix used by the (private) orders bucket, so a
// storagePath always says which bucket/access-model it belongs to.
export const BLOG_STORAGE_PREFIX = "blogs3://";

export function isBlogStoragePath(storagePath: string): boolean {
  return storagePath.startsWith(BLOG_STORAGE_PREFIX);
}

// The blog bucket is public-read, so the base URL isn't a secret — it's
// exposed to the client (NEXT_PUBLIC_) so <img> tags can point straight at
// the bucket/CDN without a signed-URL redirect hop.
export function getBlogImagePublicUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath || !storagePath.startsWith(BLOG_STORAGE_PREFIX)) return null;

  const baseUrl = process.env.NEXT_PUBLIC_BLOG_S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return null;

  const key = storagePath.slice(BLOG_STORAGE_PREFIX.length);
  return `${baseUrl}/${key}`;
}

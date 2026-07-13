const S3_STORAGE_PREFIX = "s3://";

export function getPublicBlogImageUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;

  if (storagePath.startsWith(S3_STORAGE_PREFIX)) {
    const key = storagePath.slice(S3_STORAGE_PREFIX.length);
    return `/api/blog/images/${key}`;
  }

  return storagePath;
}

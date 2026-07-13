import { getBlogImagePublicUrl } from "@/lib/blog/blogImageStorage";

const S3_STORAGE_PREFIX = "s3://";

export function getPublicBlogImageUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;

  const blogBucketUrl = getBlogImagePublicUrl(storagePath);
  if (blogBucketUrl) return blogBucketUrl;

  // Legacy path: images uploaded before the dedicated blog bucket existed
  // live in the shared private orders bucket, so they still need the
  // presigned-URL redirect proxy.
  if (storagePath.startsWith(S3_STORAGE_PREFIX)) {
    const key = storagePath.slice(S3_STORAGE_PREFIX.length);
    return `/api/blog/images/${key}`;
  }

  return storagePath;
}

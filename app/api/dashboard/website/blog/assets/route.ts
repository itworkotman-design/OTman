import { NextResponse } from "next/server";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { uploadBlogImageToS3 } from "@/lib/blog/blogImageStorage";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const blogPostId = form?.get("blogPostId");

  if (typeof blogPostId !== "string" || !blogPostId) {
    return NextResponse.json({ ok: false, reason: "BLOG_POST_ID_REQUIRED" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, reason: "FILE_REQUIRED" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, reason: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ ok: false, reason: "FILE_TOO_LARGE" }, { status: 400 });
  }

  try {
    const stored = await uploadBlogImageToS3({ file, blogPostId });
    return NextResponse.json({ ok: true, storagePath: stored.storagePath, key: stored.key });
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_BLOG_POST_ID" }, { status: 400 });
  }
}

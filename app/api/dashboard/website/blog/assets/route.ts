import { NextResponse } from "next/server";
import { requireWebsiteEditor } from "@/lib/blog/requireWebsiteEditor";
import { uploadPublicAssetToS3 } from "@/lib/orders/orderAttachmentStorage";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  const auth = await requireWebsiteEditor(req);
  if ("error" in auth) return auth.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, reason: "FILE_REQUIRED" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, reason: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ ok: false, reason: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const stored = await uploadPublicAssetToS3({ file, scope: "blog" });

  return NextResponse.json({ ok: true, storagePath: stored.storagePath, key: stored.key });
}

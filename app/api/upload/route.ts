import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import {
  isS3AttachmentStorageConfigured,
  uploadAttachmentToS3,
} from "@/lib/orders/orderAttachmentStorage";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function isAllowedUploadFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedSession(req);

    if (!session) {
      return NextResponse.json(
        { ok: false, reason: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    if (!isS3AttachmentStorageConfigured()) {
      return NextResponse.json(
        { ok: false, reason: "S3_ATTACHMENT_STORAGE_NOT_CONFIGURED" },
        { status: 500 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, reason: "FILE_REQUIRED" },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { ok: false, reason: "EMPTY_FILE" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, reason: "FILE_TOO_LARGE" },
        { status: 400 },
      );
    }

    if (!isAllowedUploadFile(file)) {
      return NextResponse.json(
        { ok: false, reason: "INVALID_FILE_TYPE" },
        { status: 400 },
      );
    }

    const storedFile = await uploadAttachmentToS3({
      file,
      scope: `direct/${session.userId}`,
    });

    return NextResponse.json({
      ok: true,
      key: storedFile.key,
      storagePath: storedFile.storagePath,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, reason: "UPLOAD_FAILED" },
      { status: 500 },
    );
  }
}

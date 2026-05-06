import path from "path";
import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";
import {
  getSignedAttachmentUrl,
  isS3AttachmentStorageConfigured,
  isS3StoragePath,
  uploadAttachmentToS3,
} from "@/lib/orders/orderAttachmentStorage";
import { normalizeUserLogoPath } from "@/lib/users/profileAppearance";

const MAX_FILE_SIZE = 3 * 1024 * 1024;

function isAllowedUserLogoFile(file: File): boolean {
  return (
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/webp" ||
    file.type === "image/svg+xml"
  );
}

function getFilenameFromLogoPath(logoPath: string): string {
  const withoutQuery = logoPath.split("?")[0] ?? logoPath;
  const lastSegment = withoutQuery.split("/").pop()?.trim();
  return lastSegment || "logo";
}

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const requestUrl = new URL(req.url);
  const logoPath = normalizeUserLogoPath(requestUrl.searchParams.get("path"));

  if (!logoPath) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_LOGO_PATH" },
      { status: 400 },
    );
  }

  if (!isS3StoragePath(logoPath)) {
    return NextResponse.redirect(new URL(logoPath, requestUrl.origin));
  }

  const signedUrl = await getSignedAttachmentUrl({
    storagePath: logoPath,
    filename: getFilenameFromLogoPath(logoPath),
    mimeType: null,
    download: false,
  });

  if (!signedUrl) {
    return NextResponse.json(
      { ok: false, reason: "LOGO_NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.redirect(signedUrl);
}

export async function POST(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

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

  if (!isAllowedUserLogoFile(file)) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_FILE_TYPE" },
      { status: 400 },
    );
  }

  if (!isS3AttachmentStorageConfigured()) {
    return NextResponse.json(
      { ok: false, reason: "S3_ATTACHMENT_STORAGE_NOT_CONFIGURED" },
      { status: 500 },
    );
  }

  const originalName = file.name?.trim() || "logo";
  const ext = path.extname(originalName).toLowerCase();
  const allowedExt = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

  if (!allowedExt.includes(ext)) {
    return NextResponse.json(
      { ok: false, reason: "INVALID_FILE_EXTENSION" },
      { status: 400 },
    );
  }

  const storedFile = await uploadAttachmentToS3({
    file,
    scope: `user-logos/${session.userId}`,
  });

  return NextResponse.json(
    {
      ok: true,
      logoPath: storedFile.storagePath,
    },
    { status: 201 },
  );
}

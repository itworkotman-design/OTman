import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth/session";

const MAX_FILE_SIZE = 3 * 1024 * 1024;

function isAllowedUserLogoFile(file: File): boolean {
  return (
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/webp"
  );
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

  const bytes = Buffer.from(await file.arrayBuffer());
  const originalName = file.name?.trim() || "logo";
  const ext = path.extname(originalName).toLowerCase();
  const safeBaseName = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 60);
  const storedFilename = `${Date.now()}-${randomUUID()}-${safeBaseName}${ext}`;
  const relativeDir = path.join("uploads", "user-logos", session.userId);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  const absolutePath = path.join(absoluteDir, storedFilename);
  const publicPath = `/${relativeDir.replaceAll("\\", "/")}/${storedFilename}`;

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, bytes);

  return NextResponse.json(
    {
      ok: true,
      logoPath: publicPath,
    },
    { status: 201 },
  );
}

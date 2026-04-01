import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  const session = await getAuthenticatedSession(req);

  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!session.activeCompanyId) {
    return NextResponse.json(
      { ok: false, reason: "TENANT_SELECTION_REQUIRED" },
      { status: 409 },
    );
  }

  const attachments = await prisma.orderAttachment.findMany({
    where: {
      order: {
        companyId: session.activeCompanyId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    ok: true,
    attachments: attachments.map((item) => ({
      id: item.id,
      filename: item.filename,
      mimeType: item.mimeType ?? "",
      sizeBytes: item.sizeBytes ?? 0,
      storagePath: item.storagePath,
      createdAt: item.createdAt,
      url: item.storagePath,
    })),
  });
}

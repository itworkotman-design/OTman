import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getAttachmentAccessUrls } from "@/lib/orders/orderAttachmentStorage";

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

  const mappedAttachments = await Promise.all(
    attachments.map(async (item) => {
      const downloadUrl = `/api/orders/${item.orderId}/attachments/${item.id}/download?download=1`;
      const accessUrls = await getAttachmentAccessUrls({
        storagePath: item.storagePath,
        filename: item.filename,
        mimeType: item.mimeType,
        defaultUrl: `/api/orders/${item.orderId}/attachments/${item.id}/download`,
        defaultDownloadUrl: downloadUrl,
      });

      return {
        id: item.id,
        category: item.category,
        filename: item.filename,
        mimeType: item.mimeType ?? "",
        sizeBytes: item.sizeBytes ?? 0,
        storagePath: item.storagePath,
        createdAt: item.createdAt,
        url: accessUrls.url,
        downloadUrl: accessUrls.downloadUrl,
      };
    }),
  );

  return NextResponse.json({
    ok: true,
    attachments: mappedAttachments,
  });
}

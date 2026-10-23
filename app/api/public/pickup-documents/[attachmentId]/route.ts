import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSignedAttachmentUrl } from "@/lib/orders/orderAttachmentStorage";
import { verifyPickupDocumentLinkSignature } from "@/lib/orders/pickupDocumentLinks";
import { PICKUP_DOCUMENT_SOURCE } from "@/lib/orders/pickupDocuments";

// The stable link a GSM pickup task carries to a store pickup document
// (lib/orders/pickupDocumentLinks.ts). No login — the driver opens it on
// their phone to show the cashier — so it's gated by the HMAC in `s` and
// only ever serves attachments marked as pickup documents. Every failure is
// the same plain 404, so the route says nothing about which ids exist.
function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

export async function GET(req: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  const signature = new URL(req.url).searchParams.get("s") ?? "";

  if (!verifyPickupDocumentLinkSignature(attachmentId, signature)) {
    return notFound();
  }

  const attachment = await prisma.orderAttachment.findFirst({
    where: { id: attachmentId, source: PICKUP_DOCUMENT_SOURCE },
    select: { id: true, filename: true, mimeType: true, storagePath: true },
  });
  if (!attachment) {
    return notFound();
  }

  const url = await getSignedAttachmentUrl({
    storagePath: attachment.storagePath,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    download: false,
  });
  if (!url) {
    return notFound();
  }

  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

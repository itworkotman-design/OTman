import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, incrementRateLimit } from "@/lib/auth/rateLimit";
import { uploadTempAttachmentBufferToS3 } from "@/lib/orders/orderAttachmentStorage";
import { requestTooLargeByContentLength } from "@/lib/docArchive/uploadGate";
import { isValidQuoteToken } from "@/lib/orders/pendingQuoteAttachments";
import {
  MAX_PICKUP_DOCUMENTS_PER_ORDER,
  MAX_PICKUP_DOCUMENT_SIZE_BYTES,
  isValidPickupStopIndex,
  pickupDocumentFilename,
  sniffPickupDocumentMimeType,
} from "@/lib/orders/pickupDocuments";

// Public, unauthenticated upload of a store pickup document (receipt / order
// confirmation) for the homepage white-goods order — the same shape and the
// same defense in depth as app/api/site/special-goods-quote/upload: per-IP
// rate limit, pre-body Content-Length check, per-token file cap, and a
// magic-byte content check (PDF/JPEG/PNG only). Files are staged under tmp/
// in PendingQuoteAttachment rows grouped by a client-generated uploadToken;
// app/api/site/white-goods-order promotes and links them to the order on
// submit, and app/api/cron/quote-photo-cleanup removes any never submitted.
// The client only calls this right before submitting the order.

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day
// A couple of orders' worth of documents (plus a retry or two) per IP per day.
const RATE_LIMIT_PER_IP = 2 * MAX_PICKUP_DOCUMENTS_PER_ORDER;

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export async function POST(req: Request) {
  if (requestTooLargeByContentLength(req, MAX_PICKUP_DOCUMENT_SIZE_BYTES)) {
    return NextResponse.json({ ok: false, reason: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const ip = getClientIp(req);
  const rateLimitKey = `pickup-document-upload:${ip}`;
  const rateLimit = await checkRateLimit({ key: rateLimitKey, limit: RATE_LIMIT_PER_IP });
  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, reason: "RATE_LIMITED" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, reason: "INVALID_BODY" }, { status: 400 });
  }

  const tokenField = form.get("uploadToken");
  const uploadToken = typeof tokenField === "string" ? tokenField : null;
  if (!isValidQuoteToken(uploadToken)) {
    return NextResponse.json({ ok: false, reason: "INVALID_TOKEN" }, { status: 400 });
  }

  const stopField = form.get("stopIndex");
  const stopIndex = typeof stopField === "string" && /^\d+$/.test(stopField) ? Number(stopField) : Number.NaN;
  if (!isValidPickupStopIndex(stopIndex)) {
    return NextResponse.json({ ok: false, reason: "INVALID_STOP" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ ok: false, reason: "FILE_REQUIRED" }, { status: 400 });
  }

  if (file.size > MAX_PICKUP_DOCUMENT_SIZE_BYTES) {
    return NextResponse.json({ ok: false, reason: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const existingCount = await prisma.pendingQuoteAttachment.count({ where: { quoteToken: uploadToken } });
  if (existingCount >= MAX_PICKUP_DOCUMENTS_PER_ORDER) {
    return NextResponse.json({ ok: false, reason: "TOO_MANY_FILES" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffedType = sniffPickupDocumentMimeType(bytes);
  if (!sniffedType) {
    return NextResponse.json({ ok: false, reason: "INVALID_FILE_TYPE" }, { status: 400 });
  }

  const filename = pickupDocumentFilename(stopIndex, file.name);
  const uploaded = await uploadTempAttachmentBufferToS3({
    bytes,
    scope: `pickup-documents/${uploadToken}`,
    filename,
    contentType: sniffedType,
  });

  const attachment = await prisma.pendingQuoteAttachment.create({
    data: {
      quoteToken: uploadToken,
      filename,
      mimeType: sniffedType,
      sizeBytes: bytes.length,
      storagePath: uploaded.storagePath,
    },
  });

  await incrementRateLimit({ key: rateLimitKey, windowMs: RATE_LIMIT_WINDOW_MS });

  return NextResponse.json({ ok: true, id: attachment.id, filename });
}

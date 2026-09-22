import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, incrementRateLimit } from "@/lib/auth/rateLimit";
import { deleteAttachmentFile, uploadAttachmentBufferToS3 } from "@/lib/orders/orderAttachmentStorage";
import { requestTooLargeByContentLength } from "@/lib/docArchive/uploadGate";
import { MAX_QUOTE_PHOTOS, MAX_QUOTE_PHOTO_SIZE_BYTES, isValidQuoteToken, sniffImageMimeType } from "@/lib/orders/pendingQuoteAttachments";

// Public, unauthenticated photo upload for the "Andre varer"/"Spesialvarer"
// quote-request flow (SpecialGoodsQuoteFlow.tsx) — there's no auth session to
// scope uploads by (unlike every other upload path in this app, all of which
// require a logged-in dashboard session), so uploads are grouped by a
// client-generated `quoteToken` (crypto.randomUUID()) into
// PendingQuoteAttachment rows, linked to a real Order once the quote request
// is submitted (see lib/orders/pendingQuoteAttachments.ts). See
// docs/homepage-ordering-roadmap.md §5 for the full design/decision log —
// this endpoint is the one genuinely new public attack surface added this
// step, so every check here is deliberate defense in depth, not boilerplate:
// per-IP rate limit, a pre-body Content-Length check, a per-token photo cap,
// and real magic-byte file-content validation (every OTHER upload path in
// this app only checks the spoofable browser-supplied Content-Type).

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_PER_IP = 20; // generous relative to the 6-photo cap, allows retries

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  // No IP header available (e.g. local dev) — fall back to one shared
  // bucket rather than skipping the rate limit entirely.
  return "unknown";
}

export async function POST(req: Request) {
  if (requestTooLargeByContentLength(req, MAX_QUOTE_PHOTO_SIZE_BYTES)) {
    return NextResponse.json({ ok: false, reason: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const ip = getClientIp(req);
  const rateLimitKey = `special-goods-upload:${ip}`;
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

  const quoteTokenField = form.get("quoteToken");
  const quoteToken = typeof quoteTokenField === "string" ? quoteTokenField : null;
  if (!isValidQuoteToken(quoteToken)) {
    return NextResponse.json({ ok: false, reason: "INVALID_TOKEN" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ ok: false, reason: "FILE_REQUIRED" }, { status: 400 });
  }

  if (file.size > MAX_QUOTE_PHOTO_SIZE_BYTES) {
    return NextResponse.json({ ok: false, reason: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const existingCount = await prisma.pendingQuoteAttachment.count({ where: { quoteToken } });
  if (existingCount >= MAX_QUOTE_PHOTOS) {
    return NextResponse.json({ ok: false, reason: "TOO_MANY_PHOTOS" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // The real check — never trust file.type (the browser-supplied
  // Content-Type, fully attacker-controlled).
  const sniffedType = sniffImageMimeType(bytes);
  if (!sniffedType) {
    return NextResponse.json({ ok: false, reason: "INVALID_FILE_TYPE" }, { status: 400 });
  }

  const uploaded = await uploadAttachmentBufferToS3({
    bytes,
    scope: `quote-requests/${quoteToken}`,
    filename: file.name,
    contentType: sniffedType,
  });

  const attachment = await prisma.pendingQuoteAttachment.create({
    data: {
      quoteToken,
      filename: file.name,
      mimeType: sniffedType,
      sizeBytes: bytes.length,
      storagePath: uploaded.storagePath,
    },
  });

  await incrementRateLimit({ key: rateLimitKey, windowMs: RATE_LIMIT_WINDOW_MS });

  return NextResponse.json({ ok: true, id: attachment.id, filename: file.name });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const quoteToken = typeof body?.quoteToken === "string" ? body.quoteToken : "";

  if (!isValidQuoteToken(quoteToken) || !id) {
    return NextResponse.json({ ok: false, reason: "INVALID_REQUEST" }, { status: 400 });
  }

  // Scoped by matching BOTH id and quoteToken — the token is this flow's
  // only notion of "ownership" (there's no real auth for an anonymous
  // visitor), so this is what stops one visitor deleting another's upload.
  const attachment = await prisma.pendingQuoteAttachment.findFirst({
    where: { id, quoteToken },
  });

  if (!attachment) {
    return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });
  }

  await deleteAttachmentFile(attachment.storagePath);
  await prisma.pendingQuoteAttachment.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

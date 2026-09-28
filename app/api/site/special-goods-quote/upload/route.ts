import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, incrementRateLimit } from "@/lib/auth/rateLimit";
import { uploadTempAttachmentBufferToS3 } from "@/lib/orders/orderAttachmentStorage";
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
//
// The client only calls this at final submit time, not as each photo is
// picked (see SpecialGoodsQuoteFlow.tsx) — so there's no DELETE here for
// "remove a photo I already uploaded": removing one client-side before
// submitting never touched this endpoint at all. This also means an
// abandoned form never writes anything to S3/the DB in the first place,
// which is the whole point (no cron needed to clean up orphaned uploads from
// someone who picks photos then never submits).

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day
// Matches MAX_QUOTE_PHOTOS exactly — one IP gets at most one quote's worth
// of photos per day, across any number of quote requests.
const RATE_LIMIT_PER_IP = MAX_QUOTE_PHOTOS;

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

  const uploaded = await uploadTempAttachmentBufferToS3({
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

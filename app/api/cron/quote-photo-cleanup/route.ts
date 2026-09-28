import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteAttachmentFile } from "@/lib/orders/orderAttachmentStorage";
import { cleanupExpiredPendingQuoteAttachments } from "@/lib/orders/pendingQuoteAttachments";

// Backstop to the S3 lifecycle rule on tmp/: deletes special-goods quote
// photos staged more than a day ago that never got attached to an order, plus
// their PendingQuoteAttachment rows (which the lifecycle rule can't reach).
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const summary = await cleanupExpiredPendingQuoteAttachments(prisma, {
    now: new Date(),
    maxAgeMs: MAX_AGE_MS,
    deleteFile: deleteAttachmentFile,
  });

  return NextResponse.json({ ok: true, ...summary });
}

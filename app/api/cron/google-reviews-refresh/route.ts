import { NextResponse } from "next/server";
import { refreshGoogleReviewsCache } from "@/lib/site/googleReviews";

// Same CRON_SECRET Bearer-auth pattern as the other cron routes — meant to
// be called by an external scheduler (Render Cron Job), not a user session.
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const summary = await refreshGoogleReviewsCache();

  return NextResponse.json({ ok: true, ...summary });
}

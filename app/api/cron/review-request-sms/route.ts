import { NextResponse } from "next/server";
import { runReviewRequestSmsSweep } from "@/lib/sms/reviewRequestSweep";

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const rawLimit = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : undefined;
  const summary = await runReviewRequestSmsSweep({ limit });

  return NextResponse.json({ ok: true, ...summary });
}

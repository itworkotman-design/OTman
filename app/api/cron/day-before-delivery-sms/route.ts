import { NextResponse } from "next/server";
import { runDayBeforeDeliverySmsSweep } from "@/lib/sms/dayBeforeDeliverySweep";

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const rawLimit = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : undefined;
  const summary = await runDayBeforeDeliverySmsSweep({ limit });

  return NextResponse.json({ ok: true, ...summary });
}

import { NextResponse } from "next/server";
import {
  parseMissingPartnerLimitParam,
  runMissingPartnerAlertSweep,
} from "@/lib/orders/alerts/missingPartnerSweep";

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const secret = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  }

  const limit = parseMissingPartnerLimitParam(new URL(req.url).searchParams);
  const summary = await runMissingPartnerAlertSweep({ limit });

  return NextResponse.json({ ok: true, ...summary });
}
